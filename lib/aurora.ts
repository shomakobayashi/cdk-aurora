import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class Aurora extends Construct {
  public readonly cluster: rds.DatabaseCluster;
  public readonly dbSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, vpc: ec2.Vpc) {
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
    });

    // 出力値の設定
    new cdk.CfnOutput(this, 'ClusterEndpoint', {
      value: this.cluster.clusterEndpoint.hostname,
      description: 'Aurora Serverless v2 Cluster Endpoint',
    });

    new cdk.CfnOutput(this, 'SecretArn', {
      value: this.dbSecret.secretArn,
      description: 'Secret ARN for database credentials',
    });

    new cdk.CfnOutput(this, 'DatabaseName', {
      value: 'demodb',
      description: 'Default Database Name',
    });
  }
}
