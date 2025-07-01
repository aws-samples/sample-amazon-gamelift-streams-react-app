// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import './StreamComponent.css';
import * as gameliftstreamssdk from './gamelift-streams-websdk/gameliftstreams-1.0.0';
import { ApiError, get, post } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import NavBar from './NavBar';

interface StreamComponentProps {
    signOut: any;
    user: any;
}

export enum StreamState {
    STOPPED = 1,
    LOADING,
    RUNNING,
    ERROR
}

interface StreamComponentState {
    status: StreamState;
    sgId: string;
    appId: string;
    sessionId: string;
    lastSessionId: string;
    regions: string[];
    inputEnabled: boolean;
    isStreamStarting: boolean;
}

class StreamComponent extends React.Component<StreamComponentProps, StreamComponentState> {
    gameliftstreams?: gameliftstreamssdk.GameLiftStreams;

    constructor(props: StreamComponentProps) {
        super(props);

        this.state = {
            status: StreamState.STOPPED,
            sgId: '',
            appId: '',
            sessionId: '',
            lastSessionId: '',
            regions: ['us-west-2'], // Must be supported Amazon GameLift Streams primary region (https://docs.aws.amazon.com/gameliftstreams/latest/developerguide/regions-quotas-rande.html)
            inputEnabled: false,
            isStreamStarting: false
        };

        this.createStreamSession = this.createStreamSession.bind(this);
        this.createStreamSessionConnection = this.createStreamSessionConnection.bind(this);
        this.closeConnection = this.closeConnection.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleRegionChange = this.handleRegionChange.bind(this);
        this.enableFullScreen = this.enableFullScreen.bind(this);
    }

    componentDidMount(): void {
        this.resetGameLiftStreamsSDK();
    }

    private resetGameLiftStreamsSDK() {
        this.gameliftstreams = new gameliftstreamssdk.GameLiftStreams({
            videoElement: this.getVideoElement(),
            audioElement: this.getAudioElement(),
            inputConfiguration: {
                setCursor: 'visibility',
                autoPointerLock: 'fullscreen'
            },
            clientConnection: {
                /*
                // Connection callback handlers available if needed
                connectionState: this.streamConnectionStateCallback,
                channelError: this.streamChannelErrorCallback,
                serverDisconnect: this.streamServerDisconnectCallback
                */
            }
        });
    }

    private getVideoElement(): HTMLVideoElement {
        return document.getElementById(`StreamVideoElement`) as HTMLVideoElement;
    }

    private getAudioElement(): HTMLAudioElement {
        return document.getElementById(`StreamAudioElement`) as HTMLAudioElement;
    }

    /**
     * Sets the state for any kind of error - unwraps if error is of type ApiError.
     */
    private handleError(e: any) {
        console.log(e);
        if (e instanceof ApiError) {
            if (e.response) {
                const { statusCode, body } = e.response;
                const data = JSON.parse(body ?? '');
                this.setState({ isStreamStarting: false });
                console.error(`Received ${statusCode} error response with payload: ${body}`);
                alert(`Error: ${statusCode} - ${data.message || 'Unknown error'}. Check console for details.`);
            }
        } else {
            this.setState({ isStreamStarting: false });
            alert(`Error: ${e.message || 'Unknown error'}. Check console for details.`);
        }
    }

    /**
     * Sets timeout error in state.
     */
    private handleTimeout(arn: string) {
        const message = `Timeout in waiting for Stream Session: ${arn}`;
        console.error(`Polling timed out, ` + message);
        alert('Error: Stream session creation timed out. Check console for details.');
    }

    /**
     * Creates a new stream session using StartStream Lambda and then waits for it to be ready using @waitForACTIVE
     */
    private async createStreamSession() {
        this.setState({ isStreamStarting: true });
        const signalRequest = await this.gameliftstreams?.generateSignalRequest();
        const payload = {
            AppIdentifier: this.state.appId,
            SGIdentifier: this.state.sgId,
            SignalRequest: signalRequest ?? '',
            Regions: this.state.regions
        };

        try {
            const restOperation = post({
                apiName: 'demo-api',
                path: '/',
                options: {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${(await fetchAuthSession()).tokens?.idToken?.toString()}`
                    },
                    body: payload
                }
            });
            const { body } = await restOperation.response;
            const data = JSON.parse(await body.text());
            await this.waitForACTIVE(data.arn, this.state.sgId);
        } catch (e) {
            this.handleError(e);
        }
    }

    /**
     * Creates a new stream session using StartStream Lambda and then waits for it to be ready using @waitForACTIVE
     */
    private async createStreamSessionConnection() {
        this.setState({ isStreamStarting: true });
        const signalRequest = await this.gameliftstreams?.generateSignalRequest();
        const payload = {
            SessionIdentifier: this.state.sessionId,
            SignalRequest: signalRequest ?? '',
        };
        console.log(payload);

        try {
            const restOperation = post({
                apiName: 'demo-api',
                path: '/reconnect',
                options: {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${(await fetchAuthSession()).tokens?.idToken?.toString()}`
                    },
                    body: payload
                }
            });
            const { body } = await restOperation.response;
            const data = JSON.parse(await body.text());
            await this.startStream(data.signalResponse);
        } catch (e) {
            this.handleError(e);
        }
    }

    /**
     * Waits for a stream session to be ready, polling a new stream sessions every second until its ready or times out.
     * This is more effective than having a Lambda function waiting for the session and potentially timing out.
     * This also allows for OnDemand scaling to work if a new session takes 30+ seconds to be ready.
     */
    async waitForACTIVE(arn: string, sg: string, timeoutMs: number = 600000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) { // while not timedout
            console.log(`Waiting for stream session: ${arn}`);
            try {
                const restOperation = get({
                    apiName: 'demo-api',
                    path: `/session/${encodeURIComponent(sg)}/${encodeURIComponent(arn)}`,
                    options: {
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${(await fetchAuthSession()).tokens?.idToken?.toString()}`
                        }
                    }
                });
                const { body } = await restOperation.response;
                const data = JSON.parse(await body.text());

                if (data.status === 'ACTIVE') { // the session is ACTIVE and we can connect
                    await this.startStream(data.signalResponse);
                    this.setState((prevState) => ({
                        ...prevState,
                        lastSessionId: arn
                    }));
                    return; // session is started, state is set for it so we can return
                }
                // else we wait for 1s and loop again
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                this.handleError(e);
                this.setState({ isStreamStarting: false });
                return;
            }
        }
        // timed out
        this.handleTimeout(arn);
        this.setState({ isStreamStarting: false });
    }

    private async startStream(signalResponse) {
        await this.gameliftstreams?.processSignalResponse(signalResponse);
        this.gameliftstreams?.attachInput();
        this.setState((prevState) => ({
            ...prevState,
            status: StreamState.RUNNING,
            isStreamStarting: false,
        }));
    }

    /**
     * Closes the connection and creates a new Amazon GameLift Streams Object as it can't be reused.
     */
    private closeConnection() {
        this.setState({status: StreamState.STOPPED, inputEnabled: false});
        this.gameliftstreams?.close();
        this.resetGameLiftStreamsSDK();
        this.setState({ isStreamStarting: false });

        if (document.fullscreenElement) {
            document.exitFullscreen().then();
        }
    }

    private enableFullScreen() {
        const element = this.getVideoElement()
        if (element) {
            this.gameliftstreams?.attachInput()
            this.setState({inputEnabled: true})
            element.requestFullscreen();
            // Use Keyboard API to set a "long hold" escape from fullscreen
            // if the browser supports this API (note that Safari does not)

            // @ts-ignore
            if (navigator.keyboard) {
                // @ts-ignore
                const keyboard = navigator.keyboard;
                keyboard.lock(["Escape"]);
            }
        }
    }

    private handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = event.target; // Extract name and value from input
        this.setState((prevState) => ({ ...prevState, [name]: value.trim() })); // Dynamically update state
    }

    private handleRegionChange(event: React.ChangeEvent<HTMLSelectElement>) {
        const region = event.target.value;
        this.setState((prevState) => ({
            ...prevState,
            regions: [region] // Update the regions array with the selected region
        }));
    }

    render() {
        return (
            <>
                {/* NavBar - Title and Sign Out */}
                <NavBar user={this.props.user} signOut={this.props.signOut} />

                {/* Input Fields and Buttons */}
                <div style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    padding: '0 20px',
                    marginTop:'20px',
                    flexWrap: 'wrap'
                }}>
                    <div>
                        Stream Group ID: <input type="text" name="sgId" onChange={this.handleInputChange}></input>
                    </div>
                    <div>
                        Application ID: <input type="text" name="appId" onChange={this.handleInputChange}></input>
                    </div>
                    <div>
                        Region: <select onChange={this.handleRegionChange} value={this.state.regions[0]}>
                            <option value="ap-northeast-1">ap-northeast-1 (Tokyo)</option>
                            <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
                            <option value="eu-west-1">eu-west-1 (Ireland)</option>
                            <option value="us-east-1">us-east-1 (N. Virginia)</option>
                            <option value="us-east-2">us-east-2 (Ohio)</option>
                            <option value="us-west-2">us-west-2 (Oregon)</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <button
                            onClick={this.state.status !== StreamState.RUNNING ? this.createStreamSession : this.closeConnection}>
                            {this.state.status !== StreamState.RUNNING ? 'Start Stream' : 'End Stream'}
                        </button>
                        {this.state.isStreamStarting && <div className="spinner" />}
                    </div>
                    <div>
                        Stream Session ID: <input type="text" name="sessionId" onChange={this.handleInputChange}></input>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <button
                            onClick={this.createStreamSessionConnection}>
                            Reconnect
                        </button>
                        {this.state.isStreamStarting && <div className="spinner" />}
                    </div>
                    {this.state.status !== StreamState.RUNNING ? null :
                        <div className="fullscreen">
                            <button
                                className={'fullscreen-button'}
                                onClick={this.enableFullScreen}
                                disabled={this.state.status !== StreamState.RUNNING}
                            >Fullscreen</button>
                        </div>
                    }
                    {
                        this.state.lastSessionId === '' ? null :
                        <div>
                            Last Session ID: {this.state.lastSessionId}
                        </div>
                    }
                </div>

                {/* Amazon GameLift Streams Video Element */}
                <div style={{
                    width: '100vw',
                    overflow: 'hidden',
                    position: 'relative',
                    marginLeft: 'calc(-50vw + 50%)',
                    marginRight: 'calc(-50vw + 50%)',
                    padding: '20px'
                }}>
                    <video
                        id={'StreamVideoElement'}
                        autoPlay 
                        playsInline 
                        style={{
                            width: '100%',
                            height: 'auto',
                            display: 'block'
                        }}
                    />
                    <audio id={'StreamAudioElement'} autoPlay></audio>
                </div>
            </>
        );
    }
}

export default StreamComponent;
