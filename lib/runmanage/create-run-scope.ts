import type { RunAffiliationDraft } from "@/components/runmanage/RunManageRunAffiliations";
import type { StaffCreateRunType } from "@/lib/runmanage/partner-extras";

/** Staff Run Manage create — athlete INDIVIDUAL runs are athlete-scoped, not staff input. */
export const RUN_MANAGE_STAFF_CREATE_RUN_TYPES = [
  "CLUB",
  "RUN_STORE",
  "SPECIAL",
  "RACE_SHAKEOUT",
] as const;

export type RunManageStaffCreateRunType = (typeof RUN_MANAGE_STAFF_CREATE_RUN_TYPES)[number];

export function isRunManageStaffCreateRunType(v: string): v is RunManageStaffCreateRunType {
  return (RUN_MANAGE_STAFF_CREATE_RUN_TYPES as readonly string[]).includes(v);
}

export type ClubBoltMode = "one_off" | "series";

export type SpecialLeadMode = "floating" | "brand_popup";

export type CreateRunScopeFork = {
  clubBoltMode: ClubBoltMode | null;
  specialLeadMode: SpecialLeadMode | null;
};

export function defaultCreateRunScopeFork(): CreateRunScopeFork {
  return { clubBoltMode: null, specialLeadMode: null };
}

export function validateCreateRunScope(
  title: string,
  draft: RunAffiliationDraft,
  fork: CreateRunScopeFork
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

  if (type === "RUN_STORE") {
    if (!draft.runStoreId) return "Attach the hosting run store.";
    return null;
  }

  if (type === "RACE_SHAKEOUT") {
    if (!draft.raceRegistryId?.trim()) return "Enter the race registry id for this shakeout.";
    return null;
  }

  if (type === "SPECIAL") {
    if (!fork.specialLeadMode) return "Choose floating event or brand-led pop-up.";
    if (fork.specialLeadMode === "brand_popup" && !draft.runBrandId) {
      return "Attach the brand hosting this pop-up.";
    }
    return null;
  }

  return "Choose a run type.";
}

export function isCreateScopeComplete(
  title: string,
  draft: RunAffiliationDraft,
  fork: CreateRunScopeFork
): boolean {
  return validateCreateRunScope(title, draft, fork) === null;
}

/** @alias validateCreateRunScope */
export const validateAffiliationDraft = validateCreateRunScope;

export type RunContainerIdentity =
  | { kind: "club"; logoUrl: string | null; name: string; city: string; state: string; tagline: string }
  | { kind: "store"; logoUrl: string | null; name: string; city: string; state: string }
  | { kind: "race"; registryId: string; label: string }
  | { kind: "brand_popup"; logoUrl: string | null; name: string; tagline: string }
  | { kind: "floating_event"; title: string }
  | { kind: "none" };

export function containerIdentityFromScope(
  title: string,
  draft: RunAffiliationDraft,
  fork: CreateRunScopeFork,
  clubHydrate?: { description?: string | null } | null
): RunContainerIdentity {
  const type = draft.cityRunType;

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

  if (type === "RUN_STORE" && draft.runStorePick) {
    return {
      kind: "store",
      logoUrl: draft.runStorePick.logoUrl ?? null,
      name: draft.runStorePick.name,
      city: draft.runStorePick.city ?? "",
      state: draft.runStorePick.state ?? "",
    };
  }

  if (type === "RACE_SHAKEOUT" && draft.raceRegistryId?.trim()) {
    return {
      kind: "race",
      registryId: draft.raceRegistryId.trim(),
      label: draft.runBrandPick
        ? `Race shakeout · ${draft.runBrandPick.name} (sponsor stamp)`
        : "Race shakeout",
    };
  }

  if (type === "SPECIAL") {
    if (fork.specialLeadMode === "brand_popup" && draft.runBrandPick) {
      return {
        kind: "brand_popup",
        logoUrl: draft.runBrandPick.logoUrl ?? null,
        name: draft.runBrandPick.name,
        tagline: draft.runBrandPick.secondary?.trim() || "Brand-led pop-up run event",
      };
    }
    if (fork.specialLeadMode === "floating") {
      return { kind: "floating_event", title: title.trim() || "Floating run event" };
    }
  }

  return { kind: "none" };
}
