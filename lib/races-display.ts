/** Shared formatting for races browse + calendar views. */

export function formatRaceListDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function daysUntilRace(iso: string): number {
  const s = iso.trim();
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startRace = ymd
    ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    : (() => {
        const race = new Date(s.includes("T") ? s : s);
        return new Date(race.getFullYear(), race.getMonth(), race.getDate());
      })();
  startRace.setHours(0, 0, 0, 0);
  return Math.round((startRace.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function countdownLabel(iso: string): string {
  const d = daysUntilRace(iso);
  if (d < 0) return "Past race";
  if (d === 0) return "Race day!";
  if (d === 1) return "1 day away";
  return `${d} days away`;
}

/** Race catalog start time: plain label from sync (e.g. "10:00 AM") or legacy ISO-ish strings. */
export function formatStartTime(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  // Wall-clock labels from GoFastCompany — show as-is (no UTC conversion).
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s;
  }
  try {
    const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}
