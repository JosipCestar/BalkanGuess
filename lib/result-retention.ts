const RETENTION_DAYS = 35;

export function dailyResultRetentionCutoff(now = new Date(), retentionDays = RETENTION_DAYS) {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  return cutoff.toISOString().slice(0, 10);
}

export { RETENTION_DAYS };
