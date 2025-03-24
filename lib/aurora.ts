import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class Aurora extends Construct {
  public readonly cluster: rds.DatabaseCluster;
  public readonly dbSecret: secretsmanager.Secret;
  public readonly rdsProxy: rds.DatabaseProxy;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, vpc: ec2.Vpc, lambdaSg?: ec2.SecurityGroup) {
    super(scope, id);

    // データベース認証情報のシークレットを作成
    this.dbSecret = new secretsmanager.Secret(this, 'AuroraSecret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludeCharacters: '/@" ',
      },
    });

    // セキュリティグループの作成
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DBSecurityGroup', {
      vpc,
      description: 'Security group for Aurora Serverless v2',
      allowAllOutbound: true,
    });

    // VPC内からの接続を許可
    dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow database connections from within VPC'
    );

    // Lambda からの接続を許可
    if (lambdaSg) {
      dbSecurityGroup.addIngressRule(
        lambdaSg,
        ec2.Port.tcp(5432),
        'Allow connections from Lambda to RDS Proxy'
      );
    }

    // Aurora Serverless v2クラスターの作成
    this.cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_1,
      }),
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      defaultDatabaseName: 'demodb',
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [dbSecurityGroup],
      writer: rds.ClusterInstance.serverlessV2('Writer', {
        autoMinorVersionUpgrade: true,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 1,
      enableDataApi: true, // data API有効化
      enablePerformanceInsights: true, // PerformanceInsights有効化
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT, // Standard（無料）プラン
    });

    // RDS Proxyの作成
    this.rdsProxy = new rds.DatabaseProxy(this, 'AuroraProxy', {
      proxyTarget: rds.ProxyTarget.fromCluster(this.cluster),
      secrets: [this.dbSecret],
      vpc,
      securityGroups: [dbSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      requireTLS: false,
      idleClientTimeout: cdk.Duration.seconds(900),
      dbProxyName: 'aurora-serverless-proxy',
      debugLogging: true,
    });  
  }
}
