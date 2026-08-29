import { prisma } from "@/lib/prisma";
import { getCurrentChallengeDate, stableIndex } from "@/lib/challenge";
export async function getDailySong(date = getCurrentChallengeDate()) {
  const explicit = await prisma.dailySong.findUnique({ where: { date }, include: { song: true } });
  if (explicit?.song.active) return explicit.song;
  const songs = await prisma.song.findMany({ where: { active: true }, orderBy: { id: "asc" } });
  if (!songs.length) return null;
  return songs[stableIndex(date, songs.length)];
}
