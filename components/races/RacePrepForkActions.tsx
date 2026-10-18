"use client";

import Link from "next/link";

export type RacePrepForkVariant = "heroDark" | "heroLight" | "compact";

const PRIMARY: Record<RacePrepForkVariant, string> = {
  heroDark:
    "inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-violet-700 shadow hover:bg-violet-50",
  heroLight:
    "inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700",
  compact:
    "inline-flex items-center justify-center rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600",
};

const SECONDARY: Record<RacePrepForkVariant, string> = {
  heroDark:
    "inline-flex items-center justify-center rounded-xl border border-violet-200/80 bg-violet-500/20 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-500/30",
  heroLight:
    "inline-flex items-center justify-center rounded-xl border border-violet-200 bg-white px-5 py-2.5 text-sm font-semibold text-violet-800 hover:bg-violet-50",
  compact:
    "inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50",
};

type Props = {
  plannerHref: string | null | undefined;
  raceHubHref: string | null | undefined;
  /** Training hub — shown beside race CTAs on home. */
  seeMyPlanHref?: string | null | undefined;
  variant?: RacePrepForkVariant;
  className?: string;
  layout?: "column" | "row";
};

/** Canonical prep fork: personal planner + public race hub. */
const SEE_MY_PLAN: Record<RacePrepForkVariant, string> = {
  heroDark:
    "inline-flex items-center justify-center rounded-xl border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20",
  heroLight:
    "inline-flex items-center justify-center rounded-xl border border-violet-200 bg-white px-5 py-2.5 text-sm font-semibold text-violet-800 hover:bg-violet-50",
  compact:
    "inline-flex items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100",
};

export function RacePrepForkActions({
  plannerHref,
  raceHubHref,
  seeMyPlanHref,
  variant = "compact",
  className = "",
  layout = "column",
}: Props) {
  const plan = plannerHref?.trim();
  const hub = raceHubHref?.trim();
  const training = seeMyPlanHref?.trim();
  if (!plan && !hub && !training) return null;

  const layoutClass =
    layout === "row"
      ? "flex flex-wrap items-center gap-2"
      : "flex flex-col gap-2 sm:items-stretch";

  return (
    <div className={`${layoutClass} ${className}`.trim()}>
      {plan ? (
        <Link href={plan} className={PRIMARY[variant]}>
          Plan my race
        </Link>
      ) : null}
      {hub ? (
        <Link href={hub} className={SECONDARY[variant]}>
          Race hub
        </Link>
      ) : null}
      {training ? (
        <Link href={training} className={SEE_MY_PLAN[variant]}>
          See my plan
        </Link>
      ) : null}
    </div>
  );
}
