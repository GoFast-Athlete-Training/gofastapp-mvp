/**
 * Prisma Data Normalizer
 * 
 * Normalizes Prisma snake_case relation names to camelCase for frontend consumption.
 * This allows the frontend to use consistent camelCase property names regardless of
 * Prisma's snake_case model names.
 */

/**
 * Normalizes a membership object:
 * - `Athlete` → `athlete` (lowercase)
 * - `run_crews` → `runCrew` (camelCase)
 */
export function normalizeMembership(membership: any): any {
  if (!membership) return membership;

  const normalized: any = {
    ...membership,
  };

  // Normalize Athlete relation (capitalized → lowercase)
  if (membership.Athlete) {
    normalized.athlete = membership.Athlete;
    // Keep both for backward compatibility during transition
  } else if (membership.athlete) {
    normalized.athlete = membership.athlete;
  }

  // Normalize run_crews relation (snake_case → camelCase)
  if (membership.run_crews) {
    normalized.runCrew = membership.run_crews;
    // Keep both for backward compatibility during transition
  } else if (membership.runCrew) {
    normalized.runCrew = membership.runCrew;
  }

  return normalized;
}

/**
 * Normalizes an array of memberships
 */
export function normalizeMemberships(memberships: any[]): any[] {
  if (!Array.isArray(memberships)) return memberships;
  return memberships.map(normalizeMembership);
}

/**
 * Normalizes a message object:
 * - `Athlete` → `athlete` (lowercase)
 */
export function normalizeMessage(message: any): any {
  if (!message) return message;

  const normalized: any = {
    ...message,
  };

  // Normalize Athlete relation
  if (message.Athlete) {
    normalized.athlete = message.Athlete;
  } else if (message.athlete) {
    normalized.athlete = message.athlete;
  }

  return normalized;
}

/**
 * Normalizes an array of messages
 */
export function normalizeMessages(messages: any[]): any[] {
  if (!Array.isArray(messages)) return messages;
  return messages.map(normalizeMessage);
}

/**
 * Normalizes an announcement object:
 * - `Athlete` → `athlete` (lowercase)
 */
export function normalizeAnnouncement(announcement: any): any {
  if (!announcement) return announcement;

  const normalized: any = {
    ...announcement,
  };

  // Normalize Athlete relation
  if (announcement.Athlete) {
    normalized.athlete = announcement.Athlete;
  } else if (announcement.athlete) {
    normalized.athlete = announcement.athlete;
  }

  return normalized;
}

/**
 * Normalizes an array of announcements
 */
export function normalizeAnnouncements(announcements: any[]): any[] {
  if (!Array.isArray(announcements)) return announcements;
  return announcements.map(normalizeAnnouncement);
}

/**
 * Normalizes a run object:
 * - `Athlete` → `athlete` (lowercase)
 * - `run_crew_run_rsvps` → `rsvps` (simplified)
 */
export function normalizeRun(run: any): any {
  if (!run) return run;

  const normalized: any = {
    ...run,
  };

  // Normalize Athlete relation (for createdBy)
  if (run.Athlete) {
    normalized.athlete = run.Athlete;
    normalized.createdBy = run.Athlete;
  } else if (run.athlete) {
    normalized.athlete = run.athlete;
    normalized.createdBy = run.athlete;
  }

  // Normalize RSVPs
  if (run.run_crew_run_rsvps) {
    normalized.rsvps = normalizeRsvps(run.run_crew_run_rsvps);
  } else if (run.rsvps) {
    normalized.rsvps = normalizeRsvps(run.rsvps);
  }

  return normalized;
}

/**
 * Normalizes an array of runs
 */
export function normalizeRuns(runs: any[]): any[] {
  if (!Array.isArray(runs)) return runs;
  return runs.map(normalizeRun);
}

/**
 * Normalizes an RSVP object:
 * - `Athlete` → `athlete` (lowercase)
 */
export function normalizeRsvp(rsvp: any): any {
  if (!rsvp) return rsvp;

  const normalized: any = {
    ...rsvp,
  };

  // Normalize Athlete relation
  if (rsvp.Athlete) {
    normalized.athlete = rsvp.Athlete;
  } else if (rsvp.athlete) {
    normalized.athlete = rsvp.athlete;
  }

  return normalized;
}

/**
 * Normalizes an array of RSVPs
 */
export function normalizeRsvps(rsvps: any[]): any[] {
  if (!Array.isArray(rsvps)) return rsvps;
  return rsvps.map(normalizeRsvp);
}

/**
 * Normalizes a membership with nested runCrew data
 * Used in hydrateAthlete where memberships include run_crews
 */
export function normalizeMembershipWithRunCrew(membership: any): any {
  if (!membership) return membership;

  const normalized: any = {
    ...membership,
  };

  // Normalize run_crews → runCrew
  if (membership.run_crews) {
    normalized.runCrew = membership.run_crews;
  } else if (membership.runCrew) {
    normalized.runCrew = membership.runCrew;
  }

  return normalized;
}

/**
 * Normalizes the entire crew hydration response
 */
export function normalizeCrewResponse(crew: any): any {
  if (!crew) return crew;

  return {
    ...crew,
    membershipsBox: crew.membershipsBox
      ? {
          ...crew.membershipsBox,
          memberships: normalizeMemberships(crew.membershipsBox.memberships || []),
        }
      : crew.membershipsBox,
    messagesBox: crew.messagesBox
      ? {
          ...crew.messagesBox,
          messages: normalizeMessages(crew.messagesBox.messages || []),
        }
      : crew.messagesBox,
    announcementsBox: crew.announcementsBox
      ? {
          ...crew.announcementsBox,
          announcements: normalizeAnnouncements(crew.announcementsBox.announcements || []),
        }
      : crew.announcementsBox,
    runsBox: crew.runsBox
      ? {
          ...crew.runsBox,
          runs: normalizeRuns(crew.runsBox.runs || []),
        }
      : crew.runsBox,
  };
}

/**
 * Normalizes athlete hydration response memberships
 */
export function normalizeAthleteMemberships(memberships: any[]): any[] {
  if (!Array.isArray(memberships)) return memberships;
  return memberships.map(normalizeMembershipWithRunCrew);
}




