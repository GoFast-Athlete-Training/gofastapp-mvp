export type RunClubSummary = {
  slug?: string;
  name: string;
  logoUrl?: string | null;
  city?: string | null;
};

import {
  hasSocialRunLifecycle,
  isClubRun,
  isIndividualHostedRun,
} from '@/lib/city-run-type';

export { hasSocialRunLifecycle, isClubRun, isIndividualHostedRun };

export type RunSocialCopyContext = {
  cityRunType?: string | null;
  runClub?: RunClubSummary | null;
  title?: string | null;
  athleteGeneratedId?: string | null;
  host?: { firstName?: string | null; lastName?: string | null; gofastHandle?: string | null } | null;
};

export function resolveHostLabel(
  host?: RunSocialCopyContext['host'],
  fallbackTitle?: string | null
): string {
  if (host?.firstName?.trim()) {
    const last = host.lastName?.trim();
    return last ? `${host.firstName.trim()} ${last}` : host.firstName.trim();
  }
  if (host?.gofastHandle?.trim()) return `@${host.gofastHandle.trim()}`;
  if (fallbackTitle?.trim()) return fallbackTitle.trim();
  return 'your host';
}

export function buildHostedRunRsvpCopy(ctx: RunSocialCopyContext): {
  prompt: string;
  goingLabel: string;
} {
  const host = resolveHostLabel(ctx.host, ctx.title);
  return {
    prompt: `Let ${host} know you're planning to show up`,
    goingLabel: "I'm going",
  };
}

export function buildHostedRunPastCheckinCopy(ctx: RunSocialCopyContext): {
  prompt: string;
  buttonLabel: string;
  ctaHeadline: string;
  ctaSubline: string;
} {
  const host = resolveHostLabel(ctx.host, ctx.title);
  return {
    prompt: `Let ${host} know you were there`,
    buttonLabel: 'Were you there? →',
    ctaHeadline: `Were you at ${host}'s run?`,
    ctaSubline: 'Check in and see who else showed up',
  };
}

export function buildHostedRunCheckinScreenCopy(ctx: RunSocialCopyContext): {
  header: string;
  subline: string;
  confirmLabel: string;
} {
  const host = resolveHostLabel(ctx.host, ctx.title);
  return {
    header: `You made it? Let ${host} know.`,
    subline: 'Confirm you showed up. Add an optional shout-out and photo for the crew.',
    confirmLabel: 'Check in',
  };
}

export function resolveRunRsvpCopy(ctx: RunSocialCopyContext) {
  if (isIndividualHostedRun(ctx)) return buildHostedRunRsvpCopy(ctx);
  return buildClubRsvpCopy(ctx.runClub);
}

export function resolveRunPastCheckinCopy(ctx: RunSocialCopyContext) {
  if (isIndividualHostedRun(ctx)) return buildHostedRunPastCheckinCopy(ctx);
  return buildClubPastCheckinCopy(ctx.runClub);
}

export function resolveRunCheckinScreenCopy(ctx: RunSocialCopyContext) {
  if (isIndividualHostedRun(ctx)) return buildHostedRunCheckinScreenCopy(ctx);
  return buildClubCheckinScreenCopy(ctx.runClub);
}

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
  cityRunType?: string | null;
  runClub?: RunClubSummary | null;
  runTitle?: string | null;
  runDate: string;
  ctaTarget: 'checkin' | 'shouts';
  host?: RunSocialCopyContext['host'];
}): { headline: string; subline: string; buttonLabel: string } {
  const socialCtx: RunSocialCopyContext = {
    cityRunType: opts.cityRunType,
    runClub: opts.runClub,
    title: opts.runTitle,
    host: opts.host,
  };
  if (isIndividualHostedRun(socialCtx)) {
    const host = resolveHostLabel(opts.host, opts.runTitle);
    const dateLabel = formatRunLookBackDate(opts.runDate);
    const datePhrase = dateLabel ? ` ${dateLabel}` : '';
    if (opts.ctaTarget === 'checkin') {
      return {
        headline: `Were you at ${host}'s run${datePhrase}?`,
        subline: 'Check in and see who else showed up',
        buttonLabel: 'Check in',
      };
    }
    return {
      headline: `You ran with ${host}${datePhrase}`,
      subline: 'See who showed up and share how it felt',
      buttonLabel: 'Add a shout-out',
    };
  }

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
  cityRunType?: string | null;
  runClub?: RunClubSummary | null;
  runTitle?: string | null;
  runDate: string;
  host?: RunSocialCopyContext['host'];
}): string {
  const socialCtx: RunSocialCopyContext = {
    cityRunType: opts.cityRunType,
    runClub: opts.runClub,
    title: opts.runTitle,
    host: opts.host,
  };
  if (isIndividualHostedRun(socialCtx)) {
    const host = resolveHostLabel(opts.host, opts.runTitle);
    const dateLabel = formatRunLookBackDate(opts.runDate);
    if (dateLabel) return `You ran with ${host} ${dateLabel}`;
    return `You ran with ${host}`;
  }

  const clubLabel = resolveRunClubLabel(opts.runClub, opts.runTitle);
  const dateLabel = formatRunLookBackDate(opts.runDate);
  if (dateLabel) return `You ran with ${clubLabel} ${dateLabel}`;
  return `You ran with ${clubLabel}`;
}
