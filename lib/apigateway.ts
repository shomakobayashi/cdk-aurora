import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class ApiGateway extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct,
    id: string,
    lambdaFunction: lambda.Function,
    dataApiLambda: lambda.Function  // 追加
  ) {
    super(scope, id);

    // API Gateway
    this.api = new apigateway.RestApi(this, 'UsersApi', {
      restApiName: 'Users Service',
      description: 'API Gateway for Aurora PostgreSQL Users',
      deployOptions: {
        stageName: 'prod',
      },
      binaryMediaTypes: []
    });

    /**
     *  Lambda統合
     */

    // RDS Proy　Lambda統合
    const rdsProxyIntegration = new apigateway.LambdaIntegration(lambdaFunction);

    // Data API Lambda統合 （追加）
    const dataApiIntegration = new apigateway.LambdaIntegration(dataApiLambda);

    // ルートパス（/）にGETメソッドを追加
    this.api.root.addMethod('GET', rdsProxyIntegration);

    /**
     *  エンドポイント
     */

    // RDS Proxyエンドポイント
    const rdsProxy = this.api.root.addResource('rdsProxy');
    rdsProxy.addMethod('GET', rdsProxyIntegration);

    // Data APIエンドポイント
    const dataApi = this.api.root.addResource('data-api');
    dataApi.addMethod('GET', dataApiIntegration);
  }
}
