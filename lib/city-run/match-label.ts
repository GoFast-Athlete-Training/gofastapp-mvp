const DAY_ABBR: Record<string, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thurs',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

function abbreviateClubToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'Club';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const w = words[0]!;
    return w.length <= 6 ? w.toUpperCase() : w.slice(0, 4).toUpperCase();
  }
  return words
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 6);
}

export function resolveClubMatchToken(club: {
  matchToken?: string | null;
  slug?: string | null;
  name?: string | null;
}): string {
  const explicit = club.matchToken?.trim();
  if (explicit) return explicit;
  const fromSlug = club.slug?.trim();
  if (fromSlug) return abbreviateClubToken(fromSlug.replace(/-/g, ' '));
  return abbreviateClubToken(club.name ?? 'Club');
}

export function dayAbbrFromRun(dayOfWeek: string | null | undefined, date: Date): string {
  if (dayOfWeek?.trim()) {
    const key = dayOfWeek.trim().toUpperCase();
    if (DAY_ABBR[key]) return DAY_ABBR[key]!;
  }
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thurs', 'Fri', 'Sat'];
  return names[date.getUTCDay()] ?? 'Day';
}

/** e.g. "DCCR Thurs Tempo" — club token + day + workout title (not renamed). */
export function buildCityRunMatchLabel(opts: {
  club: { matchToken?: string | null; slug?: string | null; name?: string | null };
  dayOfWeek?: string | null;
  runDate: Date;
  workoutTitle: string;
}): string {
  const clubToken = resolveClubMatchToken(opts.club);
  const day = dayAbbrFromRun(opts.dayOfWeek, opts.runDate);
  const title = opts.workoutTitle.trim() || 'Run';
  return `${clubToken} ${day} ${title}`;
}
