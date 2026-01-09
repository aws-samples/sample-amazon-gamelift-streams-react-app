// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { GameLiftStreams } = require('@aws-sdk/client-gameliftstreams');
const { Logger } = require('@aws-lambda-powertools/logger');
const logger = new Logger({ serviceName: 'start-stream-session' });

function defaultHeader() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*'
    };
}

exports.handler = async function(event, context) {
    logger.addContext(context);

    const body = JSON.parse(event.body);
    try {

        const gameLiftStreams = new GameLiftStreams();

        let streamSession = await gameLiftStreams.startStreamSession({
            Identifier: body.SGIdentifier,
            ApplicationIdentifier: body.AppIdentifier,
            Protocol: 'WebRTC', // current only supported Value
            UserId: body.UserId,
            SignalRequest: body.SignalRequest,
            ConnectionTimeoutSeconds: Number(process.env.CONNECTION_TIMEOUT || 120),
            Locations: body.Regions,
            PerformanceStatsConfiguration: {
                SharedWithClient: true  // Enable Stats Overlay
            }

            // If desired, can pass Launch Arguments and Environment Variables to your executable here.
            // AdditionalLaunchArgs: [ "string" ],
            // "AdditionalEnvironmentVariables": {  "string" : "string" }
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                ...defaultHeader()
            },
            body: JSON.stringify({
                signalResponse: streamSession.SignalResponse ?? '',
                arn: streamSession.Arn,
                region: streamSession.Location,
                status: streamSession.Status
            })
        };
    } catch (e) {
        logger.error('Something went wrong: ', e);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                ...defaultHeader()
            },
            body: JSON.stringify({ 'message': e.message })
        };
    }
};
