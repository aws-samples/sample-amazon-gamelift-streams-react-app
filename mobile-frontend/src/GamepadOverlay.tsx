import React, { useCallback } from 'react';
import { Joystick } from 'react-joystick-component';
import { VirtualGamepad } from './VirtualGamepad';
import './GamepadOverlay.css';

interface Props {
  gamepad: VirtualGamepad;
  onInput: () => void;
}

/**
 * Virtual controller overlay for touch devices.
 * Left joystick = axes 0,1 (left stick)
 * Right joystick = axes 2,3 (right stick)
 * A/B buttons = button indices 0,1 (standard gamepad face buttons)
 */
export default function GamepadOverlay({ gamepad, onInput }: Props) {
  const handleLeftMove = useCallback((e: any) => {
    gamepad.setAxis(0, e.x);
    gamepad.setAxis(1, -e.y); // Invert Y (joystick component Y is inverted)
    onInput();
  }, [gamepad, onInput]);

  const handleLeftStop = useCallback(() => {
    gamepad.setAxis(0, 0);
    gamepad.setAxis(1, 0);
    onInput();
  }, [gamepad, onInput]);

  const handleRightMove = useCallback((e: any) => {
    gamepad.setAxis(2, e.x);
    gamepad.setAxis(3, -e.y);
    onInput();
  }, [gamepad, onInput]);

  const handleRightStop = useCallback(() => {
    gamepad.setAxis(2, 0);
    gamepad.setAxis(3, 0);
    onInput();
  }, [gamepad, onInput]);

  const handleButtonDown = useCallback((index: number) => {
    gamepad.setButton(index, true);
    onInput();
  }, [gamepad, onInput]);

  const handleButtonUp = useCallback((index: number) => {
    gamepad.setButton(index, false);
    onInput();
  }, [gamepad, onInput]);

  return (
    <div className="gamepad-overlay">
      <div className="joystick-left">
        <Joystick size={100} baseColor="rgba(255,255,255,0.1)" stickColor="rgba(255,255,255,0.4)"
          move={handleLeftMove} stop={handleLeftStop} />
      </div>
      <div className="joystick-right">
        <Joystick size={100} baseColor="rgba(255,255,255,0.1)" stickColor="rgba(255,255,255,0.4)"
          move={handleRightMove} stop={handleRightStop} />
      </div>
      <div className="action-buttons">
        <button className="btn-a"
          onTouchStart={() => handleButtonDown(0)} onTouchEnd={() => handleButtonUp(0)}>A</button>
        <button className="btn-b"
          onTouchStart={() => handleButtonDown(1)} onTouchEnd={() => handleButtonUp(1)}>B</button>
      </div>
    </div>
  );
}
