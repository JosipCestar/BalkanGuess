"use client";

import { useCallback, useEffect, useId, useState, type CSSProperties } from "react";
import { useSnippetPlayback } from "./useSnippetPlayback";

const VOLUME_STORAGE_KEY = "balkanguess:volume";
const DEFAULT_VOLUME = 0.8;

export function AudioPlayer({
  sourceUrl,
  duration,
  disabled,
  onError,
}: {
  sourceUrl?: string;
  duration: number;
  disabled?: boolean;
  onError: (message: string) => void;
}) {
  const volumeId = useId();
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const stableOnError = useCallback(
    (message: string) => onError(message),
    [onError],
  );
  const { play, stop, status } = useSnippetPlayback(stableOnError, volume);

  useEffect(() => {
    const stored = window.localStorage.getItem(VOLUME_STORAGE_KEY);
    if (stored === null) return;
    const parsed = Number(stored);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) setVolume(parsed);
  }, []);

  const changeVolume = (value: string) => {
    const nextVolume = Math.min(1, Math.max(0, Number(value) / 100));
    setVolume(nextVolume);
    window.localStorage.setItem(VOLUME_STORAGE_KEY, String(nextVolume));
  };

  const playSnippet = useCallback(async () => {
    try {
      if (!sourceUrl) throw new Error("Audio is unavailable.");
      await play({ url: sourceUrl, start: 0, duration });
    } catch (error) {
      stableOnError(
        error instanceof Error ? error.message : "Could not play audio.",
      );
    }
  }, [duration, play, stableOnError, sourceUrl]);

  useEffect(() => {
    stop();
  }, [duration, disabled, stop]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.code === "Space" &&
        !(event.target instanceof HTMLInputElement) &&
        !disabled
      ) {
        event.preventDefault();
        void playSnippet();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, playSnippet]);

  return (
    <div className="audio-controls">
      <button
        className='play'
        disabled={disabled || status === "loading"}
        onClick={() => void playSnippet()}
        aria-label={`Play ${duration} second audio snippet`}
      >
        {status === "loading"
          ? "LOADING…"
          : status === "playing"
            ? `↻ REPLAY ${duration}s`
            : `▶ PLAY ${duration}s`}
      </button>
      <div className="volume-control">
        <label htmlFor={volumeId}>VOLUME</label>
        <input
          id={volumeId}
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(volume * 100)}
          onChange={event => changeVolume(event.target.value)}
          aria-valuetext={`${Math.round(volume * 100)} percent`}
          style={{ "--volume-position": `${Math.round(volume * 100)}%` } as CSSProperties}
        />
        <span aria-hidden="true">{Math.round(volume * 100)}%</span>
      </div>
    </div>
  );
}
