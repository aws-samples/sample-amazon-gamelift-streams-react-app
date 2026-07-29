import React from 'react';
import './RotatePrompt.css';

/**
 * Shown when device is in portrait orientation.
 * We prompt rotation instead of CSS-rotating the UI because CSS transforms
 * break touch coordinate mapping for game streaming input.
 */
export default function RotatePrompt() {
  return (
    <div className="rotate-prompt">
      <div className="rotate-icon">📱↻</div>
      <p>Please rotate your device to landscape</p>
    </div>
  );
}
