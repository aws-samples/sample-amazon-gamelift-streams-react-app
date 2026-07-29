import React, { useState, useRef, useCallback, useEffect } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { get, post } from 'aws-amplify/api';
import { isIOS, enterFullscreen, exitFullscreen, isLandscape } from './platform';
import { VirtualGamepad } from './VirtualGamepad';
import GamepadOverlay from './GamepadOverlay';
import RotatePrompt from './RotatePrompt';
import './StreamView.css';

// Import GameLift Streams Web SDK -- update version as needed
import * as gameliftstreamssdk from './gamelift-streams-websdk/gameliftstreams-1.2.0';

type StreamState = 'SETUP' | 'CONNECTING' | 'ACTIVE';

interface Props {
  signOut: () => void;
  user: any;
}

/**
 * Mobile stream view with two visual modes:
 * - SETUP: form inputs visible, video hidden
 * - CONNECTING/ACTIVE: video fills viewport, form hidden
 *
 * The video and audio elements are ALWAYS mounted so the SDK reference
 * remains valid across state transitions.
 */
export default function StreamView({ signOut, user }: Props) {
  const [state, setState] = useState<StreamState>('SETUP');
  const [sgId, setSgId] = useState('');
  const [appId, setAppId] = useState('');
  const [region, setRegion] = useState('us-west-2');
  const [error, setError] = useState('');
  const [landscape, setLandscape] = useState(isLandscape());

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const sdkRef = useRef<any>(null);
  const gamepadRef = useRef<VirtualGamepad>(new VirtualGamepad());
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Track orientation changes
  useEffect(() => {
    const handler = () => setLandscape(isLandscape());
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
      sdkRef.current?.close();
    };
  }, []);

  const getAuthToken = async (): Promise<string> => {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() || '';
  };

  const initSDK = useCallback(() => {
    if (!videoRef.current || !audioRef.current) return;
    sdkRef.current = new gameliftstreamssdk.GameLiftStreams({
      videoElement: videoRef.current,
      audioElement: audioRef.current,
      inputConfiguration: {
        setCursor: 'visibility',
        autoPointerLock: false,
        autoGamepad: true, // Detects physical controllers; virtual gamepad is managed manually via addGamepad/processGamepads
      }
    });
  }, []);

  const startStream = async () => {
    if (!sgId || !appId) { setError('Stream Group ID and App ID required'); return; }
    setError('');
    setState('CONNECTING');
    initSDK();

    // Unlock audio on iOS -- must happen in user gesture context (this tap)
    // Playing a silent/empty audio element pre-authorizes it for later use
    audioRef.current?.play().catch(() => {});

    try {
      const signalRequest = await sdkRef.current.generateSignalRequest();
      const token = await getAuthToken();
      const response = await post({
        apiName: 'GameLiftStreamsAPI',
        path: '/',
        options: {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: {
            AppIdentifier: appId,
            SGIdentifier: sgId,
            SignalRequest: signalRequest,
            Regions: [region],
          }
        }
      }).response;
      const data: any = await response.body.json();

      if (data.status === 'ACTIVE') {
        await activateStream(data.signalResponse);
      } else {
        pollForActive(data.arn);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to start stream');
      setState('SETUP');
    }
  };

  const pollForActive = (arn: string) => {
    let elapsed = 0;
    const poll = async () => {
      if (elapsed > 600) { setError('Stream activation timeout'); setState('SETUP'); return; }
      try {
        const token = await getAuthToken();
        const response = await get({
          apiName: 'GameLiftStreamsAPI',
          path: `/session/${encodeURIComponent(sgId)}/${encodeURIComponent(arn)}`,
          options: { headers: { Authorization: `Bearer ${token}` } }
        }).response;
        const data: any = await response.body.json();
        if (data.status === 'ACTIVE') {
          await activateStream(data.signalResponse);
        } else {
          elapsed++;
          pollingRef.current = setTimeout(poll, 1000);
        }
      } catch (e: any) {
        setError(e.message || 'Polling failed');
        setState('SETUP');
      }
    };
    poll();
  };

  const activateStream = async (signalResponse: string) => {
    await sdkRef.current.processSignalResponse(signalResponse);
    sdkRef.current.attachInput();
    sdkRef.current.addGamepad(gamepadRef.current);
    // Ensure audio plays on iOS -- must be triggered from user gesture context
    // The audio track may not be attached yet, so also listen for loadedmetadata
    const audio = audioRef.current;
    if (audio) {
      audio.play().catch(() => {});
      audio.onloadedmetadata = () => { audio.play().catch(() => {}); };
    }
    enterFullscreen(videoRef.current!);
    setState('ACTIVE');
  };

  const stopStream = () => {
    if (pollingRef.current) clearTimeout(pollingRef.current);
    exitFullscreen();
    sdkRef.current?.close();
    sdkRef.current = null;
    setState('SETUP');
  };

  const handleGamepadInput = useCallback(() => {
    sdkRef.current?.processGamepads();
  }, []);

  const streaming = state !== 'SETUP';

  return (
    <div className="stream-view">
      {/* Setup form -- hidden during streaming */}
      {!streaming && (
        <div className="setup-screen">
          <h2>GameLift Streams Mobile</h2>
          <input placeholder="Stream Group ID" value={sgId} onChange={e => setSgId(e.target.value)} />
          <input placeholder="Application ID" value={appId} onChange={e => setAppId(e.target.value)} />
          <select value={region} onChange={e => setRegion(e.target.value)}>
            <option value="us-east-1">US East (N. Virginia)</option>
            <option value="us-east-2">US East (Ohio)</option>
            <option value="us-west-2">US West (Oregon)</option>
            <option value="ap-south-1">Asia Pacific (Mumbai)</option>
            <option value="ap-northeast-2">Asia Pacific (Seoul)</option>
            <option value="ap-southeast-2">Asia Pacific (Sydney)</option>
            <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
            <option value="eu-central-1">Europe (Frankfurt)</option>
            <option value="eu-west-1">Europe (Ireland)</option>
            <option value="eu-west-2">Europe (London)</option>
            <option value="eu-north-1">Europe (Stockholm)</option>
            <option value="sa-east-1">South America (São Paulo)</option>
          </select>
          <button onClick={startStream}>Start Stream</button>
          {error && <p className="error">{error}</p>}
          <button className="signout" onClick={signOut}>Sign Out</button>
        </div>
      )}

      {/* Video/audio always mounted -- SDK holds reference to these elements */}
      <div className={`stream-screen ${streaming ? 'visible' : ''}`}>
        {streaming && !landscape && <RotatePrompt />}
        <video ref={videoRef} className="stream-video" playsInline autoPlay muted />
        <audio ref={audioRef} autoPlay />
        {state === 'CONNECTING' && <div className="connecting-overlay">Connecting...</div>}
        {state === 'ACTIVE' && landscape && (
          <GamepadOverlay gamepad={gamepadRef.current} onInput={handleGamepadInput} />
        )}
        {streaming && <button className="stop-btn" onClick={stopStream}>✕</button>}
      </div>
    </div>
  );
}
