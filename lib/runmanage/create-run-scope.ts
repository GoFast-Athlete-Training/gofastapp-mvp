import type { RunAffiliationDraft } from "@/components/runmanage/RunManageRunAffiliations";
import type { SpecialEventDraft } from "@/lib/runmanage/special-event-draft";

/** Staff Run Manage create — club lookup + special event parent only. */
export const RUN_MANAGE_STAFF_CREATE_RUN_TYPES = ["CLUB", "SPECIAL"] as const;

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
  specialEvent?: SpecialEventDraft | null
): string | null {
  if (!title.trim()) {
    return "Add a run title.";
  }

  const type = draft.cityRunType;

  if (type === "INDIVIDUAL") {
    return "Individual runs are athlete-scoped — not available in staff create.";
  }

  if (type === "CLUB") {
    if (!draft.runClubId) return "Attach the hosting club.";
    if (!fork.clubBoltMode) return "Choose one-off or from series.";
    if (fork.clubBoltMode === "series") {
      return "Series picker is coming soon — choose one-off for now.";
    }
    return null;
  }

  if (type === "RUN_STORE" || type === "RACE_SHAKEOUT") {
    return "This run type is not created in Run Manage — use club or special event.";
  }

  if (type === "SPECIAL") {
    const ev = specialEvent ?? null;
    if (!ev?.name.trim()) return "Add the special event name.";
    if (!ev.brandId) return "Attach the brand lead for this event.";
    return null;
  }

  return "Choose a run type.";
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
  | { kind: "none" };

export function containerIdentityFromScope(
  title: string,
  draft: RunAffiliationDraft,
  fork: CreateRunScopeFork,
  opts?: {
    clubHydrate?: { description?: string | null } | null;
    specialEvent?: SpecialEventDraft | null;
  }
): RunContainerIdentity {
  const type = draft.cityRunType;
  const clubHydrate = opts?.clubHydrate;
  const specialEvent = opts?.specialEvent;

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

  if (type === "SPECIAL" && specialEvent?.brandPick) {
    return {
      kind: "special_event",
      eventName: specialEvent.name.trim() || title.trim() || "Special event",
      eventTitle: specialEvent.eventTitle.trim(),
      logoUrl: specialEvent.brandPick.logoUrl ?? null,
      leadName: specialEvent.brandPick.name,
      eventDate: specialEvent.eventDate.trim(),
      url: specialEvent.url.trim(),
    };
  }

  return { kind: "none" };
}
