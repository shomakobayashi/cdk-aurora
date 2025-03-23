import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';

const secretArn = process.env.SECRET_ARN;
const dbName = process.env.DB_NAME;
const proxyEndpoint = process.env.PROXY_ENDPOINT;
const secretsManager = new SecretsManagerClient({ region: process.env.AWS_REGION });

// DB認証情報を取得
async function getDbCredentials() {
  const response = await secretsManager.send(new GetSecretValueCommand({ SecretId: secretArn }));
  return response.SecretString ? JSON.parse(response.SecretString) : null;
}

// DB接続を初期化
let dbClientPromise = (async () => {
  try {
    const credentials = await getDbCredentials();
    const client = new Client({
      host: proxyEndpoint,
      port: 5432,
      database: dbName,
      user: credentials.username,
      password: credentials.password,
    });
    await client.connect();
    return client;
  } catch (error) {
    console.error('DB connection error:', error);
    throw error;
  }
})();

// Lambda関数ハンドラー
export const handler = async (event: any) => {
  try {
    const client = await dbClientPromise;
    
    // リクエストボディからnameを取得
    const body = JSON.parse(event.body || '{}');
    const name = body.name || `Default User ${Date.now()}`;
    
    // DBにデータを挿入
    const result = await client.query(
      'INSERT INTO users(name) VALUES($1) RETURNING id, name',
      [name]
    );
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'User created successfully',
        user: result.rows[0]
      })
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: 'Error creating user',
        error: errorMessage
      })
    };
  }
};
