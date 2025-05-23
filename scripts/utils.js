// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { exec } = require('node:child_process');
const path = require('path');

const dirname = path.dirname(process.argv[1]);
const rootdir = path.dirname(path.dirname(process.argv[1]));

async function runCommand(command, path) {
    const p = exec(command, { cwd: path });
    return new Promise((resolve) => {
        p.stdout.on('data', (x) => {
            process.stdout.write(x.toString());
        });

        p.stderr.on('data', (x) => {
            process.stderr.write(x.toString());
        });

        p.on('exit', (code) => {
            resolve(code);
        });
    });
}

module.exports = {
    dirname,
    rootdir,
    runCommand
};
