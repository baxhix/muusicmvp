'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface NowPlayingState {
  isExpanded: boolean;
  isPlaying: boolean;
  progressSecs: number;
  totalSecs: number;
}

interface UseNowPlayingReturn extends NowPlayingState {
  toggle: () => void;
  collapse: () => void;
  togglePlay: () => void;
  /** Idempotent setters — handy for callers that need to force a
   *  specific play state (e.g. "user just picked a track from the
   *  playlist modal, start it playing") without having to consult
   *  `isPlaying` first. */
  play: () => void;
  pause: () => void;
  progressPercent: string;
  formattedCurrent: string;
  formattedTotal: string;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function useNowPlaying(initialSecs = 64, totalSecs = 204): UseNowPlayingReturn {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progressSecs, setProgressSecs] = useState(initialSecs);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isExpanded || !isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setProgressSecs((s) => (s + 1) % totalSecs);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isExpanded, isPlaying, totalSecs]);

  const toggle = useCallback(() => setIsExpanded((v) => !v), []);
  const collapse = useCallback(() => setIsExpanded(false), []);
  const togglePlay = useCallback(() => setIsPlaying((v) => !v), []);
  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);

  const progressPercent = ((progressSecs / totalSecs) * 100).toFixed(1) + '%';
  const formattedCurrent = formatTime(progressSecs);
  const formattedTotal = formatTime(totalSecs);

  return {
    isExpanded,
    isPlaying,
    progressSecs,
    totalSecs,
    toggle,
    collapse,
    togglePlay,
    play,
    pause,
    progressPercent,
    formattedCurrent,
    formattedTotal,
  };
}
