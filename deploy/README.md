# Cloudflare free-tier deployment

The production layout uses Cloudflare Workers for the Next.js site and API routes, Supabase PostgreSQL for game data, a private Cloudflare R2 bucket for 16-second MP3 clips, and GitHub Actions for the daily playlist job. No always-running server is required.

## 1. Supabase

In the Supabase project, open **Connect** and copy both pooler URLs:

- **Session pooler**, port 5432: add this to GitHub as `SUPABASE_DATABASE_URL`. The daily job uses it for Prisma migrations and publishing.
- **Transaction pooler**, port 6543: add this later as the Cloudflare Worker secret `DATABASE_URL`. Copy the complete URL shown by Supabase.

Replace the password placeholder with the URL-encoded database password. Keep both URLs secret. The session pooler value already added to GitHub is the correct value for the daily job.

## 2. Cloudflare R2

In **R2 Object Storage**, create a private bucket named exactly `balkanguess-audio`. The Worker binding is already declared in `wrangler.jsonc` as `AUDIO_BUCKET`, so the site reads private clips without an R2 access key, public bucket URL, or CORS policy.

Create an R2 API token restricted to this bucket with **Object Read & Write**. Save its account ID, access key ID, and secret access key for GitHub Actions. The token is only for the daily upload job.

## 3. GitHub Actions secrets

Open the repository's **Settings → Secrets and variables → Actions** and add:

```text
SUPABASE_DATABASE_URL
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
```

Set `R2_BUCKET_NAME` to `balkanguess-audio`. The workflow in `.github/workflows/daily-playlist.yml` runs at 02:17 UTC and can also be started manually. It refreshes the three playlists, prepares seven Zagreb calendar days, uploads new clips, and publishes the matching rows to Supabase.

Run **Actions → Prepare daily songs → Run workflow** once before deploying the site. The first run imports the full playlist catalogs but downloads only the tracks needed for the seven-day queue.

## 4. Create the Cloudflare Worker

After installing Node.js 22 and this repository's dependencies, authenticate Wrangler:

```powershell
npx wrangler login
```

Create the production database secret. Paste the Supabase transaction pooler URL when prompted:

```powershell
npx wrangler secret put DATABASE_URL
```

Then deploy:

```powershell
npm run deploy:cloudflare
```

Wrangler creates the `balkan-guess` Worker from `wrangler.jsonc`, uploads the vinext build, and attaches the existing `balkanguess-audio` bucket. Future deployments use the same command. Do not set `PLAYLIST_DEV`, `CATALOG_STORAGE`, or any R2 key on the Worker.

The vinext adapter is currently a beta Cloudflare project, so keep its pinned versions in `package.json` and run `npm run build:cloudflare` when upgrading it.

## 5. Validate production

Before replacing an existing public URL, verify:

- `/api/health` returns `{ "status": "ok" }`.
- `/api/daily?category=club-mix`, `jala-buba`, and `exyu` each report a prepared challenge.
- Each category plays audio, accepts a guess, reveals the answer, and restores browser progress after reload.
- `/api/daily/clip` serves only today's assigned private clip and supports browser range requests.
- A second manual daily workflow run succeeds without replacing prepared assignments.

## Maintenance

Add tracks to the source YouTube playlists and let the next workflow import them. For a bad automatic intro boundary, run `npm run playlist -- start SONG_ID SECONDS` in a configured worker environment, followed by `prepare` and `publish`.

Prepared clips remain in R2 so old assignments and reused songs keep working. Back up `state/catalog.json` from R2 and the Supabase database together before manually repairing catalog data.
