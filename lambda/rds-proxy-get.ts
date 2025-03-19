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
export const handler = async () => {
  try {
    const client = await connectToDb();
    const result = await client.query('SELECT * FROM users');
    return { statusCode: 200, body: JSON.stringify(result.rows) };
  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { statusCode: 500, body: JSON.stringify({ error: errorMessage }) };
  }
};
