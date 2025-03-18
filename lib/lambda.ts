import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as lambdaBase from 'aws-cdk-lib/aws-lambda';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as iam from 'aws-cdk-lib/aws-iam';  // 追加

export class Lambda extends Construct {
  public readonly rdsProxyLambda: lambda.NodejsFunction;
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly dataApiLambda: lambda.NodejsFunction; // 追加

  constructor(scope: Construct,
     id: string,
     vpc: ec2.Vpc,
     dbSecret: secretsmanager.ISecret,
     rdsProxy: rds.DatabaseProxy,
     cluster: rds.DatabaseCluster  // 追加
  ) {
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
      memorySize: 128,
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

    // Data API を使用する Lambda (VPC外で実行可能) (追加)
    this.dataApiLambda = new lambda.NodejsFunction(this, 'DataApiLambda', {
      entry: path.resolve(__dirname, '../lambda/data-api-lambda.ts'),
      handler: 'handler',
      runtime: lambdaBase.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      environment: {
        CLUSTER_ARN: cluster.clusterArn,
        SECRET_ARN: dbSecret.secretArn,
        DB_NAME: 'demodb',
      },
      bundling: {
        forceDockerBundling: false,
        minify: true,
        nodeModules: ['@aws-sdk/client-rds-data', '@aws-sdk/client-secrets-manager'],
      },
    });

    // Secrets Managerへのアクセス権限を付与
    dbSecret.grantRead(this.rdsProxyLambda);
    dbSecret.grantRead(this.dataApiLambda);  // 追加

    // Data API実行権限を付与　（追加）
    this.dataApiLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'rds-data:ExecuteStatement',
          'rds-data:BatchExecuteStatement',
          'rds-data:BeginTransaction',
          'rds-data:CommitTransaction',
          'rds-data:RollbackTransaction'
        ],
        resources: [cluster.clusterArn],
      })
    );
  }
}
