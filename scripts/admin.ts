import { config } from "dotenv";
import { spawn } from "node:child_process";
import { access, stat } from "node:fs/promises";
import path from "node:path";
import { readCatalog, dataDir } from "../lib/catalog";
import { CATEGORIES } from "../lib/categories";
import { getCurrentChallengeDate } from "../lib/challenge";
import { dateOffset } from "../lib/playlist";
import { r2ObjectExists } from "../lib/r2";
import { summarizeDailyResults } from "../lib/daily-stats";

config({ quiet: true });
config({ path: ".env.playlist.local", quiet: true });
const [command, target = "local", dayInput = "7"] = process.argv.slice(2);
if (!["local", "r2"].includes(target)) throw new Error("Target must be local or r2.");
const days = Number(dayInput);
if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error("Days must be between 1 and 30.");
process.env.CATALOG_STORAGE = target;
const today = getCurrentChallengeDate();

async function capture(executable: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true });
    let output = "";
    const timeout = setTimeout(() => { child.kill(); reject(new Error("Tool timed out")); }, 15000);
    child.stdout.on("data", chunk => { output = (output + chunk).slice(-16000); });
    child.stderr.resume();
    child.on("error", error => { clearTimeout(timeout); reject(error); });
    child.on("close", code => { clearTimeout(timeout); code === 0 ? resolve(output.trim()) : reject(new Error("Tool failed")); });
  });
}
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const probe = process.env.FFPROBE_PATH || (path.dirname(ffmpeg) === "." ? "ffprobe" : path.join(path.dirname(ffmpeg), "ffprobe.exe"));

async function health() {
  const catalog = await readCatalog();
  const rows = [];
  const clips = new Map<string, Promise<string>>();
  for (let offset = 0; offset < days; offset++) for (const category of CATEGORIES) {
    const date = dateOffset(today, offset);
    const song = catalog.songs.find(item => item.id === catalog.days[`${date}:${category.id}`]);
    let status = "Missing assignment";
    if (song) {
      status = !song.active || !song.categories.includes(category.id) ? "Invalid assignment" : "Missing clip key";
      if (song.active && song.categories.includes(category.id) && song.clipKey) {
        const key = song.clipKey;
        if (!clips.has(key)) clips.set(key, (async () => {
          if (!/^[a-zA-Z0-9_-]+\.mp3$/.test(key)) return "Invalid clip key";
          if (target === "r2") return await r2ObjectExists(`clips/${key}`) ? "R2 present (duration unchecked)" : "Missing R2 clip";
          const file = path.join(dataDir(), "clips", key);
          try { if (!(await stat(file)).isFile()) return "Missing local clip"; } catch { return "Missing local clip"; }
          try {
            const duration = Number(await capture(probe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file]));
            return Number.isFinite(duration) && duration >= 15.9 && duration <= 16.2 ? "Ready" : `Invalid duration: ${duration}s`;
          } catch { return "Clip present; probe failed"; }
        })().catch(() => "Clip check failed"));
        status = await clips.get(key)!;
      }
    }
    rows.push({ Date: date, Category: category.label, Song: song ? `${song.artist} - ${song.title}` : "-", Status: status });
  }
  return rows;
}

async function community() {
  if (!process.env.DATABASE_URL) return { status: "Not configured: set DATABASE_URL in .env", rows: [] };
  const { createPrismaClient } = await import("../lib/prisma-client");
  const client = createPrismaClient();
  try {
    const groups = await client.dailyAggregate.findMany({ where: { date: { gte: dateOffset(today, -29), lte: today } } });
    const rows = [];
    for (let offset = 0; offset < 30; offset++) for (const category of CATEGORIES) {
      const date = dateOffset(today, -offset);
      const stats = summarizeDailyResults(groups.filter(group => group.date === date && group.category === category.id));
      rows.push({ Date: date, Category: category.label, Completed: stats.totalPlayers, Solved: stats.solvedPlayers, Losses: stats.losses,
        "Win %": stats.totalPlayers ? Math.round(stats.solvedPlayers / stats.totalPlayers * 100) : 0,
        ...Object.fromEntries(stats.attempts.map((count, index) => [`Guess ${index + 1}`, count])) });
    }
    return { status: "Connected database - last 30 Zagreb dates. Counts are completed rounds, not unique visitors.", rows };
  } catch { return { status: "Database unavailable. Check DATABASE_URL, connectivity, and migrations.", rows: [] }; }
  finally { await client.$disconnect(); }
}

async function snapshot() {
  const missingR2 = target === "r2"
    ? ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"].filter(key => !process.env[key]?.trim())
    : [];
  const [catalog, stats, tools] = await Promise.all([
    missingR2.length
      ? Promise.resolve({ status: `Live R2 is not configured. Set ${missingR2.join(", ")} in .env.playlist.local, then refresh.`, rows: [] })
      : health().then(rows => ({ status: `Catalog: ${target} - next ${days} Zagreb dates`, rows })).catch(() => ({ status: "Catalog unavailable. Check storage configuration and credentials.", rows: [] })),
    community(),
    Promise.all([["yt-dlp", process.env.YTDLP_PATH || "yt-dlp", "--version"], ["FFmpeg", ffmpeg, "-version"], ["ffprobe", probe, "-version"]].map(async ([name, exe, flag]) => ({ Tool: name, Status: await capture(exe, [flag]).then(() => "Available", () => "Unavailable - check .env.playlist.local") }))),
  ]);
  const locked = await access(path.join(dataDir(), "worker.lock")).then(() => true, () => false);
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), catalog, community: stats, tools, locked }));
}

async function prepare() {
  console.log(`Preparing ${days} days in ${target}. ${target === "r2" ? "Live R2 catalog and clips will be updated." : "Local catalog and clips only."}`);
  const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/playlist.ts", "prepare", String(days)], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  // Keep configured credentials out of the UI log, including split output chunks.
  const secrets = Object.entries(process.env).filter(([key, value]) => /SECRET|TOKEN|PASSWORD|DATABASE_URL|ACCESS_KEY/.test(key) && value && value.length > 3).map(([, value]) => value!);
  for (const stream of [child.stdout!, child.stderr!]) {
    let pending = "";
    const write = (line: string) => { for (const secret of secrets) line = line.split(secret).join("[redacted]"); console.log(line); };
    stream.on("data", chunk => { pending += chunk.toString(); const lines = pending.split(/\r?\n/); pending = lines.pop()!; for (const line of lines) write(line); });
    stream.on("end", () => { if (pending) write(pending); });
  }
  child.on("error", () => { console.error("Could not start preparation."); process.exitCode = 1; });
  child.on("close", code => { console.log(code === 0 ? "Preparation finished. Refresh health to check coverage." : "Preparation failed. Review the log, then refresh health."); process.exitCode = code ?? 1; });
}

if (command === "snapshot") await snapshot();
else if (command === "prepare") await prepare();
else throw new Error("Usage: admin.ts snapshot|prepare local|r2 [1-30 days]");
