import {
  pipelines as cdkpipeline,
  Stack,
  StackProps,
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
      synth: new cdkpipeline.ShellStep(`project-synth`, {
        input: cdkpipeline.CodePipelineSource.connection('afterfit/shirokumapower-corp-infra', 'main', {
          connectionArn: config.githubConnection
        }
        ),
        commands: ['npm ci', 'npm run build', 'npx cdk synth'],
      }),
    });

    cdkPipeline.addStage(devStage);


    cdkPipeline.addStage(prodStage, {
      pre: [new cdkpipeline.ManualApprovalStep('production-deployment-approval')],
    });

  }
}