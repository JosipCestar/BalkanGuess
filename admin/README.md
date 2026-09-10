# BalkanGuess Admin for Windows

Double-click **Start Admin.cmd**, or run `npm run admin` from the repository.
This is a native Windows desktop window, separate from the website. It needs
the repository's installed Node dependencies; no web server is required.

- **Community:** read-only completed-round totals, wins, losses, win rate and
  guess distribution by category and date for the last 30 Zagreb days. Uses
  `DATABASE_URL` from `.env`, regardless of the catalog selector. These are not
  unique visitor counts. A connection failure is shown separately from zero results.
- **Health:** upcoming assignments for all three categories, active/category
  validation, clip existence, and local clip duration via ffprobe. R2 checks
  object existence only and explicitly marks duration as unchecked.
- **Preparation:** choose 1–30 days and run the existing playlist pipeline.
  Live logs and exit status appear in the window. Refresh afterward to verify
  coverage. The pipeline's existing worker lock prevents overlapping writes
  using the same data directory. Separate machines must still be coordinated.

Local mode is the default and only updates local catalog/audio. Selecting
**Live R2 catalog** makes preparation publish catalog and clips using existing
R2 environment configuration. It does not mirror catalog rows to PostgreSQL.
Credentials stay in existing `.env` / `.env.playlist.local` files. Tool availability
is checked using `YTDLP_PATH`, `FFMPEG_PATH`, and optional `FFPROBE_PATH`.

Keep the window open while an operation runs. Closing is blocked during work
to avoid interrupting the pipeline and leaving its lock behind. No automatic
preparation or publishing runs when the app opens; only read-only checks run.
