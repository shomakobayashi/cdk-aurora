import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';

// 環境変数
const secretArn = process.env.SECRET_ARN;
const dbName = process.env.DB_NAME;
const proxyEndpoint = process.env.PROXY_ENDPOINT;
const secretsManager = new SecretsManagerClient({ region: process.env.AWS_REGION });

// データベース接続情報を取得する関数
async function getDbCredentials() {
  const response = await secretsManager.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  );
  
  if (response.SecretString) {
    return JSON.parse(response.SecretString);
  }
  throw new Error('Secret string is empty');
}

// Lambda関数ハンドラー
export const handler = async (event: any): Promise<any> => {
  
  let client: Client | undefined;
  
  try {
    // 認証情報を取得
    const credentials = await getDbCredentials();
    
    // データベース接続
    client = new Client({
      host: proxyEndpoint,
      port: 5432,
      database: dbName,
      user: credentials.username,
      password: credentials.password,
    });
    
    await client.connect();
    console.log('Connected to database via RDS Proxy');
    
    // ユーザーデータ取得
    const result = await client.query('SELECT * FROM users');
    console.log(`Retrieved ${result.rows.length} users`);
    
    // 成功レスポンス
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        users: result.rows
      })
    };
    
  } catch (error: unknown) {
    // エラーログ
    console.error('Error:', error);
    
    // エラーレスポンス
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Error querying users table',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
    
  } finally {
    // 接続を閉じる
    if (client) {
      await client.end().catch(err => {
        console.error('Error closing database connection:', err);
      });
      console.log('Database connection closed');
    }
  }
};
