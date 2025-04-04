import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as lambdaBase from 'aws-cdk-lib/aws-lambda';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as iam from 'aws-cdk-lib/aws-iam';

export class Lambda extends Construct {
  public readonly rdsProxyGet: lambda.NodejsFunction;
  public readonly rdsProxyPost: lambda.NodejsFunction;
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly dataApiGet: lambda.NodejsFunction;
  public readonly dataApiPost: lambda.NodejsFunction;
  public readonly rdsProxyGetAlias: lambdaBase.Alias;
  public readonly rdsProxyPostAlias: lambdaBase.Alias;
  public readonly dataApiGetAlias: lambdaBase.Alias;
  public readonly dataApiPostAlias: lambdaBase.Alias;

  constructor(scope: Construct,
     id: string,
     vpc: ec2.Vpc,
     dbSecret: secretsmanager.ISecret,
     rdsProxy: rds.DatabaseProxy,
     cluster: rds.DatabaseCluster
  ) {
    super(scope, id);

    // Lambda用セキュリティグループ
    this.securityGroup = new ec2.SecurityGroup(this, 'LambdaSG', {
      vpc,
      description: 'Security group for Lambda function',
      allowAllOutbound: true,
    });

    // RDS Proxy（GET）
    this.rdsProxyGet = new lambda.NodejsFunction(this, 'rdsProxyGet', {
      entry: path.resolve(__dirname, '../lambda/rds-proxy-get.ts'),
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
        forceDockerBundling: false,
        minify: true,
        nodeModules: ['pg', 'aws-sdk'],
      },
    });

    // RDS Proxy GET のエイリアス
    this.rdsProxyGetAlias = new lambdaBase.Alias(this, 'RdsProxyGetAlias', {
      aliasName: 'prod',
      version: this.rdsProxyGet.currentVersion,
      provisionedConcurrentExecutions: 5
    });

    // RDS Proxy（POST）
    this.rdsProxyPost = new lambda.NodejsFunction(this, 'rdsProxyPOST', {
      entry: path.resolve(__dirname, '../lambda/rds-proxy-post.ts'),
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
        forceDockerBundling: false,
        minify: true,
        nodeModules: ['pg', 'aws-sdk'],
      },
    });

    // RDS Proxy POST のエイリアス
    this.rdsProxyPostAlias = new lambdaBase.Alias(this, 'RdsProxyPostAlias', {
      aliasName: 'prod',
      version: this.rdsProxyPost.currentVersion,
      provisionedConcurrentExecutions: 5
    });

    // Data API（GET）
    this.dataApiGet = new lambda.NodejsFunction(this, 'dataApiGet', {
      entry: path.resolve(__dirname, '../lambda/data-api-get.ts'),
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

    // Data API GET のエイリアス
    this.dataApiGetAlias = new lambdaBase.Alias(this, 'DataApiGetAlias', {
      aliasName: 'prod',
      version: this.dataApiGet.currentVersion,
      provisionedConcurrentExecutions: 5
    });

    // Data API（POST）
    this.dataApiPost = new lambda.NodejsFunction(this, 'dataApiPost', {
      entry: path.resolve(__dirname, '../lambda/data-api-post.ts'),
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

    // Data API POST のエイリアスを作成
    this.dataApiPostAlias = new lambdaBase.Alias(this, 'DataApiPostAlias', {
      aliasName: 'prod',
      version: this.dataApiPost.currentVersion,
      provisionedConcurrentExecutions: 5
    });

    // Secrets Managerへのアクセス権限を付与
    dbSecret.grantRead(this.rdsProxyGet);
    dbSecret.grantRead(this.rdsProxyPost);
    dbSecret.grantRead(this.dataApiGet);
    dbSecret.grantRead(this.dataApiPost);

    // Data API（GET）実行権限を付与　（追加）
    this.dataApiGet.addToRolePolicy(
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

     // Data API(POST)実行権限を付与　（追加）
     this.dataApiPost.addToRolePolicy(
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
