# BalkanGuess

A small, one-song-per-day Balkan music guessing game. Visitors hear an increasingly long clip (1, 2, 4, 7, 11, and 16 seconds), then pick a song from a curated local catalog. There are no accounts, multiplayer, or other game modes.

## Architecture

- Next.js route handlers keep Prisma and SoundCloud secrets server-side.
- SQLite/Prisma stores `Song` and one optional `DailySong` assignment per `YYYY-MM-DD`. A stable date hash selects an active song if no explicit assignment exists.
- `lib/soundcloud` implements current SoundCloud Client Credentials OAuth: credentials are sent only through HTTP Basic authentication, tokens are cached in-process, refreshed before expiry, and API errors/rate limits become clear player errors.
- `AudioProvider` keeps the game independent of SoundCloud. Replace `SoundCloudAudioProvider` with a licensed storage/provider implementation without changing gameplay.
- Browser localStorage (`balkanguess:<date>`) holds only progress: attempts, guesses, skips, and completed result.

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL="file:./dev.db"`.
2. Install dependencies with `npm install`.
3. Run `npm run db:generate`, `npm run db:migrate -- --name init`, then `npm run db:seed`.
4. Run `npm run dev`, visit `http://localhost:3000`.

Run checks with `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.

## SoundCloud development setup

SoundCloud currently requires an Artist Pro account to register an API app. Create the app in SoundCloud, then add `SOUNDCLOUD_CLIENT_ID` and `SOUNDCLOUD_CLIENT_SECRET` to `.env`; never use `NEXT_PUBLIC_` for either. The app obtains a public-resource token through `POST https://secure.soundcloud.com/oauth/token` with `grant_type=client_credentials` and HTTP Basic credentials, then sends `Authorization: OAuth <token>` to the API. It reuses cached tokens and refreshes them when possible rather than requesting a token per playback.

Replace every placeholder `SOUNDCLOUD_TRACK_ID_HERE` in `prisma/seed.ts` (or a `Song` row) with an owned/permitted public track ID. Set the `soundcloudUrl` to that work’s public link and `previewStart` to a safe start position in seconds. Add an explicit daily challenge by creating a `DailySong` row for the desired Zagreb date; otherwise the deterministic fallback is used. Seed songs are fictional placeholders and do not download or include music.

## Important SoundCloud limitation and compliance

SoundCloud’s current custom-player guidance requires crediting the creator, displaying SoundCloud as the source, and linking to the work. That attribution can reveal a daily answer, which conflicts with blind-guess gameplay. This MVP therefore treats SoundCloud as a development provider and shows the required creator/link when playback is loaded; it does not attempt to conceal or bypass attribution. For production, use content you own or are licensed to use and replace the provider with one whose terms support the intended blind-game experience. Tracks marked blocked or lacking a stream fail visibly instead of being substituted.

See SoundCloud’s official [API guide](https://developers.soundcloud.com/docs), [app registration](https://developers.soundcloud.com/docs/api/register-app), [terms](https://developers.soundcloud.com/docs/api/terms-of-use), and [branding guidance](https://developers.soundcloud.com/docs/api/buttons-logos).
