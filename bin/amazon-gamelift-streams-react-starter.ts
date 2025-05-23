#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0


import * as cdk from 'aws-cdk-lib';
import { AmazonGameliftStreamsReactStarterAPIStack } from '../lib/amazon-gamelift-streams-react-starter-api-stack';
import {
    AmazonGameliftStreamsReactStarterFrontendStack
} from '../lib/amazon-gamelift-streams-react-starter-frontend-stack';
import { AwsSolutionsChecks } from 'cdk-nag';

const app = new cdk.App();

new AmazonGameliftStreamsReactStarterAPIStack(app, 'AmazonGameliftStreamsReactStarterAPIStack', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});

// the frontend deployment need to happen in us-east-1 so that the WAF for CloudFront is deployed to us-east-1
new AmazonGameliftStreamsReactStarterFrontendStack(app, 'AmazonGameliftStreamsReactStarterFrontendStack', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' }
});

// cdk-nag report
cdk.Aspects.of(app).add(new AwsSolutionsChecks());