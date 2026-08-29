export type SnippetBounds = {
  url: string;
  start: number;
  duration: number;
};

export function getSnippetEnd(start: number, duration: number) {
  return start + duration;
}

export function hasReachedSnippetEnd(currentTime: number, start: number, duration: number) {
  return currentTime >= getSnippetEnd(start, duration);
}

export function withActualPlaybackStart(bounds: SnippetBounds, actualStart: number): SnippetBounds {
  return { ...bounds, start: actualStart };
}
