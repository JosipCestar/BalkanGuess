import "dotenv/config";
import { prisma } from "../lib/prisma";
import { dailyResultRetentionCutoff, RETENTION_DAYS } from "../lib/result-retention";

const cutoff = dailyResultRetentionCutoff();

try {
  const result = await prisma.dailyResult.deleteMany({ where: { date: { lt: cutoff } } });
  console.log(`Removed ${result.count} anonymous result rows older than ${RETENTION_DAYS} days; aggregates were preserved.`);
} finally {
  await prisma.$disconnect();
}
