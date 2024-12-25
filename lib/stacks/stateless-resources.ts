/**
 * Stateless resources. 
 * Load Balancer, Compute Resources, Deploy Pipelines, Lambda functions.
 * Security Groups, IAM permissions.
 */

import {
  Stack,
  StackProps,
  RemovalPolicy,
  Duration,
  aws_ec2 as ec2,
  aws_lambda as lambda,
  aws_s3 as s3,
  aws_certificatemanager as certificatemanager,
  aws_route53 as route53,
  aws_route53_targets as route53_targets,
  aws_elasticloadbalancingv2 as lbv2,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_logs as logs,
  aws_iam as iam,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as codepipeline_actions,
  aws_codebuild as codebuild,
  aws_codedeploy as codedeploy,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as cloudfront_origins,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { envConstants, commonConstants } from '../parameters/constants';
import { resolveConfig } from '../parameters/env-config';
import * as path from 'path';


interface StatelessResourceProps extends StackProps {
  deployEnv: "dev" | "prod",
  vpc: ec2.Vpc;
  hostZone: route53.HostedZone;
}

export class StatelessResourceStack extends Stack {
  constructor(scope: Construct, id: string, props: StatelessResourceProps) {
    super(scope, id, props);
    const { deployEnv, vpc, hostZone } = props;
    const config = resolveConfig();
    /**
     * Log bucket (in early stage of development, maybe it's best to set DESTROY RemovalPolicy)
     */
    const loggingBucket = new s3.Bucket(this, `logging-bucket-${deployEnv}`, {
      bucketName: `${commonConstants.project}-logging-bucket-${deployEnv}`,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER
    });
    loggingBucket.applyRemovalPolicy(RemovalPolicy.DESTROY);

    /** 
     * Frontend bucket
     */
    const frontendBucket = new s3.Bucket(this, `frontend-bucket-${deployEnv}`, {
      bucketName: `${commonConstants.project}-frontend-bucket-${deployEnv}`,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER
    });
    /**
     * Certs 
     * There is no real good way to get certificate for Cloudfront. See more -> https://github.com/aws/aws-cdk/discussions/23931
     * So, we gonna create it with a deprecated function.
     */
    // const lbCert = new certificatemanager.Certificate(this, `${deployEnv}-${commonConstants.project}-cert`, {
    //   domainName: envConstants[deployEnv].domain,
    //   subjectAlternativeNames: [`*.${envConstants[deployEnv].domain}`],
    //   validation: certificatemanager.CertificateValidation.fromDns(hostZone),
    // });

    const cloudfrontCert = new certificatemanager.DnsValidatedCertificate(this, `${deployEnv}-${commonConstants.project}-cloudfront-cert`, {
      domainName: envConstants[deployEnv].domain,
      subjectAlternativeNames: [`*.${envConstants[deployEnv].domain}`],
      hostedZone: hostZone,
      // the properties below are set for validation in us-east-1
      region: 'us-east-1',
      validation: certificatemanager.CertificateValidation.fromDns(hostZone),
    });

    /**
     * Load balancer
     */
    // const lbSecurityGroup = new ec2.SecurityGroup(this, `${deployEnv}-${commonConstants.project}-lb-security-group`, {
    //   vpc: vpc,
    //   allowAllOutbound: true,
    // });
    // lbSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow inbound traffic on port 80");
    // lbSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "Allow inbound traffic on port 443");

    // const loadBalancer = new lbv2.ApplicationLoadBalancer(this, `${deployEnv}-${commonConstants.project}-lb`, {
    //   loadBalancerName: `${deployEnv}-${commonConstants.project}-lb`,
    //   vpc: vpc,
    //   vpcSubnets: {
    //     subnetType: ec2.SubnetType.PUBLIC,
    //   },
    //   internetFacing: true,
    //   securityGroup: lbSecurityGroup,
    // });
    // loadBalancer.logAccessLogs(loggingBucket, `loadBalancer/${deployEnv}`);

    // //default listener and rule
    // loadBalancer.addListener("listenerHttp", {
    //   port: 80,
    //   defaultAction: lbv2.ListenerAction.redirect({ port: "443", protocol: lbv2.ApplicationProtocol.HTTPS })
    // });

    // const httpsListener = loadBalancer.addListener("listenerHttps", {
    //   port: 443,
    //   protocol: lbv2.ApplicationProtocol.HTTPS,
    //   certificates: [lbCert],
    //   defaultAction: lbv2.ListenerAction.fixedResponse(404, {
    //     contentType: "text/html",
    //     messageBody: "お指定URLをご確認ください！"
    //   }),
    //   sslPolicy: lbv2.SslPolicy.TLS12
    // });

    // /**
    //  * Compute Resource (ECS)
    //  */
    // //Image Repo
    // const apiECRRepo = new ecr.Repository(this, `${deployEnv}-api-ecr-repo`, {
    //   repositoryName: `api-${deployEnv}`,
    //   removalPolicy: RemovalPolicy.DESTROY,
    // });

    // //Cluster
    // const cluster = new ecs.Cluster(this, `${deployEnv}-cluster`, {
    //   vpc: vpc,
    //   clusterName: `${deployEnv}-${commonConstants.project}-cluster`
    // });

    // //Task Definition
    // const taskDefApi = new ecs.FargateTaskDefinition(this, `${deployEnv}-api-task-def`);
    // const taskDefApiLogGroup = new logs.LogGroup(this, `${deployEnv}-Api-logGroup`, { logGroupName: `/${deployEnv}/ecs/Api`, removalPolicy: RemovalPolicy.DESTROY });
    // taskDefApi.addContainer("apiContainer", {
    //   image: ecs.ContainerImage.fromEcrRepository(apiECRRepo),
    //   portMappings: [
    //     {
    //       containerPort: 8888,
    //     },
    //   ],
    //   secrets: {
    //     // DB_PORT: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterAttributes(this, "port_value", { parameterName: `/${deployEnv}/db_port` })),
    //     // DB_USERNAME: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterAttributes(this, "username_value", { parameterName: `/${deployEnv}/db_username` })),
    //     // DB_PASSWORD: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterAttributes(this, "password_value", { parameterName: `/${deployEnv}/db_password` })),
    //     // DB_DATABASE: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromStringParameterAttributes(this, "db_value", { parameterName: `/${deployEnv}/db_database` })),
    //   },
    //   environment: {
    //   },
    //   logging: ecs.LogDrivers.awsLogs({ streamPrefix: `${deployEnv}`, logGroup: taskDefApiLogGroup }),
    // });
    // taskDefApi.addToTaskRolePolicy(new iam.PolicyStatement({
    //   actions: ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
    //   resources: [`*`]
    // }));

    // //Service
    // const apiService = new ecs.FargateService(this, `${deployEnv}-api-service`, {
    //   cluster: cluster,
    //   taskDefinition: taskDefApi,
    //   serviceName: "api-service",
    //   deploymentController: {
    //     type: ecs.DeploymentControllerType.CODE_DEPLOY,
    //   },
    //   desiredCount: 0,
    //   assignPublicIp: true, //if not set, task will be place in private subnet
    // });

    // //Auto Scale (max to 5 task, scale when CPU Reach 70%)
    // const scalableTarget = apiService.autoScaleTaskCount({
    //   minCapacity: 1,
    //   maxCapacity: 5,
    // });

    // scalableTarget.scaleOnCpuUtilization('CpuScaling', {
    //   targetUtilizationPercent: 70,
    // });

    // const apiBlueTg = httpsListener.addTargets(`blue-api-target-${deployEnv}`, {
    //   priority: 1,
    //   port: 8888,
    //   protocol: lbv2.ApplicationProtocol.HTTP,
    //   conditions: [
    //     lbv2.ListenerCondition.hostHeaders([`api.${envConstants[deployEnv].domain}`]),
    //     // cdk.aws_elasticloadbalancingv2.ListenerCondition.pathPatterns(["/api/*"]),
    //   ],
    //   targets: [apiService],
    //   healthCheck: {
    //     path: "/ping"
    //   }
    // });

    // const apiGreenTg = new lbv2.ApplicationTargetGroup(this, `green-api-target-${deployEnv}`, {
    //   vpc: vpc,
    //   port: 8888,
    //   protocol: lbv2.ApplicationProtocol.HTTP,
    //   targetType: lbv2.TargetType.IP,
    //   healthCheck: {
    //     path: "/ping"
    //   },
    // });

    /**
     * Cloudfront Distributions
     */

    //Origin Access Control
    const s3OAC = new cloudfront.S3OriginAccessControl(this, `frontend-s3-oac-${deployEnv}`, {
      signing: cloudfront.Signing.SIGV4_NO_OVERRIDE,
    });

    //Viewer request function
    const frontendFunction = new cloudfront.Function(this, `frontend-replace-fn-${deployEnv}`, {
      functionName: `homepage-html-append-${deployEnv}`,
      code: cloudfront.FunctionCode.fromFile({filePath: path.join(__dirname, "../../assets/cloudfront-fix.mjs")}),
      // Note that JS_2_0 must be used for Key Value Store support
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    //Frontend Distribution
    const frontendCloudfront = new cloudfront.Distribution(this, `frontend-cloudfront-${deployEnv}`, {
      defaultRootObject: 'index.html',
      comment: `Frontend Distribution for ${deployEnv}`,
      defaultBehavior: {
        origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(frontendBucket, {originAccessControl: s3OAC}),
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT_AND_SECURITY_HEADERS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        functionAssociations: [{
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          function: frontendFunction,
        }]
      },
      ...deployEnv === "prod" && {
        enableLogging: true,
        logBucket: loggingBucket,
        logFilePrefix: `cloudfront/${deployEnv}/`,
      },
      certificate: cloudfrontCert,
      domainNames: [envConstants[deployEnv].domain],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200, //include Japan but not all
      // Custom for Frontend Distribution
      // If frontend is a React SPA app hosting in S3, we will needed in including below code (to change behavior when user reload page)
      // errorResponses: [
      //   {
      //     httpStatus: 404,
      //     responseHttpStatus: 200,
      //     responsePagePath: "/index.html",
      //     ttl: Duration.seconds(0),
      //   }
      // ]
    });

    new route53.ARecord(this, `frontend-record-${deployEnv}`, {
      zone: hostZone,
      target: route53.RecordTarget.fromAlias(new route53_targets.CloudFrontTarget(frontendCloudfront)),  
      recordName: envConstants[deployEnv].domain,
    });

    /**
     * Deploy Pipeline
     */

    //Source
    const sourceOutputFrontend = new codepipeline.Artifact();
    const sourceActionFrontend = new codepipeline_actions.CodeStarConnectionsSourceAction({
      actionName: "GithubSource",
      owner: "afterfit",
      branch: envConstants[deployEnv].codeBranch,
      repo: "shirokumapower-corp",
      output: sourceOutputFrontend,
      connectionArn: config.githubConnection
    });

    // /**Lambda function */
    const invalidationLambda = new lambda.Function(this, `${deployEnv}-${commonConstants.project}-invalidate-lambda`, {
      functionName: `cloudfront-invalidation-${deployEnv}`,
      code: lambda.Code.fromAsset("assets", { exclude: ["**", "!invalidation.py"] }),
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: `invalidation.lambda_handler`,
      environment: {
        "env": deployEnv
      },
    });
    invalidationLambda.addToRolePolicy(new iam.PolicyStatement({
      resources: ["*"],
      actions: ["cloudfront:CreateInvalidation"],
    }));

    //Pipeline
    const pipelineFrontend = new codepipeline.Pipeline(this, `homepage-frontend-pipeline-${deployEnv}`, {
      pipelineName: `homepage-frontend-pipeline-${deployEnv}`,
      stages: [
        {
          stageName: "Source",
          actions: [sourceActionFrontend],
        },
        {
          stageName: "S3Deploy",
          actions: [
            new codepipeline_actions.S3DeployAction({
              actionName: "S3Deploy",
              input: sourceOutputFrontend,
              bucket: frontendBucket,
            }),
          ]
        },
        {
          stageName: "CloudfrontInvalidation",
          actions: [
            new codepipeline_actions.LambdaInvokeAction({
              actionName: "CloudfrontInvalidation",
              lambda: invalidationLambda,
              userParameters: ({
                distributionId: frontendCloudfront.distributionId,
                objectPaths: ["/*"]
              }),
            }),
          ]
        }
      ],
      crossAccountKeys: false
    });
    pipelineFrontend.artifactBucket.applyRemovalPolicy(RemovalPolicy.DESTROY);


  }
}
