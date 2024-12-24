#!/usr/bin/env node
import 'source-map-support/register';
import { App, Tags } from 'aws-cdk-lib';

import { resolveConfig } from '../lib/parameters/env-config';
import { AppStage } from '../lib/stages/app-stage';

const app = new App();

const config = resolveConfig();

const infraStatus = app.node.tryGetContext("infraStatus") != undefined ? app.node.tryGetContext("infraStatus") : "on"; 
if (infraStatus !== "on" && infraStatus !== "off") 
  throw new Error('Invalid infra status. Only accept on or off');

// All environments' prefix. This will be supply to resources' name.
const devEnv = "dev";
const stgEnv = "stg";
const prodEnv = "prod";

/**
 * Development Environment
 */
const devStage = new AppStage(app, devEnv, {
  env: {account: config.awsAccount, region: config.region},
  deployEnv: devEnv,
  infraStatus: infraStatus
});
Tags.of(devStage).add("env", devEnv);


/**
 * Production Environment
 */
const prodStage = new AppStage(app, prodEnv, {
  env: {account: config.awsAccount, region: config.region},
  deployEnv: prodEnv,
  infraStatus: "on"
});
Tags.of(prodStage).add("env", prodEnv);