import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data';

// 環境変数
const secretArn = process.env.SECRET_ARN;
const dbName = process.env.DB_NAME;
const clusterArn = process.env.CLUSTER_ARN;
const rdsData = new RDSDataClient({ region: process.env.AWS_REGION });

// Lambda関数ハンドラー
export const handler = async (event: any): Promise<any> => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Data APIでクエリを実行
    const result = await rdsData.send(
      new ExecuteStatementCommand({
        resourceArn: clusterArn,
        secretArn: secretArn,
        database: dbName,
        sql: 'SELECT * FROM users',
        includeResultMetadata: true,
      })
    );
    
    // レスポンスデータを整形
    const users = result.records?.map(record => {
      const user: Record<string, any> = {};
      result.columnMetadata?.forEach((meta, index) => {
        const columnName = meta.name || `column_${index}`;
        const value = record[index].stringValue || record[index].longValue || record[index].booleanValue;
        user[columnName] = value;
      });
      return user;
    }) || [];
    
    // 成功レスポンス
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        users: users
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
        message: 'Error querying users table via Data API',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
