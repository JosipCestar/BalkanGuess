# Playlist development version

Run `npm run db:generate` once after installing dependencies, then `npm run dev:playlist`.
Open http://127.0.0.1:3001. This explicitly enables a local JSON catalog instead of database queries.
Your existing `.env` and Railway database are not modified. Shared statistics are disabled in this preview;
attempts persist in the browser independently for each category and date.

The local catalog uses Balkan Club Mix as the main challenge, with Jala i Buba and EXYU as secondary categories.
Generated catalogs and audio are in the ignored `data/` folder. They are not shipped in Git or Vercel deployments.

## Import and prepare

Install Node 22, yt-dlp (including its default dependencies/EJS), FFmpeg, and ffprobe.
Set `YTDLP_PATH`, `FFMPEG_PATH`, and optionally `FFPROBE_PATH` if they are not on PATH.
These can also be saved in the ignored `.env.playlist.local` file, loaded by the playlist script.
This machine's test-tool paths are configured there; reinstall/configure tools if the temporary folder is cleared.
The paths may refer to executables outside the repository. No account cookies are needed for this playlist.

```powershell
npm run playlist -- import jala-buba 'https://www.youtube.com/playlist?list=PLVQZG1Rymm4U'
npm run playlist -- import club-mix 'https://www.youtube.com/playlist?list=PLJ14wpRv6ztY'
npm run playlist -- import exyu 'https://www.youtube.com/playlist?list=PLEENVhYLmeNM'
npm run playlist -- prepare 7
npm run dev:playlist
```

## Skip a video intro

Each catalog song has a `previewStart` measured in seconds. Keep it at `0` for a normal musical intro. If a video has a label animation, spoken intro, or a long non-song opening, set the first useful music position by song ID:

```powershell
npm run playlist -- find IDJ
npm run playlist -- start 256 18.5
npm run playlist -- prepare 7
```

The `start` command removes the old generated clip, if present. `prepare` rebuilds it from the new position, including an already assigned daily song. Choose the position by opening the source URL from `data/catalog.json`, then copy the timestamp where the actual song begins.

Preparation also detects starts automatically. It first checks the public SponsorBlock `intro`, `selfpromo`, and `music_offtopic` markers. If none exist and the downloaded video's channel/uploader identifies IDJ, FFmpeg looks for the short quiet boundary between the label animation and the song during the first 30 seconds. A detected value is saved to `previewStart`; a manually configured non-zero value always wins.

Only `publish` writes to PostgreSQL. `import` and `prepare` work on local files.
Re-importing is additive and deduplicates by video URL; removing a video from YouTube does not remove it from the catalog.
To retire a song, set `active` to false in the catalog, then prepare replacement future assignments before publishing.
Review `data/catalog.json` for title/artist accuracy and `data/review-CATEGORY.json` for skipped entries.
Songs with ambiguous title formatting are skipped instead of guessing the artist from the channel name.
Use the `start` command to avoid silence or music-video intros.

Preparation assigns today and the next six Zagreb dates by default, without changing existing assignments.
It avoids repeats until the category catalog is exhausted, retries up to five candidate songs per missing date,
validates clip duration with ffprobe, and only records an assignment after its file is written.
Repeated preparation is idempotent. Full downloaded files are temporary and removed after conversion.
Prepared clips are retained for reuse; automatic clip deletion is not implemented.

A `data/worker.lock` file prevents overlapping writes. After an interrupted process, verify no importer/worker is
running before manually removing a stale lock. Do not edit the catalog while a worker is running.

## Verification

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

For a fresh playthrough, click **RESET TEST ROUND** in the development preview.
The clip endpoint sends only today's assigned 16-second audio and supports byte ranges.
The existing game enforces 1/2/4/7/11/16-second playback in the browser; a technical user can fetch all 16 seconds.
Guess/reveal and player-reported statistics are not designed as a cheat-proof competition.

Use source audio you have permission to download and host. An unlisted playlist only controls discovery;
it does not grant rights to its recordings. Cloud download reliability must be tested on the actual server.

See [production deployment](deploy/README.md) after approving the development experience.
