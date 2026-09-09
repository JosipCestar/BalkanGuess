"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hasReachedSnippetEnd, withActualPlaybackStart, type SnippetBounds } from "@/lib/audio/snippet";

export type PlaybackStatus = "idle" | "loading" | "playing" | "stopped";

function waitForMediaEvent(player: HTMLAudioElement, eventName: "loadedmetadata" | "seeked" | "canplay", signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      player.removeEventListener(eventName, onSuccess);
      player.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    };
    const onSuccess = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("The audio clip could not be loaded.")); };
    const onAbort = () => { cleanup(); reject(new DOMException("Playback superseded.", "AbortError")); };
    player.addEventListener(eventName, onSuccess, { once: true });
    player.addEventListener("error", onError, { once: true });
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
export function useSnippetPlayback(onError: (message: string) => void, volume = 1) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const boundsRef = useRef<SnippetBounds | null>(null);
  const frameRef = useRef<number | null>(null);
  const hardStopRef = useRef<number | null>(null);
  const sessionRef = useRef(0);
  const pendingRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<PlaybackStatus>("idle");

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const cancelHardStop = useCallback(() => {
    if (hardStopRef.current !== null) window.clearTimeout(hardStopRef.current);
    hardStopRef.current = null;
  }, []);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    pendingRef.current?.abort();
    pendingRef.current = null;
    cancelFrame();
    cancelHardStop();
    audioRef.current?.pause();
    setStatus(previous => previous === "idle" ? "idle" : "stopped");
  }, [cancelFrame, cancelHardStop]);

  const enforceBoundary = useCallback(() => {
    const player = audioRef.current;
    const bounds = boundsRef.current;
    if (!player || !bounds || !hasReachedSnippetEnd(player.currentTime, bounds.start, bounds.duration)) return false;
    player.pause();
    cancelFrame();
    cancelHardStop();
    setStatus("stopped");
    return true;
  }, [cancelFrame, cancelHardStop]);

  const play = useCallback(async (bounds: SnippetBounds) => {
    stop();
    const session = sessionRef.current;
    const pending = new AbortController();
    pendingRef.current = pending;
    boundsRef.current = bounds;
    setStatus("loading");

    try {
      let player = audioRef.current;
      if (!player) {
        player = new Audio();
        player.preload = "auto";
        player.addEventListener("timeupdate", enforceBoundary);
        player.addEventListener("error", () => onError("The audio clip could not be played."));
        audioRef.current = player;
      }
      player.volume = Math.min(1, Math.max(0, volume));
      if (player.src !== new URL(bounds.url, window.location.href).href) {
        player.src = bounds.url;
        player.load();
      }
      if (player.readyState < HTMLMediaElement.HAVE_METADATA) await waitForMediaEvent(player, "loadedmetadata", pending.signal);
      if (session !== sessionRef.current) return;
      player.currentTime = bounds.start;
      if (player.seeking) await waitForMediaEvent(player, "seeked", pending.signal);
      if (session !== sessionRef.current) return;
      if (player.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) await waitForMediaEvent(player, "canplay", pending.signal);
      if (session !== sessionRef.current) return;
      boundsRef.current = withActualPlaybackStart(bounds, player.currentTime);
      await player.play();
      if (session !== sessionRef.current) { player.pause(); return; }
      setStatus("playing");
      hardStopRef.current = window.setTimeout(() => {
        if (session !== sessionRef.current) return;
        player.pause();
        cancelFrame();
        setStatus("stopped");
        hardStopRef.current = null;
      }, bounds.duration * 1000);

      const monitor = () => {
        if (session !== sessionRef.current || enforceBoundary()) return;
        if (!player.paused) frameRef.current = requestAnimationFrame(monitor);
      };
      frameRef.current = requestAnimationFrame(monitor);
    } catch (error) {
      if (pending.signal.aborted) return;
      stop();
      onError(error instanceof Error ? error.message : "Could not play audio.");
    } finally {
      if (pendingRef.current === pending) pendingRef.current = null;
    }
  }, [cancelFrame, enforceBoundary, onError, stop, volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.min(1, Math.max(0, volume));
  }, [volume]);

  useEffect(() => () => {
    sessionRef.current += 1;
    pendingRef.current?.abort();
    cancelFrame();
    cancelHardStop();
    const player = audioRef.current;
    if (player) { player.pause(); player.removeAttribute("src"); player.load(); }
  }, [cancelFrame, cancelHardStop]);

  return { play, stop, status };
}
