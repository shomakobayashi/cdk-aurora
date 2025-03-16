import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class ApiGateway extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, lambdaFunction: lambda.Function) {
    super(scope, id);

    // API Gatewayの作成
    this.api = new apigateway.RestApi(this, 'UsersApi', {
      restApiName: 'Users Service',
      description: 'API Gateway for Aurora PostgreSQL Users',
      deployOptions: {
        stageName: 'prod',
      },
      binaryMediaTypes: []
    });

    // Lambda統合の作成
    const lambdaIntegration = new apigateway.LambdaIntegration(lambdaFunction);

    // ルートパス（/）にGETメソッドを追加
    this.api.root.addMethod('GET', lambdaIntegration);

    // usersエンドポイントの作成
    const users = this.api.root.addResource('users');
    users.addMethod('GET', lambdaIntegration);  // GET /users - すべてのユーザーを取得

    // API GatewayのURLを出力
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.api.urlForPath('/users'),
      description: 'Users API Endpoint URL',
    });
    
    // 完全なAPIのURLも出力
    new cdk.CfnOutput(this, 'ApiGatewayBaseUrl', {
      value: this.api.url,
      description: 'API Gateway Base URL',
    });
  }
}
