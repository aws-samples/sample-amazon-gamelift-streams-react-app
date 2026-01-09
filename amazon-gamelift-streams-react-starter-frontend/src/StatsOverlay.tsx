// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * This component uses forwardRef + useImperativeHandle to expose specific methods
 * to the parent component while keeping internal state encapsulated. This allows the component to stay self-contained, 
 * reusable and easy to take out if desired. This Avoids complex prop drilling.
 */

import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import './StatsOverlay.css';

// Interface for network-related streaming stats
interface NetworkStats {
  rtt?: number;           // Round-trip time in milliseconds
  jitter?: number;        // Network jitter in milliseconds
  bitrate?: string;       // Data bitrate in mbps
}

// Props interface for the StatsOverlay component
interface StatsOverlayProps {
  gameliftstreams?: any;    // GameLift Streams SDK instance for fetching RTC stats
  perfStats?: any;          // Performance statistics from the streaming session
  isStreamRunning?: boolean; // Whether the stream is currently active
}

// Interface for component methods exposed via forwardRef
export interface StatsOverlayRef {
  toggleStats: () => void;  // Method to show/hide the stats overlay
  isVisible: boolean;         // Current visibility state
}

/**
 * StatsOverlay component displays real-time streaming stats including:
 * - Client FPS (frames per second), Application CPU/Memory usage (normalized)
 * - System-level resource utilization (CPU, Memory, GPU, VRAM) and Network stats (RTT, jitter, bitrate)
 */
const StatsOverlay = forwardRef<StatsOverlayRef, StatsOverlayProps>(({
  gameliftstreams,
  perfStats = {},
  isStreamRunning = false
}, ref) => {
  // State for controlling overlay visibility
  const [isVisible, setIsVisible] = useState(true);
  
  // State for storing network-specific stats (calculated from RTC stats)
  const [networkStats, setNetworkStats] = useState<NetworkStats>({});
  
  // State for storing current frame rate
  const [frameRate, setFrameRate] = useState<number | undefined>(undefined);
  
  // Ref to track the stats polling interval
  const statsIntervalRef = useRef<NodeJS.Timer | null>(null);
  
  // Refs for calculating bitrate (requires comparing current vs previous values)
  const previousBytesReceivedRef = useRef<number>(0);
  const previousTimestampRef = useRef<number>(0);

  /**
   * Toggles the visibility of the stats overlay and manages stats collection.
   * When shown, starts polling for stats; when hidden, stops polling to save resources.
   */
  const toggleStats = () => {
    const newVisibility = !isVisible;
    setIsVisible(newVisibility);
    
    if (newVisibility) {
      startStatsLogging();
    } else {
      stopStatsLogging();
    }
  };

  // Expose methods to parent components via forwardRef
  useImperativeHandle(ref, () => ({
    toggleStats,
    isVisible
  }));

  /**
   * Starts polling for WebRTC statistics every second.
   * Clears any existing interval to prevent multiple timers running simultaneously.
   */
  const startStatsLogging = () => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }
    
    // Poll RTC stats every 1000ms (1 second)
    statsIntervalRef.current = setInterval(async () => {
      if (gameliftstreams && isVisible) {
        try {
          const stats = await gameliftstreams.getVideoRTCStats();
          processStats(stats);
        } catch (error) {
          console.error('Stats error:', error);
        }
      }
    }, 1000);
  };

  /**
   * Stops the stats polling interval to prevent unnecessary API calls
   * and reduce resource consumption when stats are not visible.
   */
  const stopStatsLogging = () => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  };

  /**
   * Processes WebRTC statistics to extract relevant stats.
   * Handles two main types of reports: inbound-rtp and candidate-pair.
   */
  const processStats = (stats: any) => {
    // Initialize tracking variables for bitrate calculation if not set
    if (!previousBytesReceivedRef.current) {
      previousBytesReceivedRef.current = 0;
      previousTimestampRef.current = Date.now();
    }

    const newNetworkStats = { ...networkStats };
    let newFrameRate = frameRate;

    // Process each stat report from the WebRTC stats collection
    stats.forEach((report: any) => {
      // Extract video streaming stats from inbound RTP stats
      if (report.type === 'inbound-rtp' && report.framesPerSecond !== undefined) {
        // Round FPS to nearest integer for cleaner display
        newFrameRate = Math.round(report.framesPerSecond);
        
        // Convert jitter from seconds to milliseconds and round
        newNetworkStats.jitter = report.jitter ? Math.round(report.jitter * 1000) : undefined;
        
        // Calculate bitrate by comparing bytes received over time
        if (report.bytesReceived && previousBytesReceivedRef.current) {
          const now = Date.now();
          const timeDiff = (now - previousTimestampRef.current) / 1000; // Convert to seconds
          const bytesDiff = report.bytesReceived - previousBytesReceivedRef.current;
          // Convert bytes/second to megabits/second: (bytes * 8 bits/byte) / (1,000,000 bits/megabit)
          const bitrate = ((bytesDiff * 8) / timeDiff / 1000000).toFixed(2);
          newNetworkStats.bitrate = bitrate;
          previousTimestampRef.current = now;
        }
        previousBytesReceivedRef.current = report.bytesReceived || 0;
      }
      
      // Extract round-trip time from successful connection candidate pairs
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        // Convert RTT from seconds to milliseconds and round
        newNetworkStats.rtt = report.currentRoundTripTime ? Math.round(report.currentRoundTripTime * 1000) : undefined;
      }
    });

    // Update component state with new stats
    setNetworkStats(newNetworkStats);
    setFrameRate(newFrameRate);
  };

  // Cleanup effect: Stop stats logging when component unmounts
  useEffect(() => {
    return () => {
      stopStatsLogging();
    };
  }, []);

  // Effect to manage stats logging based on visibility and stream state
  // Only poll for stats when overlay is visible AND stream is running
  useEffect(() => {
    if (isVisible && isStreamRunning) {
      startStatsLogging();
    } else {
      stopStatsLogging();
    }
    // eslint-disable-next-line
  }, [isVisible, isStreamRunning, gameliftstreams]);

  // Effect to automatically show stats overlay when stream starts
  // Ensures stats are visible by default for new streaming sessions
  useEffect(() => {
    if (isStreamRunning) {
      setIsVisible(true);
    }
  }, [isStreamRunning]);

  // Creates a visual stat bar with color-coded status indication.
  const createStatBar = (
    value: any, // The stat value to display
    maxValue = 2.0, // Maximum value for calculating bar width percentage (default: 2.0)
    threshold = 1.0, // Threshold value for good/bad status coloring (default: 1.0)
    showDivider = true, // Whether to show the central divider line (default: true)
    suffix = '', // Text suffix to append to the value (e.g., '%', 'ms')
    secondaryText = '' // Additional text to display (e.g., memory in GB)
  ): React.ReactElement => {
    // Handle cases where value is not a valid number
    if (value === '-' || value === undefined || value === null || isNaN(parseFloat(value))) {
      const divider = showDivider ? <div className="bar-divider"></div> : null;
      const secondary = secondaryText ? <span style={{ color: '#888' }}>{secondaryText}</span> : null;
      return (
        <>
          <div className="bar-container">{divider}</div>
          <span>{value || '-'}{suffix}{secondary && ' '}{secondary}</span>
        </>
      );
    }
    
    const numValue = parseFloat(value);
    // Calculate percentage width, capped at 100%
    const percentage = Math.min((numValue / maxValue) * 100, 100);
    // Determine if value is within acceptable range (good = green, bad = red)
    const isGood = numValue <= threshold;
    const fillClass = isGood ? 'good' : 'bad';
    const divider = showDivider ? <div className="bar-divider"></div> : null;
    const secondary = secondaryText ? <span style={{ color: '#888' }}>{secondaryText}</span> : null;
    const formattedValue = numValue.toFixed(2);
    
    return (
      <>
        <div className="bar-container">
          <div className={`bar-fill ${fillClass}`} style={{ width: `${percentage}%` }}></div>
          {divider}
        </div>
        <span>{formattedValue}{suffix}{secondary && ' '}{secondary}</span>
      </>
    );
  };

  /**
   * Converts megabytes to gigabytes with proper formatting.
   */
  const formatMBtoGB = (mbValue: any): string => {
    const num = parseFloat(mbValue);
    return isNaN(num) ? '' : `${(num / 1024).toFixed(2)}G`;
  };

  // Format frame rate for display, showing '-' if no data available
  const fps = frameRate || '-';

  // Don't render the overlay if stream is not running
  if (!isStreamRunning) {
    return null;
  }

  return (
    <div className={`stats-overlay ${isVisible ? 'visible' : 'hidden'}`}>
      {/* Header: Display current client-side frame rate */}
      <div style={{ fontSize: '14px', fontWeight: 'bold' }}>CLIENT FPS&nbsp;&nbsp;{fps}</div>
      <div style={{ borderTop: '1px solid #666', margin: '4px 0' }}></div>
      
      {/* Application Stats Section: Normalized values (0-1.0 scale) */}
      <div><strong><u>APPLICATION (NORMALIZED)</u></strong></div>
      <div className="stat-line">
        <span>CPU</span>
        {createStatBar(perfStats.application?.cpuUtilizationNormalized, 1.0, 1.0, false)}
      </div>
      <div className="stat-line">
        <span>MEM</span>
        {createStatBar(
          perfStats.application?.memoryUtilizationNormalized, 
          1.0, 
          1.0, 
          false, 
          '', 
          formatMBtoGB(perfStats.application?.memoryUtilizationMb)
        )}
      </div>
      
      <div>&nbsp;</div>
      
      {/* System Instance Stats Section: Percentage-based values (0-100%) */}
      <div><strong><u>INSTANCE</u></strong></div>
      <div className="stat-line">
        <span>CPU</span>
        {createStatBar(perfStats.system?.cpuUtilization, 100, 90, false, '%')}
      </div>
      <div className="stat-line">
        <span>MEM</span>
        {createStatBar(
          perfStats.system?.memoryUtilization, 
          100, 
          90, 
          false, 
          '%', 
          formatMBtoGB(perfStats.system?.memoryUtilizationMb)
        )}
      </div>
      <div className="stat-line">
        <span>GPU</span>
        {createStatBar(perfStats.system?.gpuUtilization, 100, 90, false, '%')}
      </div>
      <div className="stat-line">
        <span>VRAM</span>
        {createStatBar(
          perfStats.system?.vramUtilization, 
          100, 
          90, 
          false, 
          '%', 
          formatMBtoGB(perfStats.system?.vramUtilizationMb)
        )}
      </div>
      
      <div>&nbsp;</div>
      
      {/* Network Stats Section: Text-only display without bars */}
      <div><strong><u>NETWORK</u></strong></div>
      <div className="stat-line">
        <span>RTT</span>
        <span></span>
        <span>{networkStats.rtt || '-'} ms</span>
      </div>
      <div className="stat-line">
        <span>Jitter</span>
        <span></span>
        <span>{networkStats.jitter || '-'} ms</span>
      </div>
      <div className="stat-line">
        <span>Bitrate</span>
        <span></span>
        <span>{networkStats.bitrate || '-'} mbps</span>
      </div>
    </div>
  );
});

export default StatsOverlay;
