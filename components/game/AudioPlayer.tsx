"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSnippetPlayback } from "./useSnippetPlayback";

type Source = {
  url: string;
  previewStart: number;
  attribution: { creator: string; soundcloudUrl: string };
};

export function AudioPlayer({
  duration,
  disabled,
  onError,
}: {
  duration: number;
  disabled?: boolean;
  onError: (message: string) => void;
}) {
  const sourceRef = useRef<Source | null>(null);
  const sourceRequestRef = useRef<Promise<Source> | null>(null);
  const [attribution, setAttribution] = useState<Source["attribution"]>();
  const [sourceLoading, setSourceLoading] = useState(false);
  const stableOnError = useCallback(
    (message: string) => onError(message),
    [onError],
  );
  const { play, stop, status } = useSnippetPlayback(stableOnError);

  const playSnippet = useCallback(async () => {
    try {
      let source = sourceRef.current;
      if (!source) {
        if (!sourceRequestRef.current)
          sourceRequestRef.current = (async () => {
            setSourceLoading(true);
            const response = await fetch("/api/daily/audio");
            const data = await response.json();
            if (!response.ok)
              throw new Error(data.error || "Audio is unavailable.");
            return data as Source;
          })();
        try {
          source = await sourceRequestRef.current;
        } finally {
          sourceRequestRef.current = null;
          setSourceLoading(false);
        }
        sourceRef.current = source;
        setAttribution(source.attribution);
      }
      await play({ url: source.url, start: source.previewStart, duration });
    } catch (error) {
      stableOnError(
        error instanceof Error ? error.message : "Could not play audio.",
      );
    }
  }, [duration, play, stableOnError]);

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
        disabled={disabled || sourceLoading || status === "loading"}
        onClick={() => void playSnippet()}
        aria-label={`Play ${duration} second audio snippet`}
      >
        {sourceLoading || status === "loading"
          ? "LOADING…"
          : status === "playing"
            ? `↻ REPLAY ${duration}s`
            : `▶ PLAY ${duration}s`}
      </button>
      {attribution && (
        <p className='muted soundcloud-attribution' aria-live='polite'>
          Audio powered by{" "}
          <a href={attribution.soundcloudUrl} target='_blank' rel='noreferrer'>
            <Image
              className='soundcloud-logo'
              src='https://developers.soundcloud.com/assets/logo_white-2a8d0b9755fd7c4fc52d020a331d838a75abd779a4ca4898931f3fc2cd20ad97.png'
              alt='SoundCloud'
              width={72}
              height={24}
            />
          </a>
        </p>
      )}
    </>
  );
}
