import { SoundCloudClient } from "./client";
import type { AudioProvider, AudioSource, SoundCloudTrack } from "./types";
export class SoundCloudAudioProvider implements AudioProvider {
  private client = new SoundCloudClient();
  async getPlayableSource(song: { soundcloudTrackId: string | null; soundcloudUrl: string | null; artist: string }): Promise<AudioSource> {
    if (!song.soundcloudTrackId || song.soundcloudTrackId === "SOUNDCLOUD_TRACK_ID_HERE") throw new Error("This daily song has no usable SoundCloud track configured.");
    const track = await this.client.get<SoundCloudTrack>(`/tracks/${encodeURIComponent(song.soundcloudTrackId)}`);
    if (track.access === "blocked" || !track.stream_url) throw new Error("This SoundCloud track is not available for streaming.");
    const url = await this.client.getStreamUrl(`/tracks/${encodeURIComponent(song.soundcloudTrackId)}/stream`);
    if (!track.permalink_url) throw new Error("SoundCloud did not return a playable source.");
    return { url, attribution: { creator: track.user?.username || song.artist, soundcloudUrl: track.permalink_url } };
  }
}
