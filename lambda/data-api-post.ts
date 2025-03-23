import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data';

// 環境変数
const secretArn = process.env.SECRET_ARN;
const dbName = process.env.DB_NAME;
const clusterArn = process.env.CLUSTER_ARN;
const rdsData = new RDSDataClient({ region: process.env.AWS_REGION });

// Lambda関数ハンドラー
export const handler = async (event: any): Promise<any> => {
  try {
    // リクエストボディからユーザー名を取得
    const body = JSON.parse(event.body || '{}');
    const name = body.name || `User ${Date.now()}`;
    
    const result = await rdsData.send(
      new ExecuteStatementCommand({
        resourceArn: clusterArn,
        secretArn: secretArn,
        database: dbName,
        sql: 'INSERT INTO users(name) VALUES(:name) RETURNING id, name',
        parameters: [
          { name: 'name', value: { stringValue: name } }
        ],
        includeResultMetadata: true,
      })
    );
    
    // レスポンスデータを整形
    const user: Record<string, any> = {};
    
    // result.records が存在するかチェック
    if (result.records && result.records.length > 0 && result.columnMetadata) {
      result.columnMetadata.forEach((meta, index) => {
        if (meta.name && result.records && result.records[0] && result.records[0][index]) {
          const columnName = meta.name;
          const field = result.records[0][index];
          const value = field.stringValue ?? field.longValue ?? field.booleanValue ?? null;
          user[columnName] = value;
        }
      });
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user })
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: errorMessage })
    };
  }
};