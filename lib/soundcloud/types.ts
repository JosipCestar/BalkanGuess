export type AudioSource = { url: string; attribution: { creator: string; soundcloudUrl: string } };
export interface AudioProvider { getPlayableSource(song: { soundcloudTrackId: string | null; soundcloudUrl: string | null; artist: string }): Promise<AudioSource>; }
type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number };
export type SoundCloudTrack = { access?: "playable" | "preview" | "blocked"; stream_url?: string; permalink_url?: string; user?: { username?: string } };
export type { TokenResponse };
