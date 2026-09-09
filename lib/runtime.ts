export function localMode() {
  return process.env.PLAYLIST_DEV === "1";
}
