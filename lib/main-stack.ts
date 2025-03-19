import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc } from './vpc';
import { Aurora } from './aurora';
import { Lambda } from './lambda';
import { ApiGateway } from './apigateway';
import { LoadTestEc2 } from './ec2';

export class MainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPCの作成
    const vpc = new Vpc(this, 'VpcConstruct');

    // Aurora Serverless v2の作成
    const aurora = new Aurora(this, 'AuroraConstruct', vpc.vpc);

    // Lambda関数の作成
    const lambdaFunction = new Lambda(
      this,
      'LambdaConstruct',
      vpc.vpc,
      aurora.dbSecret,
      aurora.rdsProxy,
      aurora.cluster   // 追加
    );
    
    // API Gatewayの作成
    new ApiGateway(
      this,
      'ApiGatewayConstruct',
      lambdaFunction.rdsProxyLambda,
      lambdaFunction.dataApiLambda   //追加
    );

    // EC2インスタンスを作成
    new LoadTestEc2(this, 'LoadTestEc2', vpc.vpc);
  }
}
