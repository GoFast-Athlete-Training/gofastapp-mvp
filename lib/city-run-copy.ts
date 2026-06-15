export type RunClubSummary = {
  slug?: string;
  name: string;
  logoUrl?: string | null;
  city?: string | null;
};

export { isClubRun } from '@/lib/city-run-type';

/** Parse city-run calendar date (UTC midnight) without timezone day shift. */
export function parseRunCalendarDate(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Human short date: "this past Wednesday" for recent runs, else "Wednesday, Jun 10". */
export function formatRunLookBackDate(iso: string | null | undefined): string {
  const runDate = parseRunCalendarDate(iso);
  if (!runDate) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today.getTime() - runDate.getTime()) / (24 * 60 * 60 * 1000));
  const weekday = runDate.toLocaleDateString('en-US', { weekday: 'long' });

  if (diffDays >= 1 && diffDays <= 7) {
    return `this past ${weekday}`;
  }

  return runDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/** @deprecated Use formatRunLookBackDate */
export const formatRunRecapDate = formatRunLookBackDate;

export function resolveRunClubLabel(
  runClub?: RunClubSummary | null,
  fallbackTitle?: string | null
): string {
  if (runClub?.name?.trim()) return runClub.name.trim();
  if (fallbackTitle?.trim()) return fallbackTitle.trim();
  return 'your run club';
}

export function buildClubRsvpCopy(runClub?: RunClubSummary | null): {
  prompt: string;
  goingLabel: string;
} {
  const club = resolveRunClubLabel(runClub);
  return {
    prompt: `Let ${club} know you're planning to show up`,
    goingLabel: "I'm going",
  };
}

export function buildClubPastCheckinCopy(runClub?: RunClubSummary | null): {
  prompt: string;
  buttonLabel: string;
  ctaHeadline: string;
  ctaSubline: string;
} {
  const club = resolveRunClubLabel(runClub);
  return {
    prompt: `Let ${club} know you were there`,
    buttonLabel: 'Were you there? →',
    ctaHeadline: `Were you at ${club}?`,
    ctaSubline: 'Check in and see who else showed up',
  };
}

export function buildClubCheckinScreenCopy(runClub?: RunClubSummary | null): {
  header: string;
  subline: string;
  confirmLabel: string;
} {
  const club = resolveRunClubLabel(runClub);
  return {
    header: `You made it? Let ${club} know.`,
    subline: 'Confirm you showed up. Add an optional shout-out and photo for the crew.',
    confirmLabel: `Tell ${club} I showed up`,
  };
}

export function buildClubRunReminderCopy(
  runClub: RunClubSummary | null | undefined,
  kind: 'tomorrow' | 'today' | 'missed'
): { title: string; body: string } {
  const club = resolveRunClubLabel(runClub);
  if (kind === 'tomorrow') {
    return {
      title: `Club run tomorrow`,
      body: `You have a club run with ${club} tomorrow — don't forget to check in when you get there.`,
    };
  }
  if (kind === 'today') {
    return {
      title: `${club} run today`,
      body: `${club} run today — check in when you arrive so the crew knows you made it.`,
    };
  }
  return {
    title: `Were you at ${club}?`,
    body: `Were you at ${club} yesterday? Check in and see who else showed up.`,
  };
}

export function buildPostRunCtaCopy(opts: {
  runClub?: RunClubSummary | null;
  runTitle?: string | null;
  runDate: string;
  ctaTarget: 'checkin' | 'shouts';
}): { headline: string; subline: string; buttonLabel: string } {
  const clubLabel = resolveRunClubLabel(opts.runClub, opts.runTitle);
  const dateLabel = formatRunLookBackDate(opts.runDate);
  const datePhrase = dateLabel ? ` ${dateLabel}` : '';

  if (opts.ctaTarget === 'checkin') {
    return {
      headline: `Were you at ${clubLabel}${datePhrase}?`,
      subline: 'Check in and see who else showed up',
      buttonLabel: 'Check in',
    };
  }

  return {
    headline: `You ran with ${clubLabel}${datePhrase}`,
    subline: 'See who showed up and share how it felt',
    buttonLabel: 'Add a shout-out',
  };
}

export function buildPostRunHeroHeadline(opts: {
  runClub?: RunClubSummary | null;
  runTitle?: string | null;
  runDate: string;
}): string {
  const clubLabel = resolveRunClubLabel(opts.runClub, opts.runTitle);
  const dateLabel = formatRunLookBackDate(opts.runDate);
  if (dateLabel) return `You ran with ${clubLabel} ${dateLabel}`;
  return `You ran with ${clubLabel}`;
}
