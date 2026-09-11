import "dotenv/config";
import { config } from "dotenv";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, open, unlink, mkdtemp, rm, access } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { dataDir, readCatalog, writeCatalog, type CatalogSong } from "../lib/catalog";
import { categoryFrom, CATEGORIES } from "../lib/categories";
import { playlistUrl, parseTrackTitle, dateOffset, automaticStartFromSegments, automaticStartFromSilenceLog } from "../lib/playlist";
import { getCurrentChallengeDate, stableIndex } from "../lib/challenge";
import { normalizeBalkanText } from "../lib/text";
import { deleteR2Object, putR2Object, r2ObjectExists, remoteCatalogEnabled } from "../lib/r2";

config({ path: ".env.playlist.local", quiet: true });
const root = dataDir();
const ytdlp = process.env.YTDLP_PATH || "yt-dlp";
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const youtubeBlocked = (error: unknown) => /sign in to confirm you(?:'|’)re not a bot/i.test(error instanceof Error ? error.message : String(error));
function runCapture(command: string, args: string[]): Promise<{ out: string; err: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, windowsHide: true });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${command} timed out`)); }, 180000);
    child.stdout.on("data", chunk => { out += chunk; });
    child.stderr.on("data", chunk => { err = (err + chunk).slice(-8000); });
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", code => { clearTimeout(timer); if (code === 0) resolve({ out, err }); else reject(new Error(err || `${command} exited ${code}`)); });
  });
}
async function run(command: string, args: string[]) {
  return (await runCapture(command, args)).out;
}
const clipObjectKey = (clipKey: string) => `clips/${clipKey}`;
async function clipExists(clipKey: string) {
  try { await access(path.join(root, "clips", clipKey)); return true; }
  catch { return remoteCatalogEnabled() ? r2ObjectExists(clipObjectKey(clipKey)) : false; }
}
async function storeClip(clipKey: string, audio: Uint8Array) {
  await writeFile(path.join(root, "clips", clipKey), audio);
  if (remoteCatalogEnabled()) await putR2Object(clipObjectKey(clipKey), audio, "audio/mpeg");
}
async function cleanTemporaryDirectory(tempDir: string) {
  const resolved = path.resolve(tempDir);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("balkanguess-")) throw new Error("Unexpected temporary directory");
  await rm(resolved, { recursive: true, force: true });
}
async function invalidateClip(clipKey: string | null) {
  if (!clipKey) return;
  if (!/^[a-zA-Z0-9_-]+\.mp3$/.test(clipKey)) throw new Error("Invalid clip key");
  await unlink(path.join(root, "clips", clipKey)).catch(error => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  });
  if (remoteCatalogEnabled()) await deleteR2Object(clipObjectKey(clipKey));
}
async function sponsorBlockStart(sourceUrl: string) {
  const videoId = new URL(sourceUrl).searchParams.get("v");
  if (!videoId) return 0;
  const url = new URL("https://sponsor.ajay.app/api/skipSegments");
  url.searchParams.set("videoID", videoId);
  url.searchParams.set("categories", JSON.stringify(["intro", "selfpromo", "music_offtopic"]));
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (response.status === 404) return 0;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return automaticStartFromSegments(await response.json());
  } catch (error) {
    console.warn(`Automatic intro lookup failed for ${videoId}:`, error instanceof Error ? error.message : error);
    return 0;
  }
}
async function detectAutomaticStart(source: string, sourceUrl: string, infoPath: string) {
  const markedStart = await sponsorBlockStart(sourceUrl);
  if (markedStart) return { start: markedStart, method: "SponsorBlock" };
  try {
    const info = JSON.parse(await readFile(infoPath, "utf8"));
    const label = `${info.channel || ""} ${info.uploader || ""} ${info.title || ""}`;
    if (!/\bidj/i.test(label)) return { start: 0, method: "none" };
    const analysis = await runCapture(ffmpeg, ["-hide_banner", "-t", "30", "-i", source, "-af", "silencedetect=noise=-42dB:d=0.4", "-f", "null", "-"]);
    const start = automaticStartFromSilenceLog(analysis.err);
    return { start, method: start ? "IDJ audio analysis" : "none" };
  } catch (error) {
    console.warn("Automatic audio analysis failed:", error instanceof Error ? error.message : error);
    return { start: 0, method: "none" };
  }
}
async function buildClip(song: CatalogSong, requestedStart: number, detectStart: boolean) {
  if (!song.sourceUrl || !/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(song.sourceUrl)) throw new Error("Invalid video URL");
  if (!Number.isFinite(requestedStart) || requestedStart < 0 || requestedStart > 3600) throw new Error("Invalid preview start");
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "balkanguess-"));
  try {
    const source = path.join(tempDir, "source.webm");
    await run(ytdlp, ["--ignore-config", "--no-playlist", "--js-runtimes", "node", "--socket-timeout", "20", "--retries", "1", "--write-info-json", "-f", "bestaudio", "-o", source, song.sourceUrl]);
    let previewStart = requestedStart;
    if (detectStart && previewStart === 0) {
      const automatic = await detectAutomaticStart(source, song.sourceUrl, path.join(tempDir, "source.info.json"));
      if (automatic.start) {
        previewStart = automatic.start;
        console.log(`Automatic start for song ${song.id}: ${automatic.start}s (${automatic.method})`);
      }
    }
    const clip = path.join(tempDir, "clip.mp3");
    await run(ffmpeg, ["-hide_banner", "-y", "-i", source, "-ss", String(previewStart), "-t", "16", "-vn", "-map_metadata", "-1", "-codec:a", "libmp3lame", "-b:a", "128k", clip]);
    const probe = process.env.FFPROBE_PATH || (path.dirname(ffmpeg) === "." ? "ffprobe" : path.join(path.dirname(ffmpeg), process.platform === "win32" ? "ffprobe.exe" : "ffprobe"));
    const duration = Number((await run(probe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", clip])).trim());
    if (duration < 15.9 || duration > 16.2) throw new Error(`Invalid clip duration: ${duration}`);
    const key = `${randomUUID()}.mp3`;
    try { await storeClip(key, await readFile(clip)); }
    catch (error) { await invalidateClip(key).catch(() => undefined); throw error; }
    return { key, previewStart };
  } finally { await cleanTemporaryDirectory(tempDir); }
}
async function main() {
  await mkdir(path.join(root, "clips"), { recursive: true });
  const lockPath = path.join(root, "worker.lock");
  const lock = await open(lockPath, "wx");
  try {
    const catalog = await readCatalog();
    const command = process.argv[2];
    if (command === "import") {
      const category = categoryFrom(process.argv[3]);
      const url = playlistUrl(process.argv[4] || "");
      const result = JSON.parse(await run(ytdlp, ["--ignore-config", "--flat-playlist", "--dump-single-json", "--skip-download", "--socket-timeout", "20", url]));
      let imported = 0, skipped = 0;
      let changed = false;
      const review: Array<{ title: string; id: string }> = [];
      for (const entry of result.entries || []) {
        const parsed = parseTrackTitle(entry.title || "");
        if (!parsed || !/^[\w-]{11}$/.test(entry.id || "") || ["private", "needs_auth", "premium_only", "subscriber_only"].includes(entry.availability)) { skipped++; review.push({ title: entry.title, id: entry.id }); continue; }
        const sourceUrl = `https://www.youtube.com/watch?v=${entry.id}`;
        const existing = catalog.songs.find(song => song.sourceUrl === sourceUrl);
        if (existing) {
          if (!existing.categories.includes(category)) {
            existing.categories.push(category);
            changed = true;
          }
          continue;
        }
        catalog.songs.push({ id: Math.max(0, ...catalog.songs.map(song => song.id)) + 1, ...parsed, sourceUrl, categories: [category], clipKey: null, previewStart: 0, soundcloudTrackId: null, soundcloudUrl: null, active: true });
        imported++;
        changed = true;
      }
      if (changed) await writeCatalog(catalog);
      await writeFile(path.join(root, `review-${category}.json`), JSON.stringify(review, null, 2));
      console.log(`Imported ${imported} songs into ${category}; skipped ${skipped} entries needing review.${changed ? " Catalog updated." : " Catalog unchanged."}`);
    } else if (command === "find") {
      const query = normalizeBalkanText(process.argv.slice(3).join(" "));
      if (!query) throw new Error("Enter an artist or song title to find.");
      const matches = catalog.songs.filter(song => normalizeBalkanText(`${song.artist} ${song.title}`).includes(query));
      if (!matches.length) console.log("No matching songs.");
      else for (const song of matches) console.log(`${song.id}\t${song.artist} - ${song.title}\tstart=${song.previewStart}`);
    } else if (command === "start") {
      const songId = Number(process.argv[3]);
      const previewStart = Number(process.argv[4]);
      if (!Number.isInteger(songId) || songId < 1) throw new Error("Song ID must be a positive integer.");
      if (!Number.isFinite(previewStart) || previewStart < 0 || previewStart > 3600) throw new Error("Start must be between 0 and 3600 seconds.");
      const song = catalog.songs.find(candidate => candidate.id === songId);
      if (!song) throw new Error(`Song ${songId} was not found.`);
      await invalidateClip(song.clipKey);
      song.previewStart = previewStart;
      song.clipKey = null;
      await writeCatalog(catalog);
      console.log(`Song ${song.id} (${song.artist} - ${song.title}) will start at ${previewStart} seconds. Run prepare to rebuild its clip if it is assigned.`);
    } else if (command === "reclip") {
      const songId = Number(process.argv[3]);
      const previewStart = Number(process.argv[4]);
      if (!Number.isInteger(songId) || songId < 1) throw new Error("Song ID must be a positive integer.");
      if (!Number.isFinite(previewStart) || previewStart < 0 || previewStart > 3600) throw new Error("Start must be between 0 and 3600 seconds.");
      const song = catalog.songs.find(candidate => candidate.id === songId);
      if (!song) throw new Error(`Song ${songId} was not found.`);
      const previousKey = song.clipKey;
      const previousStart = song.previewStart;
      const replacement = await buildClip(song, previewStart, false);
      song.previewStart = replacement.previewStart;
      song.clipKey = replacement.key;
      try { await writeCatalog(catalog); }
      catch (error) {
        song.previewStart = previousStart;
        song.clipKey = previousKey;
        await writeCatalog(catalog).catch(() => undefined);
        await invalidateClip(replacement.key).catch(() => undefined);
        throw error;
      }
      if (previousKey && previousKey !== replacement.key) await invalidateClip(previousKey);
      console.log(`Rebuilt song ${song.id} (${song.artist} - ${song.title}) from ${previewStart} seconds.`);
    } else if (command === "prepare") {
      const days = Number(process.argv[3] || 7);
      if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error("Days must be between 1 and 30.");
      let failures = 0;
      for (const category of CATEGORIES) {
        const songs = catalog.songs.filter(song => song.active && song.categories.includes(category.id));
        if (!songs.length) continue;
        for (let offset = 0; offset < days; offset++) {
          const date = dateOffset(getCurrentChallengeDate(), offset);
          const dayKey = `${date}:${category.id}`;
          const assignedId = catalog.days[dayKey];
          const assignedSong = assignedId ? songs.find(song => song.id === assignedId) : undefined;
          if (assignedSong?.clipKey) {
            if (await clipExists(assignedSong.clipKey)) continue;
            assignedSong.clipKey = null;
          }
          const used = new Set(Object.entries(catalog.days).filter(([key]) => key.endsWith(`:${category.id}`)).map(([, id]) => id));
          const pool = assignedSong ? [assignedSong] : songs.some(song => !used.has(song.id)) ? songs.filter(song => !used.has(song.id)) : songs;
          const start = stableIndex(dayKey, pool.length);
          let prepared = false;
          for (let attempt = 0; attempt < Math.min(pool.length, 5); attempt++) {
            const song = pool[(start + attempt) % pool.length];
            try {
              if (song.clipKey) {
                if (!await clipExists(song.clipKey)) song.clipKey = null;
              }
              if (!song.clipKey) {
                const built = await buildClip(song, song.previewStart, true);
                song.previewStart = built.previewStart;
                song.clipKey = built.key;
              }
              catalog.days[dayKey] = song.id;
              await writeCatalog(catalog);
              console.log(`Ready: ${dayKey}`);
              prepared = true;
              break;
            } catch (error) {
              if (youtubeBlocked(error)) throw new Error("YouTube blocked this runner's IP address. Use the configured self-hosted home runner.", { cause: error });
              console.error(`Preparation failed for song ${song.id}:`, error instanceof Error ? error.message : error);
            }
          }
          if (!prepared) failures++;
        }
      }
      if (failures) throw new Error(`${failures} challenges could not be prepared. Existing assignments were retained.`);
    } else if (command === "publish") {
      const { prisma } = await import("../lib/prisma");
      try {
        // Source URLs map development IDs to database IDs, preserving the legacy catalog.
        const ids = new Map<number, number>();
        for (let index = 0; index < catalog.songs.length; index += 100) {
          const batch = catalog.songs.slice(index, index + 100);
          const stored = await prisma.$transaction(batch.map(song => {
            if (!song.sourceUrl) throw new Error(`Song ${song.id} has no source URL.`);
            const { id: _localId, ...values } = song;
            void _localId;
            const data = { ...values, normalizedTitle: normalizeBalkanText(song.title), normalizedArtist: normalizeBalkanText(song.artist) };
            return prisma.song.upsert({ where: { sourceUrl: song.sourceUrl }, create: data, update: data });
          }));
          stored.forEach((song, offset) => ids.set(batch[offset].id, song.id));
        }
        for (const [key, localId] of Object.entries(catalog.days)) {
          const [date, category] = key.split(":");
          const song = catalog.songs.find(song => song.id === localId);
          if (!song?.clipKey) throw new Error(`Missing clip for ${key}`);
          if (!await clipExists(song.clipKey)) throw new Error(`Missing clip for ${key}`);
          const songId = ids.get(localId)!;
          await prisma.dailySong.upsert({ where: { date_category: { date, category } }, create: { date, category, songId }, update: { songId } });
        }
        console.log("Published catalog and prepared assignments to PostgreSQL.");
      } finally {
        await prisma.$disconnect();
      }
    } else throw new Error("Usage: playlist.ts import CATEGORY URL | find QUERY | start SONG_ID SECONDS | reclip SONG_ID SECONDS | prepare [DAYS] | publish");
  } finally { await lock.close(); await unlink(lockPath); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
