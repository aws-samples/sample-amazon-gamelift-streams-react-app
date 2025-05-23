// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const path = require('path');
const { runCommand, rootdir } = require('./utils.js');

async function execute() {
    console.info('Installing Root Dependencies...');

    // Install node modules within root directory
    await runCommand('npm install', rootdir);

    // Install node modules within web frontend directory
    console.info('Installing Frontend Dependencies...');
    const frontendPath = path.join(rootdir, 'amazon-gamelift-streams-react-starter-frontend');
    await runCommand('npm install', frontendPath);
    // Create directories
    await runCommand('mkdir build', frontendPath);
    await runCommand('mkdir gamelift-streams-websdk', frontendPath + '/src');

    console.info('Installing Lambda Dependencies...');
    // Install node modules within lambda directories
    const startStreamPath = path.join(rootdir, 'lambda/StartStream');
    await runCommand('npm install', startStreamPath);
    const getStreamPath = path.join(rootdir, 'lambda/GetStream');
    await runCommand('npm install', getStreamPath);
}

execute();
