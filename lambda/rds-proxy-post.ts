import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';

const secretArn = process.env.SECRET_ARN;
const dbName = process.env.DB_NAME;
const proxyEndpoint = process.env.PROXY_ENDPOINT;
const secretsManager = new SecretsManagerClient({ region: process.env.AWS_REGION });

let dbClient: Client | null = null;

async function getDbCredentials() {
  const response = await secretsManager.send(new GetSecretValueCommand({ SecretId: secretArn }));
  return response.SecretString ? JSON.parse(response.SecretString) : null;
}

async function connectToDb() {
  if (!dbClient) {
    console.log('Initializing new database connection...');
    const credentials = await getDbCredentials();
    dbClient = new Client({
      host: proxyEndpoint,
      port: 5432,
      database: dbName,
      user: credentials.username,
      password: credentials.password,
    });
    await dbClient.connect();
  }
  return dbClient;
}

// Lambda関数ハンドラー
export const handler = async (event: any) => {
  try {
    // DBに接続
    const client = await connectToDb();
    
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
      body: JSON.stringify({
        message: 'User created successfully',
        user: result.rows[0]
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Error creating user',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
