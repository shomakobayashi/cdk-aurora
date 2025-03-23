import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

export class ApiGateway extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct,
    id: string,
    getLambdaFunction: lambda.Function,
    postLambdaFunction: lambda.Function,
    dataApiGet: lambda.Function,
    dataApiPost: lambda.Function
  ) {
    super(scope, id);

    // API Gateway
    this.api = new apigateway.RestApi(this, 'UsersApi', {
      restApiName: 'Users Service',
      description: 'API Gateway for Aurora PostgreSQL Users',
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true,
      },
      binaryMediaTypes: []
    });

    // RDS Proxy　Lambda統合(GET)    
    const rdsProxyGetIntegration = new apigateway.LambdaIntegration(getLambdaFunction);

    // RDS Proxy　Lambda統合（POST)
    const rdsProxyPostIntegration = new apigateway.LambdaIntegration(postLambdaFunction);

    // Data API Lambda統合（GET）
    const dataApiGetIntegration = new apigateway.LambdaIntegration(dataApiGet);
    
    // Data API Lambda統合（POST）
    const dataApiPostIntegration = new apigateway.LambdaIntegration(dataApiPost);

    // ルートパス（/）にGETメソッドを追加
    this.api.root.addMethod('GET', rdsProxyGetIntegration);

    // RDS Proxyエンドポイント
    const rdsProxy = this.api.root.addResource('rdsProxy');

    // RDS Proxy (GET操作)
    rdsProxy.addMethod('GET', rdsProxyGetIntegration);

    // RDS Proxy (POST操作)
    rdsProxy.addMethod('POST', rdsProxyPostIntegration);

    // Data APIエンドポイント（GET）
    const dataApi = this.api.root.addResource('data-api');

    // Data API （GET）
    dataApi.addMethod('GET', dataApiGetIntegration);

    // Data API （POST）
    dataApi.addMethod('POST', dataApiPostIntegration);
  
    // API Gateway用のCloudWatchロールを作成
    const cloudWatchRole = new iam.Role(this, 'ApiGatewayCloudWatchRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayPushToCloudWatchLogs')
      ]
    });

    // アカウントレベルでCloudWatchロールを設定
    new apigateway.CfnAccount(this, 'ApiGatewayAccount', {
      cloudWatchRoleArn: cloudWatchRole.roleArn
    });
  }
}
