import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Pool } from 'pg';

// 環境変数
const secretArn = process.env.SECRET_ARN;
const dbName = process.env.DB_NAME;
const proxyEndpoint = process.env.PROXY_ENDPOINT;
const secretsManager = new SecretsManagerClient({ region: process.env.AWS_REGION });

// グローバル変数
let pool: Pool | null = null;
let credentials: any = null;

// DB認証情報を取得
async function getDbCredentials() {
  const response = await secretsManager.send(new GetSecretValueCommand({ SecretId: secretArn }));
  return response.SecretString ? JSON.parse(response.SecretString) : null;
}

// DB接続プールを取得
async function getPool() {
  if (pool) return pool;
  
  try {
    const creds = await getDbCredentials();
    pool = new Pool({
      host: proxyEndpoint,
      port: 5432,
      database: dbName,
      user: creds.username,
      password: creds.password,
      idleTimeoutMillis: 30000, // アイドル接続のタイムアウト
      connectionTimeoutMillis: 2000, // 接続タイムアウト
    });
    
    // エラーハンドリング
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      pool = null; // エラー時にプールをリセット
    });
    
    return pool;
  } catch (error) {
    console.error('Failed to create connection pool:', error);
    throw error;
  }
}

// Lambda関数ハンドラー
export const handler = async () => {
  let client = null;
  
  try {
    const pool = await getPool();
    client = await pool.connect(); // プールから接続を取得
    
    const result = await client.query('SELECT * FROM users');
    
    return { 
      statusCode: 200, 
      body: JSON.stringify(result.rows) 
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Query execution error:', errorMessage);
    
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: errorMessage }) 
    };
  } finally {
    if (client) {
      client.release(); // 接続をプールに返却
    }
  }
};
