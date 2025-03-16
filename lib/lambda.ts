import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as lambdaBase from 'aws-cdk-lib/aws-lambda';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as rds from 'aws-cdk-lib/aws-rds';

export class Lambda extends Construct {
  public readonly rdsProxyLambda: lambda.NodejsFunction;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, vpc: ec2.Vpc, dbSecret: secretsmanager.ISecret,rdsProxy: rds.DatabaseProxy) {
    super(scope, id);

    // Lambda用セキュリティグループ
    this.securityGroup = new ec2.SecurityGroup(this, 'LambdaSG', {
      vpc,
      description: 'Security group for Lambda function',
      allowAllOutbound: true,
    });

    // RDS Proxy を使用する Lambda
    this.rdsProxyLambda = new lambda.NodejsFunction(this, 'RdsProxyLambda', {
      entry: path.resolve(__dirname, '../lambda/rds-proxy-lambda.ts'),
      handler: 'handler',
      runtime: lambdaBase.Runtime.NODEJS_20_X,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.securityGroup],
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        PROXY_ENDPOINT: rdsProxy.endpoint,
        SECRET_ARN: dbSecret.secretArn,
        DB_NAME: 'demodb',
      },
      bundling: {
        forceDockerBundling: false, // Dockerを使用しない
        minify: true,
        nodeModules: ['pg', 'aws-sdk'],
      },
    });

    // Secrets Managerへのアクセス権限を付与
    dbSecret.grantRead(this.rdsProxyLambda);

    // Lambda関数のARNを出力
    new cdk.CfnOutput(this, 'LambdaFunctionArn', {
      value: this.rdsProxyLambda.functionArn,
      description: 'Lambda Function ARN',
    });
  }
}
