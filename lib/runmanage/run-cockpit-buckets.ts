/** Run-kind buckets on the Run Manage cockpit — driven by saved cityRunType. */
export type CockpitBucket = "club" | "individual" | "shakeout" | "special" | "run_store";

export type CockpitRunShape = {
  cityRunType?: string | null;
  runBrandId?: string | null;
  runClubId?: string | null;
  runStoreId?: string | null;
  athleteGeneratedId?: string | null;
};

export function cockpitBucketForRun(run: CockpitRunShape): CockpitBucket | null {
  const t = run.cityRunType?.toUpperCase();
  if (t === "RACE_SHAKEOUT") return "shakeout";
  if (t === "RUN_STORE") return "run_store";
  if (t === "SPECIAL") return "special";
  if (t === "CLUB") return "club";
  if (t === "INDIVIDUAL") return "individual";
  if (run.runStoreId) return "run_store";
  if (run.runClubId) return "club";
  if (run.athleteGeneratedId) return "individual";
  if (run.runBrandId) return "special";
  return null;
}

export const COCKPIT_BUCKET_META: Record<
  CockpitBucket,
  { label: string; description: string; border: string; bg: string }
> = {
  club: {
    label: "Club runs",
    description: "Club-scoped series and hosted runs",
    border: "border-sky-200",
    bg: "bg-sky-50/80",
  },
  individual: {
    label: "Individual",
    description: "Athlete-hosted join-my-run",
    border: "border-violet-200",
    bg: "bg-violet-50/80",
  },
  shakeout: {
    label: "Shakeout",
    description: "Race shakeouts and multi-partner events",
    border: "border-amber-200",
    bg: "bg-amber-50/80",
  },
  special: {
    label: "Special",
    description: "Brand and open partner runs",
    border: "border-emerald-200",
    bg: "bg-emerald-50/80",
  },
  run_store: {
    label: "Run store",
    description: "Store-hosted weekly runs",
    border: "border-teal-200",
    bg: "bg-teal-50/80",
  },
};

export const COCKPIT_BUCKET_ORDER: CockpitBucket[] = [
  "club",
  "run_store",
  "special",
  "shakeout",
  "individual",
];
