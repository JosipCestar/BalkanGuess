# Cloudflare free-tier deployment

The production layout uses Cloudflare Workers for the Next.js site and API routes, Supabase PostgreSQL for anonymous player statistics, a private Cloudflare R2 bucket for the playlist catalog and 16-second MP3 clips, and GitHub Actions with a self-hosted Windows runner for the daily playlist job. The Worker reads daily challenges directly from R2, so a statistics database outage does not stop the game. The runner uses your home internet connection because YouTube blocks downloads from GitHub-hosted server addresses. Your computer only needs to be on when the daily job runs.

## 1. Supabase

In the Supabase project, open **Connect** and copy both pooler URLs:

- **Session pooler**, port 5432: add this to GitHub as `SUPABASE_DATABASE_URL`. The daily job uses it for Prisma migrations.
- **Transaction pooler**, port 6543: the role-provisioning command converts this into a least-privilege Worker URL.

Replace the password placeholder with the URL-encoded database password. Keep both URLs secret. The session pooler value already added to GitHub is the correct value for the daily job.

The migration creates a no-login `balkanguess_runtime` permission role. Production uses a separate login that inherits it and can execute only the two statistics functions; it cannot read player hashes, mutate catalog tables, run migrations, create roles/databases, or bypass RLS. Raw player hashes are pruned after 35 days while aggregate statistics are retained.

For the initial least-privilege rollout, apply migrations and deploy the application code while the Worker still has its existing administrative URL. Then run the command below with the administrative session-pooler URL in local `DATABASE_URL`. It creates and verifies `balkanguess_worker`, generates a password only in memory, and switches the Cloudflare secret without printing or saving it:

```powershell
npm run db:provision-runtime -- --switch-cloudflare
```

The command refuses to overwrite an existing Worker login, preventing an accidental uncoordinated password rotation.

## 2. Cloudflare R2

In **R2 Object Storage**, create a private bucket named exactly `balkanguess-audio`. The Worker binding is already declared in `wrangler.jsonc` as `AUDIO_BUCKET`, so the site reads private clips without an R2 access key, public bucket URL, or CORS policy.

Create an R2 API token restricted to this bucket with **Object Read & Write**. Save its account ID, access key ID, and secret access key for GitHub Actions. The token is only for the daily upload job.

## 3. GitHub Actions secrets and variables

Open the repository's **Settings → Secrets and variables → Actions** and add:

```text
SUPABASE_DATABASE_URL
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
```

Set `R2_BUCKET_NAME` to `balkanguess-audio`. The workflow in `.github/workflows/daily-playlist.yml` runs at 02:17 UTC and can also be started manually. It applies database migrations, refreshes the three playlists, prepares two Zagreb calendar days, and uploads new clips and catalog state to R2. Supabase stores player statistics only; the optional `publish` command maintains a non-runtime catalog mirror.

On the same page, open the **Variables** tab and add these repository variables:

```text
YTDLP_PATH
FFMPEG_PATH
```

Copy their full executable paths from your working `.env.playlist.local` file. `YTDLP_PATH` must point to `yt-dlp.exe`, and `FFMPEG_PATH` must point to `ffmpeg.exe`. Add these as variables because they are local file paths, not credentials. Do not paste them into this repository.

## 4. Add the Windows runner

Keep the runner attached only to this repository. The workflow accepts scheduled and manual runs, and deliberately has no pull-request trigger.

1. Open the GitHub repository and go to **Settings → Actions → Runners**.
2. Select **New self-hosted runner**, then choose **Windows** and **x64**.
3. Open PowerShell as Administrator on the computer where the development downloader works.
4. Create `C:\actions-runner` and run the download, extraction, and configuration commands shown by GitHub. Use GitHub's displayed commands because its registration token expires and must remain private.
5. When configuration asks for additional labels, enter `balkanguess`.
6. Accept the default work folder. Install the runner as a Windows service when prompted so scheduled jobs can start without an open terminal. If the media tools are inside your Windows user folder, configure the service to run as that Windows user so it can read them.
7. Return to **Settings → Actions → Runners** and confirm that the runner is **Idle** with the `self-hosted`, `Windows`, `X64`, and `balkanguess` labels.

The computer must be powered on and connected to the internet at the scheduled time. The current 02:17 UTC schedule is 04:17 in Zagreb during summer time and 03:17 during winter time. If the computer is off, GitHub queues the job until the runner becomes available.

Run **Actions → Prepare daily songs → Run workflow** once before deploying the site. The first run imports the full playlist catalogs but downloads only the tracks needed for the two-day queue.

## 5. Create the Cloudflare Worker

After installing Node.js 22 and this repository's dependencies, authenticate Wrangler:

```powershell
npx wrangler login
```

For the first deployment, run the bootstrap command. It builds the Worker, securely prompts for the Supabase transaction pooler URL, uploads that secret with the first Worker version, and deletes its temporary secrets file:

```powershell
npm run deploy:cloudflare:first
```

Paste the complete transaction pooler URL using port 6543 when prompted. Input is hidden while you paste it. After the first deployment, use the regular command for future releases; Wrangler preserves the deployed secret:

```powershell
npm run deploy:cloudflare
```

Wrangler creates the `balkan-guess` Worker from `wrangler.jsonc`, uploads the vinext build, and attaches the existing `balkanguess-audio` bucket. Future deployments use the same command. Do not set `PLAYLIST_DEV`, `CATALOG_STORAGE`, or any R2 key on the Worker.

The bootstrap command also generates and uploads `GAME_TOKEN_SECRET`, which signs anonymous completion proofs. Existing deployments created before this secret was introduced must upload a random value of at least 32 characters before deploying the updated application:

```powershell
node node_modules/wrangler/bin/wrangler.js secret put GAME_TOKEN_SECRET --config wrangler.jsonc
```

Do not rotate this secret during an active challenge unless invalidating current browser progress is acceptable. The vinext adapter is currently a beta Cloudflare project, so keep its pinned versions in `package.json` and run `npm run build:cloudflare` when upgrading it.

Before deploying this version over an existing installation, run the **Prepare daily songs** workflow once so the `DailyAggregate` migration is applied and existing statistics are backfilled. Deploy the Worker only after that workflow succeeds.

## 6. Validate production

Before replacing an existing public URL, verify:

- `/api/health` returns `{ "status": "ok" }`, and `/api/readiness` returns HTTP 200 with all checks true.
- `/api/daily?category=club-mix`, `jala-buba`, `exyu`, and `trap` each report a prepared challenge.
- Each category plays audio, accepts a guess, reveals the answer, and restores browser progress after reload.
- `/api/daily/clip` serves only today's assigned private clip and supports browser range requests.
- A second manual daily workflow run succeeds without replacing prepared assignments or rewriting an unchanged catalog.

Run the read-only automated checks after each deployment:

```powershell
npm run smoke:production -- https://your-worker.example
```

The `Monitor production readiness` workflow also checks `/api/readiness` every 30 minutes. Keep GitHub Actions failure notifications enabled so database, catalog, or three-day coverage failures are actionable.

## Maintenance

Add tracks to the source YouTube playlists and let the next workflow import them. For a bad automatic intro boundary, run `npm run playlist -- start SONG_ID SECONDS` in a configured worker environment, followed by `prepare`. The optional `publish` command maintains a PostgreSQL catalog mirror, but production does not read that mirror and the scheduled workflow deliberately skips it.

Playlist imports accept both `youtube.com` and `music.youtube.com` playlist links. YouTube Music extraction currently resolves through the equivalent standard YouTube playlist, so playlists must be public or unlisted and accessible without an interactive account session on the runner.
The optional Trap import is allowed to warn without blocking preparation of the established categories; Trap becomes part of readiness coverage as soon as its first song is imported.

Prepared clips remain in R2 so old assignments and reused songs keep working. Back up `state/catalog.json` from R2 and the Supabase database together before manually repairing catalog data.
