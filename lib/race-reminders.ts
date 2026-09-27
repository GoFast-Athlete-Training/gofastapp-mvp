import { prisma } from "@/lib/prisma";
import { sendAppNotification } from "@/lib/app-notifications/send";
import type { NotificationTemplateKey } from "@/lib/app-notifications/types";
import { publishProductEvent } from "@/lib/publish-product-event";
import { myRacePlannerHref } from "@/lib/races/athlete-race-signup-display";
import { calendarDayKeyInTimezone } from "@/lib/race-calendar-phase";
import { addDaysUtc, utcDateOnly } from "@/lib/training/plan-utils";

export type RaceReminderKind = "week_out" | "day_before" | "race_day";

function kindToTemplate(kind: RaceReminderKind): NotificationTemplateKey {
  switch (kind) {
    case "week_out":
      return "race.weekOut";
    case "day_before":
      return "race.dayBefore";
    case "race_day":
      return "race.raceDay";
  }
}

function kindToProductEventSlug(
  trigger: {
    weekOutProductEventSlug: string;
    reminderProductEventSlug: string;
    raceDayProductEventSlug: string;
  },
  kind: RaceReminderKind
): string {
  switch (kind) {
    case "week_out":
      return trigger.weekOutProductEventSlug;
    case "day_before":
      return trigger.reminderProductEventSlug;
    case "race_day":
      return trigger.raceDayProductEventSlug;
  }
}

function notifiedField(kind: RaceReminderKind) {
  switch (kind) {
    case "week_out":
      return "raceWeekOutNotifiedAt" as const;
    case "day_before":
      return "raceDayBeforeNotifiedAt" as const;
    case "race_day":
      return "raceDayNotifiedAt" as const;
  }
}

function pushCopy(kind: RaceReminderKind, raceName: string) {
  const name = raceName.trim() || "Your race";
  switch (kind) {
    case "week_out":
      return {
        title: "Race week is here",
        body: `${name} is one week out — open your race plan for pace and splits.`,
      };
    case "day_before":
      return {
        title: "Ready to go? You got this!",
        body: `Finalize your goal pace and set your pacing for ${name}.`,
      };
    case "race_day":
      return {
        title: "Race day",
        body: `Go crush it at ${name}! Your race plan is one tap away.`,
      };
  }
}

export async function processRaceReminders(now = new Date()) {
  const today = utcDateOnly(now);
  const todayKey = calendarDayKeyInTimezone(now);
  const windowStart = addDaysUtc(today, -1);
  const windowEnd = addDaysUtc(today, 1);

  const triggers = await prisma.race_triggers.findMany({
    where: {
      OR: [
        { weekOutDate: { gte: windowStart, lte: windowEnd } },
        { reminderDate: { gte: windowStart, lte: windowEnd } },
        { raceDate: { gte: windowStart, lte: windowEnd } },
      ],
    },
    include: {
      race_registry: { select: { name: true } },
      members: {
        where: { notifyEnabled: true },
        include: {
          athlete_race: {
            select: {
              id: true,
              slug: true,
              raceRegistryId: true,
              raceWeekOutNotifiedAt: true,
              raceDayBeforeNotifiedAt: true,
              raceDayNotifiedAt: true,
            },
          },
          Athlete: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  let candidates = 0;
  let pushesSent = 0;
  let emailsPublished = 0;

  for (const trigger of triggers) {
    const raceName = trigger.race_registry.name;
    let kind: RaceReminderKind | null = null;
    if (calendarDayKeyInTimezone(trigger.weekOutDate) === todayKey) kind = "week_out";
    else if (calendarDayKeyInTimezone(trigger.reminderDate) === todayKey) kind = "day_before";
    else if (calendarDayKeyInTimezone(trigger.raceDate) === todayKey) kind = "race_day";
    if (!kind) continue;

    const field = notifiedField(kind);
    const templateKey = kindToTemplate(kind);
    const productSlug = kindToProductEventSlug(trigger, kind);
    const copy = pushCopy(kind, raceName);

    for (const member of trigger.members) {
      const ar = member.athlete_race;
      if (!ar) continue;
      const notifiedAt = ar[field];
      if (notifiedAt && calendarDayKeyInTimezone(notifiedAt) === todayKey) continue;

      candidates += 1;
      const deeplink = myRacePlannerHref(ar.slug, ar.raceRegistryId);

      const pushResult = await sendAppNotification({
        athleteId: member.athleteId,
        templateKey,
        objectType: "athlete_race",
        objectId: ar.id,
        deeplink,
        payload: { raceRegistryId: ar.raceRegistryId, reminderKind: kind },
        facts: {
          raceName,
          body: copy.body,
          title: copy.title,
        },
      });
      pushesSent += pushResult.pushesSent;

      const athlete = member.Athlete;
      if (athlete?.email?.trim()) {
        publishProductEvent(productSlug, {
          email: athlete.email,
          firstName: athlete.firstName,
          lastName: athlete.lastName,
          athleteId: athlete.id,
          raceRegistryId: ar.raceRegistryId,
          athleteRaceId: ar.id,
          raceName,
          reminderKind: kind,
          plannerUrl: deeplink,
        });
        emailsPublished += 1;
      }

      await prisma.athlete_races.update({
        where: { id: ar.id },
        data: { [field]: today },
      });
    }
  }

  return { candidates, pushesSent, emailsPublished, triggersMatched: triggers.length };
}
