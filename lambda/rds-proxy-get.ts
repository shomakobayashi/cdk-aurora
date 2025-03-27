import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';

// 環境変数
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
export const handler = async () => {
  try {

    const client = await dbClientPromise;
    const result = await client.query('SELECT * FROM users');

    return { 
      statusCode: 200, 
      body: JSON.stringify(result.rows) 
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: errorMessage }) 
    };
  }
};
