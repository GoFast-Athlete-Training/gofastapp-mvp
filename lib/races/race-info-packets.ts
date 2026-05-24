import { daysUntilRace } from "@/lib/races-display";
import {
  currentTrainingWeekNumber,
  effectiveTrainingWeekCount,
} from "@/lib/training/plan-utils";
import type {
  RaceInfoPacket,
  RaceInfoPacketAthleteContext,
  RaceInfoPacketKind,
  RaceInfoPacketPhase,
  RaceInfoPacketRaceInput,
  RaceInfoPacketsResponse,
  RaceInfoSourceCompleteness,
} from "./race-info-packet-types";

function trim(s: string | null | undefined): string | null {
  const t = s?.trim();
  return t || null;
}

export function raceInfoPhase(daysUntil: number): RaceInfoPacketPhase {
  if (daysUntil < 0) return "past";
  if (daysUntil === 0) return "raceDay";
  if (daysUntil <= 7) return "raceWeek";
  return "preRace";
}

function formatPickupDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  try {
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function completenessFromFields(present: number, total: number): RaceInfoSourceCompleteness {
  if (present <= 0) return "empty";
  if (present >= total) return "full";
  return "partial";
}

function buildRegistrationPacket(
  race: RaceInfoPacketRaceInput,
  athlete: RaceInfoPacketAthleteContext,
  daysUntil: number
): RaceInfoPacket {
  const url = trim(race.registrationUrl);
  const openLabel = race.registrationOpenNow
    ? "Registration is open"
    : race.registrationOpenDate
      ? `Opens ${formatPickupDate(race.registrationOpenDate)}`
      : null;
  const closeLabel = race.registrationCloseDate
    ? `Closes ${formatPickupDate(race.registrationCloseDate)}`
    : null;
  const feeLabel =
    race.registrationFee != null && Number.isFinite(race.registrationFee)
      ? `$${race.registrationFee.toFixed(0)}`
      : null;

  const items: RaceInfoPacket["items"] = [];
  if (openLabel) items.push({ label: "Status", value: openLabel });
  if (closeLabel) items.push({ label: "Deadline", value: closeLabel });
  if (feeLabel) items.push({ label: "Fee", value: feeLabel });

  const hasData = Boolean(url || items.length > 0);
  const visible = !athlete.isSignedUp && hasData && daysUntil >= 0;

  return {
    kind: "registration",
    title: "Register for this race",
    summary: "Sign up with the race organizer before race week.",
    priority: visible ? 10 : 99,
    visible,
    emphasized: visible && daysUntil > 7,
    availableFromDaysBeforeRace: null,
    items,
    registrationUrl: url,
    sourceCompleteness: completenessFromFields(
      [url, openLabel, closeLabel, feeLabel].filter(Boolean).length,
      4
    ),
  };
}

function buildCoursePacket(
  race: RaceInfoPacketRaceInput,
  daysUntil: number,
  phase: RaceInfoPacketPhase
): RaceInfoPacket {
  const segments = (race.courseSegments ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      order: s.order,
      name: s.name,
      mileMarker: s.mileMarker ?? null,
      description: s.description ?? null,
      runTip: s.runTip ?? null,
    }));

  const courseMapUrl = trim(race.courseMapUrl);
  const courseSlug = trim(race.courseSlug);
  const tagline = trim(race.summaryPhrase);
  const description = trim(race.description);

  const hasData = Boolean(
    courseSlug || courseMapUrl || segments.length > 0 || tagline || description
  );
  const visible = hasData && daysUntil >= 0;

  return {
    kind: "course",
    title: race.distanceLabel?.trim()
      ? `Course — ${race.distanceLabel.trim()}`
      : "Course",
    summary: tagline ?? "Know the route before race week.",
    priority: phase === "raceWeek" || phase === "raceDay" ? 35 : 30,
    visible,
    emphasized: visible && (phase === "preRace" || phase === "raceWeek"),
    items: description ? [{ label: "Overview", value: description }] : [],
    segments: segments.length > 0 ? segments : undefined,
    courseMapUrl,
    courseSlug,
    sourceCompleteness: completenessFromFields(
      [courseSlug, courseMapUrl, segments.length > 0, description].filter(Boolean).length,
      4
    ),
  };
}

function buildTrainingTipsPacket(
  race: RaceInfoPacketRaceInput,
  athlete: RaceInfoPacketAthleteContext,
  phase: RaceInfoPacketPhase,
  daysUntil: number
): RaceInfoPacket {
  const training = athlete.training;
  const tipSegments = (race.courseSegments ?? []).filter((s) => trim(s.runTip));
  const items: RaceInfoPacket["items"] = [];

  if (training?.hasActivePlan && training.planName) {
    const week =
      training.weekNumber != null && training.totalWeeks != null
        ? `Week ${training.weekNumber} of ${training.totalWeeks}`
        : null;
    items.push({
      label: "Training plan",
      value: week ? `${training.planName} · ${week}` : training.planName,
    });
  } else if (training?.goalTime) {
    items.push({ label: "Goal", value: training.goalTime });
  }

  for (const seg of tipSegments.slice(0, 5)) {
    items.push({
      label: seg.name,
      value: trim(seg.runTip)!,
    });
  }

  const hasData = items.length > 0;
  const visible = athlete.isSignedUp && hasData && daysUntil >= 0;

  return {
    kind: "trainingTips",
    title: phase === "raceWeek" ? "Race-week prep" : "Training tips",
    summary:
      phase === "raceWeek"
        ? "Stay on plan and review course notes."
        : "Build toward race day with your plan and course tips.",
    priority: phase === "raceWeek" ? 25 : 20,
    visible,
    emphasized: visible && phase === "preRace",
    items,
    sourceCompleteness: completenessFromFields(items.length, Math.max(items.length, 1)),
  };
}

function buildPacketPickupPacket(
  race: RaceInfoPacketRaceInput,
  phase: RaceInfoPacketPhase,
  daysUntil: number
): RaceInfoPacket {
  const location = trim(race.packetPickupLocation);
  const time = trim(race.packetPickupTime);
  const dateLabel = formatPickupDate(race.packetPickupDate);
  const notes = trim(race.packetPickupDescription);

  const items: RaceInfoPacket["items"] = [];
  if (location) items.push({ label: "Location", value: location });
  if (dateLabel || time) {
    items.push({
      label: "When",
      value: [dateLabel, time].filter(Boolean).join(" · "),
    });
  }
  if (notes) items.push({ label: "Notes", value: notes });

  const hasData = items.length > 0;
  const visible = hasData && daysUntil >= 0 && daysUntil <= 7;
  const emphasized = visible && (phase === "raceWeek" || phase === "raceDay");

  return {
    kind: "packetPickup",
    title: "Packet pickup",
    summary: "Get your bib before race morning.",
    priority: emphasized ? 15 : 45,
    visible,
    emphasized,
    availableFromDaysBeforeRace: 7,
    items,
    sourceCompleteness: completenessFromFields(items.length, 3),
  };
}

function buildArrivalPacket(
  race: RaceInfoPacketRaceInput,
  phase: RaceInfoPacketPhase,
  daysUntil: number
): RaceInfoPacket {
  const logistics = trim(race.logisticsInfo);
  const gear = trim(race.gearDropInstructions);
  const spectators = trim(race.spectatorInfo);

  const items: RaceInfoPacket["items"] = [];
  if (logistics) items.push({ label: "Getting there", value: logistics });
  if (gear) items.push({ label: "Gear drop", value: gear });
  if (spectators) items.push({ label: "Spectators", value: spectators });

  const hasData = items.length > 0;
  const visible = hasData && daysUntil >= 0 && daysUntil <= 7;
  const emphasized = visible && daysUntil <= 3;

  return {
    kind: "arrival",
    title: "Arrival & logistics",
    summary: "Parking, transit, and race-morning logistics.",
    priority: emphasized ? 12 : 48,
    visible,
    emphasized,
    availableFromDaysBeforeRace: 3,
    items,
    sourceCompleteness: completenessFromFields(items.length, 3),
  };
}

function buildRaceDayGuidePacket(
  race: RaceInfoPacketRaceInput,
  athlete: RaceInfoPacketAthleteContext,
  phase: RaceInfoPacketPhase,
  daysUntil: number,
  pickup: RaceInfoPacket,
  arrival: RaceInfoPacket
): RaceInfoPacket {
  const startTime = trim(race.startTime);
  const items: RaceInfoPacket["items"] = [];

  if (startTime) items.push({ label: "Start time", value: startTime });

  for (const src of [pickup, arrival]) {
    if (!src.visible) continue;
    for (const item of src.items) {
      items.push({
        label: src.kind === "packetPickup" ? `Pickup · ${item.label}` : item.label,
        value: item.value,
      });
    }
  }

  const hasData = items.length > 0;
  const visible =
    athlete.isSignedUp &&
    hasData &&
    daysUntil >= 0 &&
    (phase === "raceWeek" || phase === "raceDay");

  return {
    kind: "raceDayGuide",
    title: phase === "raceDay" ? "Race day instructions" : "Race week guide",
    summary: "Everything you need for the next few days.",
    priority: 5,
    visible,
    emphasized: visible,
    availableFromDaysBeforeRace: 7,
    items,
    sourceCompleteness: completenessFromFields(items.length, Math.max(items.length, 1)),
  };
}

function pickPrimaryPacket(packets: RaceInfoPacket[]): RaceInfoPacketKind | null {
  const visible = packets.filter((p) => p.visible);
  if (visible.length === 0) return null;

  const emphasized = visible.filter((p) => p.emphasized).sort((a, b) => a.priority - b.priority);
  if (emphasized.length > 0) return emphasized[0]!.kind;

  const sorted = visible.slice().sort((a, b) => a.priority - b.priority);
  return sorted[0]!.kind;
}

/** Pure builder — maps registry + athlete context into ordered info packets. */
export function buildRaceInfoPackets(
  race: RaceInfoPacketRaceInput,
  athlete: RaceInfoPacketAthleteContext,
  now: Date = new Date()
): RaceInfoPacketsResponse {
  const raceDateIso = race.raceDate.toISOString();
  const daysUntil = daysUntilRace(raceDateIso);
  const phase = raceInfoPhase(daysUntil);

  const registration = buildRegistrationPacket(race, athlete, daysUntil);
  const course = buildCoursePacket(race, daysUntil, phase);
  const trainingTips = buildTrainingTipsPacket(race, athlete, phase, daysUntil);
  const packetPickup = buildPacketPickupPacket(race, phase, daysUntil);
  const arrival = buildArrivalPacket(race, phase, daysUntil);
  const raceDayGuide = buildRaceDayGuidePacket(
    race,
    athlete,
    phase,
    daysUntil,
    packetPickup,
    arrival
  );

  const all = [raceDayGuide, arrival, packetPickup, registration, trainingTips, course];
  const packets = all
    .filter((p) => p.visible)
    .sort((a, b) => a.priority - b.priority);

  return {
    raceRegistryId: race.id,
    raceDate: raceDateIso,
    daysUntilRace: daysUntil,
    phase,
    isSignedUp: athlete.isSignedUp,
    primaryPacketKind: pickPrimaryPacket(all),
    packets,
  };
}

export type TrainingPlanWeekContext = {
  startDate: Date;
  totalWeeks: number;
  raceDate: Date | null;
  planSchedule: unknown;
};

/** Derive week number for training tips packet from an active plan row. */
export function trainingWeekContextFromPlan(
  plan: TrainingPlanWeekContext,
  now: Date = new Date()
): { weekNumber: number | null; totalWeeks: number | null; hasActivePlan: boolean } {
  const scheduleArr =
    plan.planSchedule != null && Array.isArray(plan.planSchedule) ? plan.planSchedule : [];
  if (scheduleArr.length === 0 || plan.totalWeeks < 1) {
    return { weekNumber: null, totalWeeks: null, hasActivePlan: false };
  }
  const effectiveWeeks = effectiveTrainingWeekCount(
    plan.startDate,
    plan.totalWeeks,
    plan.raceDate
  );
  const weekNumber = currentTrainingWeekNumber(plan.startDate, effectiveWeeks, now);
  return { weekNumber, totalWeeks: effectiveWeeks, hasActivePlan: true };
}
