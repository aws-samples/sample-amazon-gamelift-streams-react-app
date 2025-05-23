// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as log from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

export class AmazonGameliftStreamsReactStarterAPIStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // create a Cognito user pool and Userpool Client for the frontend AuthN
        const userPool = new cognito.UserPool(this, 'gamelift-streams-react-starter-user-pool', {
            userPoolName: this.stackName + '-user-pool',
            selfSignUpEnabled: false,
            signInAliases: {
                email: true
            },
            autoVerify: {
                email: true,
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            passwordPolicy: {
                minLength: 8,
                requireDigits: true,
                requireLowercase: true,
                requireSymbols: true,
                requireUppercase: true
            },
            featurePlan: cognito.FeaturePlan.PLUS,
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
        });

        const userPoolClient = new cognito.UserPoolClient(this, 'gamelift-streams-react-starter-user-pool-client', {
            userPool: userPool,
            authFlows: { userPassword: true, userSrp: true },
            refreshTokenValidity: cdk.Duration.hours(8),
            idTokenValidity: cdk.Duration.minutes(5),
            accessTokenValidity: cdk.Duration.minutes(5)
        });

        new cdk.CfnOutput(this, 'gamelift-streams-react-starter-User-Pool-Id', {
            value: userPool.userPoolId
        });
        new cdk.CfnOutput(this, 'gamelift-streams-react-starter-User-Pool-Client-Id', {
            value: userPoolClient.userPoolClientId
        });

        // create RestAPI for the frontend to start and get stream sessions
        // create a Cognito Authorizer for our API
        const auth = new apigateway.CognitoUserPoolsAuthorizer(this, 'gamelift-streams-react-starter-authorized', {
            cognitoUserPools: [userPool]
        });

        const api = new apigateway.RestApi(this, 'gamelift-streams-react-starter-api', {
            restApiName: this.stackName + '-gamelift-streams-react-starter-api',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS
            },
            cloudWatchRole: true
        });

        // add cors header to default 504 response for integration timeouts
        api.addGatewayResponse('gw-timeout-cors-headers', {
            type: apigateway.ResponseType.INTEGRATION_TIMEOUT,
            statusCode: '504',
            responseHeaders: {
                'Access-Control-Allow-Origin': '\'*\'',
                'Access-Control-Allow-Headers': '\'*\'',
                'Access-Control-Allow-Methods': '\'*\''
            }
        });

        // create lambda functions
        const lambdaLogGroup = new log.LogGroup(this, 'gamelift-streams-react-starter-lambda-log-group', {
            logGroupName: this.stackName + '/lambda',
            retention: log.RetentionDays.TEN_YEARS,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });

        const startStreamLambda = new lambda.Function(this, 'gamelift-streams-start-stream-lambda', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'StartStream.handler',
            code: lambda.Code.fromAsset('lambda/StartStream'),
            timeout: cdk.Duration.seconds(10),
            environment: {
                'CONNECTION_TIMEOUT': '10',
            },
            logGroup: lambdaLogGroup,
        });

        startStreamLambda.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['gameliftstreams:StartStreamSession', 'gameliftstreams:GetStreamSession'],
            resources: [`arn:aws:gameliftstreams:*:${this.account}:*`] // hardened to account level
        }));

        // add the lambda as post action
        api.root.addMethod('POST', new apigateway.LambdaIntegration(startStreamLambda, {
            timeout: cdk.Duration.seconds(10)
        }), {
            authorizer: auth,
            authorizationType: apigateway.AuthorizationType.COGNITO
        });

        const session = api.root.addResource('session');
        const sgParam = session.addResource('{sg}');
        const arnParam = sgParam.addResource('{arn}');

        const getStreamLambda = new lambda.Function(this, 'gamelift-streams-get-stream-lambda', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'GetStream.handler',
            code: lambda.Code.fromAsset('lambda/GetStream'),
            timeout: cdk.Duration.seconds(10),
            logGroup: lambdaLogGroup
        });

        getStreamLambda.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['gameliftstreams:GetStreamSession'],
            resources: [`arn:aws:gameliftstreams:*:${this.account}:*`] // hardened to account level
        }));

        arnParam.addMethod('GET', new apigateway.LambdaIntegration(getStreamLambda), {
            authorizer: auth,
            authorizationType: apigateway.AuthorizationType.COGNITO
        });

        // outputs
        const endpointUrl = api.urlForPath('/');
        new cdk.CfnOutput(this, 'Endpoint', {
            value: endpointUrl.endsWith('/') ? endpointUrl.slice(0, -1) : endpointUrl  // remove trailing slash
        });


        /**
        * Nag Suppressions
        */
        NagSuppressions.addResourceSuppressions(userPool, [
            {
                id: "AwsSolutions-COG2",
                reason: "MFA not required for this sample. Recommendation to add MFA in best practice docs."
            },
            {
                id: "AwsSolutions-COG3",
                reason: "Advanced security features are not required for this sample application. In production, it is recommended to enable advanced security features."
            }
        ], true);

        NagSuppressions.addResourceSuppressions(api, [
            {
                id: 'AwsSolutions-APIG4',
                reason: 'CORS Preflight Resource, does not require authorizer',
            },
            {
                id: 'AwsSolutions-COG4',
                reason: 'CORS Preflight Resource, does not require authorizer'
            },
            {
                id: 'AwsSolutions-IAM4',
                reason: 'API Gateway REST API is using the Amazon Managed Policy: service-role/AmazonAPIGatewayPushToCloudWatchLogs.',
            },
            {
                id: 'AwsSolutions-APIG2',
                reason: 'API Gateway REST API methods.',
            },
            {
                id: 'AwsSolutions-APIG1',
                reason: 'Access logging is not required for this sample application. In production, enable access logging for audit purposes.'
            },
            {
                id: 'AwsSolutions-APIG3',
                reason: 'WAF is not required for this sample application. In production, implement WAF for additional security.'
            },
            {
                id: 'AwsSolutions-APIG6',
                reason: 'CloudWatch logging is not required for this sample application. In production, enable CloudWatch logging for all methods.'
            }
        ], true);
  
        NagSuppressions.addResourceSuppressions(startStreamLambda, [
            {
                id: "AwsSolutions-IAM5",
                reason: "startStreamLambda uses IAM RolePolicy that contains wildcard, but hardened to account level least priviledge."
            },
            {
                id: 'AwsSolutions-IAM4',
                reason: 'Using AWS Lambda Basic Execution Role is acceptable for this sample application. In production, consider using custom IAM policies.',
                appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']
            }
        ], true);

        NagSuppressions.addResourceSuppressions(getStreamLambda, [
            {
                id: "AwsSolutions-IAM5",
                reason: "getStreamLambda uses IAM RolePolicy that contains wildcard, but hardened to account level least priviledge."
            },
            {
                id: 'AwsSolutions-IAM4',
                reason: 'Using AWS Lambda Basic Execution Role is acceptable for this sample application. In production, consider using custom IAM policies.',
                appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']
            }
        ], true);

    }
}
