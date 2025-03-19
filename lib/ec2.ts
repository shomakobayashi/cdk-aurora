import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class LoadTestEc2 extends Construct {
  public readonly instance: ec2.Instance;

  constructor(scope: Construct, id: string, vpc: ec2.Vpc) {
    super(scope, id);

    // SSM用IAMロール
    const ssmRole = new iam.Role(this, 'SSMRoleForEC2', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    // EC2用のセキュリティグループ
    const ec2SecurityGroup = new ec2.SecurityGroup(this, 'LoadTestEc2SG', {
      vpc,
      description: 'Load Test EC2',
      allowAllOutbound: true, // API Gateway へのアクセスを許可
    });

    // EC2
    this.instance = new ec2.Instance(this, 'LoadTestEc2Instance', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: ec2SecurityGroup,
      role: ssmRole,
    });
  }
}
