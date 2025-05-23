// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { SecurityPolicyProtocol, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';

export class AmazonGameliftStreamsReactStarterFrontendStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const websiteBucket = new s3.Bucket(this, 'amazon-gamelift-streams-react-starter-frontend-WebsiteBucket', {
            removalPolicy: RemovalPolicy.DESTROY,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            autoDeleteObjects: true,
            enforceSSL: true,
            versioned: true
        });

        const acl = this.createWebACL();

        const distribution = new cloudfront.Distribution(this, 'amazon-gamelift-streams-react-starter-frontend-distribution', {
            comment: 'GameLift-Streams Demo Distribution',
            defaultBehavior: {
                origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
                viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY
            },
            defaultRootObject: 'index.html',
            minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
            enableLogging: true,
            webAclId: acl.attrArn,
            geoRestriction: cloudfront.GeoRestriction.allowlist(
                // North America
                'US', 'CA', 'MX',
                // Europe
                'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 
                'SE', 'NO', 'DK', 'FI', 'IE',
                // Asia Pacific
                'JP', 'KR', 'SG', 'AU', 'NZ', 'IN',
                // South America
                'BR', 'AR',
                // Middle East
                'AE', 'SA'
            ),
        });

        new s3deploy.BucketDeployment(this, 'amazon-gamelift-streams-react-starter-frontend-DeployWebsite', {
            sources: [s3deploy.Source.asset('./amazon-gamelift-streams-react-starter-frontend/build')],
            destinationBucket: websiteBucket,
            distribution: distribution
        });

        new cdk.CfnOutput(this, 'CloudFront-Domain', {
            value: distribution.domainName
        });

        /**
        * Nag Suppressions
        */
    
        NagSuppressions.addStackSuppressions(this, [
        {
            id: "AwsSolutions-IAM4",
            reason: "CDK BucketDeployment Construct adds the Amazon Managed IAM role, AWSLambdaBasicExecutionRole, to the deployment Lambda Function.",
        },
        {
            id: "AwsSolutions-IAM5",
            reason: "BucketDeployment Function requires access to list buckets in account and region",
        },
        {
            id: "AwsSolutions-S1",
            reason: "Server access logs are not required for this demo project's website bucket",
        },
        {
            id: "AwsSolutions-S10",
            reason: "SSL requirement is managed by CloudFront for the logging bucket",
        },
        {
            id: "AwsSolutions-CFR4",
            reason: "Using default CloudFront viewer certificate for this demo project. While TLS_V1_2_2021 is set as minimum protocol version, the default certificate allows older TLS versions. This is acceptable for demonstration purposes.",
        },
        {
            id: "AwsSolutions-L1",
            reason: "Lambda runtime version is managed by the CDK BucketDeployment construct",
        }
        ], true);

        // Add suppressions for the CloudFront logging bucket
        if (distribution.node.tryFindChild('LoggingBucket')) {
            NagSuppressions.addResourceSuppressions(
                distribution.node.findChild('LoggingBucket') as s3.Bucket,
                [{
                    id: "AwsSolutions-S1",
                    reason: "Server access logs are not required for CloudFront logging bucket in this demo project",
                }],
                true
            );
        }
        
    }

    private createWebACL() {
        // create a basic ACL with AWSManagedRulesCommonRuleSet and AWSManagedRulesAmazonIpReputationList
        // basic rule https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-list.html
        const acl = new wafv2.CfnWebACL(this, 'GameLift-Streams-Demo-Frontend-cf-waf', {
            defaultAction: { allow: {} },
            scope: 'CLOUDFRONT',
            visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: 'MetricForGameLiftStreamsCF-ACL',
                sampledRequestsEnabled: true
            },
            name: this.stackName + 'GameLift-Streams-Demo-Frontend-cf-waf',
            rules: [{
                name: 'CRSRule',
                priority: 0,
                statement: {
                    managedRuleGroupStatement: {
                        name: 'AWSManagedRulesCommonRuleSet',
                        vendorName: 'AWS'
                    }
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: 'MetricForGameLiftStreamsCF-CRS',
                    sampledRequestsEnabled: true
                },
                overrideAction: {
                    none: {}
                }
            }, {
                name: 'IpReputation',
                priority: 1,
                statement: {
                    managedRuleGroupStatement: {
                        name: 'AWSManagedRulesAmazonIpReputationList',
                        vendorName: 'AWS'
                    }
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: 'MetricForGameLiftStreamsCF-IpReputation',
                    sampledRequestsEnabled: true
                },
                overrideAction: {
                    none: {}
                }
            }, {
                name: 'throttle-extensive-users',
                priority: 2,
                statement: {
                    rateBasedStatement: {
                        aggregateKeyType: 'IP',
                        limit: 100,
                        evaluationWindowSec: 60
                    }
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    sampledRequestsEnabled: true,
                    metricName: 'MetricForGameLiftStreamsCF-ThrottleExtensiveUsers'
                },
                action: {
                    block: {}
                }
            }]
        });

        acl.addDeletionOverride(cdk.RemovalPolicy.DESTROY);
        return acl;
    }
}
