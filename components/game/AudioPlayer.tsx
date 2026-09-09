"use client";

import { useCallback, useEffect } from "react";
import { useSnippetPlayback } from "./useSnippetPlayback";

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
  const stableOnError = useCallback(
    (message: string) => onError(message),
    [onError],
  );
  const { play, stop, status } = useSnippetPlayback(stableOnError);

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
    <>
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
    </>
  );
}
