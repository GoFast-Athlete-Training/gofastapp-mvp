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
  const race = new Date(iso);
  const today = new Date();
  const startRace = new Date(race.getFullYear(), race.getMonth(), race.getDate());
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((startRace.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24));
}

export function countdownLabel(iso: string): string {
  const d = daysUntilRace(iso);
  if (d < 0) return "Past race";
  if (d === 0) return "Race day!";
  if (d === 1) return "1 day away";
  return `${d} days away`;
}

export function formatStartTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}
