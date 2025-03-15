import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc } from './vpc';
import { Aurora } from './aurora';

export class MainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPCの作成
    const vpcStack = new Vpc(this, 'VpcConstruct');

    // Aurora Serverless v2の作成
    const auroraStack = new Aurora(this, 'AuroraConstruct', vpcStack.vpc);
  }
}
