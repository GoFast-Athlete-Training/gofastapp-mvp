import type { RunAffiliationDraft } from "@/components/runmanage/RunManageRunAffiliations";
import type { SpecialEventDraft } from "@/lib/runmanage/special-event-draft";

/** Staff Run Manage create — confirmed on the type select at top of run builder. */
export const RUN_MANAGE_STAFF_CREATE_RUN_TYPES = ["CLUB", "SPECIAL", "RACE_SHAKEOUT"] as const;

export type RunManageStaffCreateRunType = (typeof RUN_MANAGE_STAFF_CREATE_RUN_TYPES)[number];

export function isRunManageStaffCreateRunType(v: string): v is RunManageStaffCreateRunType {
  return (RUN_MANAGE_STAFF_CREATE_RUN_TYPES as readonly string[]).includes(v);
}

export type ClubBoltMode = "one_off" | "series";

export type CreateRunScopeFork = {
  clubBoltMode: ClubBoltMode | null;
};

export function defaultCreateRunScopeFork(): CreateRunScopeFork {
  return { clubBoltMode: null };
}

export function validateCreateRunScope(
  title: string,
  draft: RunAffiliationDraft,
  fork: CreateRunScopeFork,
  _specialEvent?: SpecialEventDraft | null
): string | null {
  if (!title.trim()) {
    return "Add a run title.";
  }

  const type = draft.cityRunType;

  if (type === "INDIVIDUAL") {
    return "Individual runs are athlete-scoped — not available in staff create.";
  }

  if (type === "CLUB" && draft.runClubId) {
    if (!fork.clubBoltMode) return "Choose one-off or from series.";
    if (fork.clubBoltMode === "series") {
      return "Series picker is coming soon — choose one-off for now.";
    }
  }

  if (type === "RUN_STORE") {
    return "Run store create is not on this form yet.";
  }

  return null;
}

export function isCreateScopeComplete(
  title: string,
  draft: RunAffiliationDraft,
  fork: CreateRunScopeFork,
  specialEvent?: SpecialEventDraft | null
): boolean {
  return validateCreateRunScope(title, draft, fork, specialEvent) === null;
}

/** @alias validateCreateRunScope */
export const validateAffiliationDraft = validateCreateRunScope;

export type RunContainerIdentity =
  | { kind: "club"; logoUrl: string | null; name: string; city: string; state: string; tagline: string }
  | { kind: "special_event"; eventName: string; eventTitle: string; logoUrl: string | null; leadName: string; eventDate: string; url: string }
  | { kind: "race"; name: string; city: string; state: string }
  | { kind: "none" };

export function containerIdentityFromScope(
  title: string,
  draft: RunAffiliationDraft,
  fork: CreateRunScopeFork,
  opts?: {
    clubHydrate?: { description?: string | null } | null;
    specialEvent?: SpecialEventDraft | null;
    raceLabel?: { name: string; city?: string | null; state?: string | null } | null;
  }
): RunContainerIdentity {
  const type = draft.cityRunType;
  const clubHydrate = opts?.clubHydrate;
  const specialEvent = opts?.specialEvent;
  const raceLabel = opts?.raceLabel;

  if (type === "RACE_SHAKEOUT" && (raceLabel?.name || draft.raceRegistryId)) {
    return {
      kind: "race",
      name: raceLabel?.name ?? "Race shakeout",
      city: raceLabel?.city ?? "",
      state: raceLabel?.state ?? "",
    };
  }

  if (type === "CLUB" && draft.runClubPick) {
    const tagline =
      (clubHydrate?.description?.trim() || draft.runClubPick.secondary || "").slice(0, 220);
    return {
      kind: "club",
      logoUrl: draft.runClubPick.logoUrl ?? null,
      name: draft.runClubPick.name,
      city: draft.runClubPick.city ?? "",
      state: draft.runClubPick.state ?? "",
      tagline,
    };
  }

  if (type === "SPECIAL" && specialEvent?.name.trim()) {
    return {
      kind: "special_event",
      eventName: specialEvent.name.trim() || title.trim() || "Special event",
      eventTitle: specialEvent.eventTitle.trim(),
      logoUrl: null,
      leadName: "",
      eventDate: specialEvent.eventDate.trim(),
      url: specialEvent.url.trim(),
    };
  }

  return { kind: "none" };
}
