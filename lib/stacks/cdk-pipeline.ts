import {
  pipelines as cdkpipeline,
  Stack,
  StackProps,
  aws_iam as iam,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { commonConstants } from '../parameters/constants';
import { resolveConfig } from '../../lib/parameters/env-config';
import { AppStage } from '../stages/app-stage';

interface CDKPipelineStackProps extends StackProps {
  infraStatus: "on" | "off",
}

export class CdkPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: CDKPipelineStackProps) {
    super(scope, id, props);

    const { infraStatus } = props;

    const config = resolveConfig();
    // Development Environment
    const devStage = new AppStage(this, `cdk-pipeline-dev`, {
      env: {account: config.awsAccount, region: config.region},
      deployEnv: 'dev',
      infraStatus: infraStatus,
    });

    // Production Environment
    const prodStage = new AppStage(this, `cdk-pipeline-prod`, {
      env: {account: config.awsAccount, region: config.region},
      deployEnv: 'prod',
      infraStatus: 'on',
    });

    const cdkPipeline = new cdkpipeline.CodePipeline(this, `${commonConstants.project}-cdk-pipeline`, {
      synth: new cdkpipeline.CodeBuildStep(`project-synth`, {
        input: cdkpipeline.CodePipelineSource.connection('afterfit/shirokumapower-corp-infra', 'main', {
          connectionArn: config.githubConnection
        }),
        commands: [
          `aws ssm get-parameter --with-decryption --name /cdk/env --output text --query 'Parameter.Value' > .env`,
          'npm ci', 'npm run build', 'npx cdk synth',
          'pip3 install ansi2html',
          `{ echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')" ; FORCE_COLOR=1 npx cdk diff "CDKPipelineStack/cdk-pipeline-dev/**" 2>&1; } | ansi2html > cdk-diff-output-dev.html`,
          `{ echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')" ; FORCE_COLOR=1 npx cdk diff "CDKPipelineStack/cdk-pipeline-prod/**" 2>&1; } | ansi2html > cdk-diff-output-prod.html`,
          `aws s3 cp cdk-diff-output-dev.html s3://shirokumapower-infra-diff-bucket/diff-file/${commonConstants.project}/cdk-diff-output-dev.html`,
          `aws s3 cp cdk-diff-output-prod.html s3://shirokumapower-infra-diff-bucket/diff-file/${commonConstants.project}/cdk-diff-output-prod.html`,
          'rm -f cdk-diff-output*',
        ],
        rolePolicyStatements: [
          new iam.PolicyStatement({
            resources: [
              `arn:aws:ssm:${this.region}:${this.account}:parameter/cdk/env`,
              `arn:aws:ssm:${this.region}:${this.account}:parameter/cdk/env`
            ],
            actions: ["ssm:GetParameter*"],
          }),
          new iam.PolicyStatement({
            resources: [
              `arn:aws:s3:::shirokumapower-infra-diff-bucket/*`
            ],
            actions: ["s3:PutObject"],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'cloudformation:DescribeStacks',
              'cloudformation:GetTemplate',
              'cloudformation:ListStacks',
              'cloudformation:DescribeStackEvents',
              'cloudformation:DescribeStackResource',
              'cloudformation:DescribeStackResources',
              'cloudformation:GetTemplateSummary',
              's3:ListBucket',
              's3:GetObject',
              's3:PutObject',
              'ecr:DescribeRepositories',
              'ecr:ListImages',
              'ecr:BatchGetImage',
              'ecr:GetDownloadUrlForLayer',
              'sts:AssumeRole'
            ],
            resources: ['*']
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'iam:GetRole',
              'iam:GetRolePolicy',
              'iam:ListRolePolicies',
              'iam:ListAttachedRolePolicies'
            ],
            resources: ['*']
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'ssm:GetParameter',
              'ssm:GetParameters'
            ],
            resources: ['*']
          })
        ],
      }),
    });

    cdkPipeline.addStage(devStage, {
      pre: [new cdkpipeline.ManualApprovalStep('dev-deployment-approval', {
        comment: `Please confirm diff at https://infra.shirokumapower.jp/infra-diff?system=${commonConstants.project}&env=dev`,
      })],
    });


    cdkPipeline.addStage(prodStage, {
      pre: [new cdkpipeline.ManualApprovalStep('production-deployment-approval', {
        comment: `Please confirm diff at https://infra.shirokumapower.jp/infra-diff?system=${commonConstants.project}&env=prod`,
      })],
    });

  }
}
