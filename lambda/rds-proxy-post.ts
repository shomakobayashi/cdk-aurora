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
  if (credentials) return credentials;
  
  try {
    const response = await secretsManager.send(new GetSecretValueCommand({ SecretId: secretArn }));
    credentials = response.SecretString ? JSON.parse(response.SecretString) : null;
    return credentials;
  } catch (error) {
    console.error('Failed to get DB credentials:', error);
    throw error;
  }
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
      max: 10, // 最大接続数を制限
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
export const handler = async (event: any) => {
  let client = null;
  
  try {
    const pool = await getPool();
    client = await pool.connect(); // プールから接続を取得
    
    // リクエストボディからnameを取得
    const body = JSON.parse(event.body || '{}');
    const name = body.name || `Default User ${Date.now()}`;
    
    // トランザクションを開始
    await client.query('BEGIN');
    
    // DBにデータを挿入
    const result = await client.query(
      'INSERT INTO users(name) VALUES($1) RETURNING id, name',
      [name]
    );
    
    // トランザクションをコミット
    await client.query('COMMIT');
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'User created successfully',
        user: result.rows[0]
      })
    };
    
  } catch (error) {
    // エラー発生時はロールバック
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating user:', errorMessage);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: 'Error creating user',
        error: errorMessage
      })
    };
  } finally {
    if (client) {
      client.release(); // 接続をプールに返却
    }
  }
};
