// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { GameLiftStreams } = require('@aws-sdk/client-gameliftstreams');
const { Logger } = require('@aws-lambda-powertools/logger');

const logger = new Logger({ serviceName: 'get-stream-session' });

function defaultHeader() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*'
    };
}

exports.handler = async function(event, context) {
    logger.addContext(context);
    const { sg, arn } = event.pathParameters || {};
    try {

        const gameLiftStreams = new GameLiftStreams();

        let streamSession = await gameLiftStreams.getStreamSession({
            Identifier: decodeURIComponent(sg),
            StreamSessionIdentifier: decodeURIComponent(arn)
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
