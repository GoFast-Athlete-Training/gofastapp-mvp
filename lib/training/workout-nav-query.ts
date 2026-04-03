/**
 * Query-string context when opening a workout from Go Train / plan flows
 * so the detail page can show "today" framing and a sensible back link.
 */

export const GO_TRAIN_FROM_PARAM = "from";
export const GO_TRAIN_FROM_VALUE = "go-train";

export type GoTrainBackTarget = "workouts" | "training" | "setup";

export type GoTrainNavContext = {
  fromGoTrain: true;
  back: GoTrainBackTarget;
  planId: string | null;
  weekNumber: number | null;
  totalWeeks: number | null;
  /** Calendar day YYYY-MM-DD */
  dateKey: string | null;
};

export function buildGoTrainWorkoutSearchParams(opts: {
  back: GoTrainBackTarget;
  planId?: string | null;
  weekNumber?: number | null;
  totalWeeks?: number | null;
  dateKey?: string | null;
}): URLSearchParams {
  const q = new URLSearchParams();
  q.set(GO_TRAIN_FROM_PARAM, GO_TRAIN_FROM_VALUE);
  q.set("back", opts.back);
  if (opts.planId) q.set("planId", opts.planId);
  if (opts.weekNumber != null && Number.isFinite(opts.weekNumber)) {
    q.set("weekNumber", String(Math.round(opts.weekNumber)));
  }
  if (opts.totalWeeks != null && Number.isFinite(opts.totalWeeks)) {
    q.set("totalWeeks", String(Math.round(opts.totalWeeks)));
  }
  if (opts.dateKey) q.set("dateKey", opts.dateKey);
  return q;
}

export function workoutDetailPathWithGoTrainContext(
  workoutId: string,
  opts: Parameters<typeof buildGoTrainWorkoutSearchParams>[0]
): string {
  const q = buildGoTrainWorkoutSearchParams(opts);
  const qs = q.toString();
  return qs ? `/workouts/${workoutId}?${qs}` : `/workouts/${workoutId}`;
}

const BACK_QUERY_KEY = "back";

/** Internal path only — avoids open redirects. */
export function isSafeInternalBackPath(path: string): boolean {
  const t = path.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return false;
  if (t.includes("://")) return false;
  return true;
}

export function workoutDetailPathWithBackHref(
  workoutId: string,
  backPath: string
): string {
  const trimmed = backPath.trim();
  if (!isSafeInternalBackPath(trimmed)) {
    return `/workouts/${workoutId}`;
  }
  const q = new URLSearchParams();
  q.set(BACK_QUERY_KEY, trimmed);
  return `/workouts/${workoutId}?${q.toString()}`;
}

/** Read `?back=/internal/path` from workout detail URL. */
export function parseBackHrefParam(params: URLSearchParams): string | null {
  const raw = params.get(BACK_QUERY_KEY)?.trim();
  if (!raw || !isSafeInternalBackPath(raw)) return null;
  return raw;
}

export function backLabelFromPath(path: string): string {
  const p = path.split("?")[0] ?? path;
  if (p.startsWith("/training/day/")) return "Back to plan preview";
  if (p === "/training") return "Back to My Training";
  if (p.startsWith("/training-setup/")) return "Back to plan setup";
  if (p === "/workouts") return "Back to Go Train";
  return "Back";
}

/** Extract YYYY-MM-DD from `/training/day/[dateKey]` when present in back URL. */
export function parseDateKeyFromTrainingDayPreviewPath(path: string): string | null {
  const base = path.split("?")[0] ?? path;
  const m = base.match(/\/training\/day\/([^/?#]+)$/);
  if (!m?.[1]) return null;
  const raw = decodeURIComponent(m[1]).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

/** Parse `/workouts/[id]?from=go-train&back=…` from URLSearchParams or null. */
export function parseGoTrainNavContext(
  params: URLSearchParams
): GoTrainNavContext | null {
  if (params.get(GO_TRAIN_FROM_PARAM) !== GO_TRAIN_FROM_VALUE) return null;
  const backRaw = params.get("back");
  const back: GoTrainBackTarget =
    backRaw === "training" || backRaw === "setup" ? backRaw : "workouts";
  const planId = params.get("planId");
  const wn = params.get("weekNumber");
  const tw = params.get("totalWeeks");
  const dateKey = params.get("dateKey");
  const weekNumber =
    wn != null && wn !== "" && Number.isFinite(Number(wn)) ? Number(wn) : null;
  const totalWeeks =
    tw != null && tw !== "" && Number.isFinite(Number(tw)) ? Number(tw) : null;
  return {
    fromGoTrain: true,
    back,
    planId: planId && planId.trim() ? planId.trim() : null,
    weekNumber,
    totalWeeks,
    dateKey: dateKey && dateKey.trim() ? dateKey.trim() : null,
  };
}

export function backHrefFromGoTrainContext(ctx: GoTrainNavContext): string {
  if (ctx.back === "training") return "/training";
  if (ctx.back === "setup" && ctx.planId) return `/training-setup/${ctx.planId}`;
  if (ctx.back === "setup") return "/training-setup";
  return "/workouts";
}

export function backLabelFromGoTrainContext(ctx: GoTrainNavContext): string {
  if (ctx.back === "training") return "Back to My Training";
  if (ctx.back === "setup") return "Back to plan setup";
  return "Back to Go Train";
}
