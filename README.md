<div align="center">

# BalkanGuess

**A daily Balkan music guessing game inspired by Heardle.**

Listen to progressively longer parts of a song and solve each daily category in six attempts.

</div>

## Categories

- Balkan Club Mix is the main daily challenge.
- Jala i Buba is a focused secondary category.
- EXYU is a focused secondary category.

Each category has its own daily song, attempts, saved browser progress, and anonymous aggregate results.

## Technology

| Area | Technology |
| --- | --- |
| Web application | Next.js 16, React 19, TypeScript |
| Database | Supabase PostgreSQL with Prisma for anonymous aggregate statistics |
| Audio storage | Private Cloudflare R2 bucket bound directly to the Worker |
| Daily worker | GitHub Actions, yt-dlp, FFmpeg, SponsorBlock intro markers |
| Hosting | Cloudflare Workers through vinext |
| Verification | Vitest, TypeScript, ESLint |

## Local playlist development

Install Node.js 22, yt-dlp, FFmpeg, and ffprobe, then install dependencies:

```powershell
npm install
npm run db:generate
npm run dev:playlist
```

Open [http://127.0.0.1:3001](http://127.0.0.1:3001). The local playlist mode reads ignored files under `data/` and does not modify the production database or R2 bucket. See [DEVELOPMENT.md](DEVELOPMENT.md) for playlist imports, automatic intro detection, manual start overrides, and validation commands.

## Production deployment

Production uses Cloudflare Workers, Supabase, a private Cloudflare R2 bucket, and the workflow in `.github/workflows/daily-playlist.yml`. Follow [deploy/README.md](deploy/README.md) to create the services, configure secrets, run the initial catalog import, and validate the public deployment.

## Main commands

| Command | Purpose |
| --- | --- |
| `npm run dev:playlist` | Start isolated local playlist development |
| `npm run playlist -- import CATEGORY URL` | Add or refresh a source playlist |
| `npm run playlist -- prepare 2` | Prepare two days of MP3 clips |
| `npm run playlist -- publish` | Optionally mirror catalog and assignments to PostgreSQL |
| `npm run playlist -- find QUERY` | Find a catalog song and its local ID |
| `npm run playlist -- start ID SECONDS` | Override a song's clip starting point |
| `npm test` | Run unit tests |
| `npm run typecheck` | Check TypeScript |
| `npm run lint` | Run ESLint |
| `npm run build` | Create the production build |
| `npm run build:cloudflare` | Verify the Cloudflare Worker build |
| `npm run deploy:cloudflare` | Build and deploy to Cloudflare Workers |

Only use source audio that you have permission to download, process, and host. Playlist visibility does not grant rights to the recordings.
