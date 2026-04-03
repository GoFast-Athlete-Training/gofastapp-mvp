/**
 * Handoff when opening a workout from Go Train or a plan day preview without
 * putting `?back=` / `from=go-train` on the URL. Stashed in sessionStorage and
 * keyed by workouts.id so the detail page can resolve back + framing.
 */

const STORAGE_KEY = "gofast.workoutDayNav.v1";

export type WorkoutDayNavEntry =
  | { source: "go-train" }
  | { source: "plan-preview"; backPath: string };

type StashedPayload = {
  v: 1;
  workoutId: string;
  entry: WorkoutDayNavEntry;
};

function isSafeInternalPath(path: string): boolean {
  const t = path.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return false;
  if (t.includes("://")) return false;
  return true;
}

export function stashWorkoutDayNav(workoutId: string, entry: WorkoutDayNavEntry): void {
  if (typeof window === "undefined" || !workoutId) return;
  if (entry.source === "plan-preview" && !isSafeInternalPath(entry.backPath)) {
    return;
  }
  try {
    const payload: StashedPayload = { v: 1, workoutId, entry };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

/** Entry for this workout only; removes stale payloads for other ids. */
export function readWorkoutDayNav(workoutId: string): WorkoutDayNavEntry | null {
  if (typeof window === "undefined" || !workoutId) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as StashedPayload;
    if (p?.v !== 1 || typeof p.workoutId !== "string" || !p.entry) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (p.workoutId !== workoutId) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (p.entry.source === "plan-preview" && !isSafeInternalPath(p.entry.backPath)) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return p.entry;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearWorkoutDayNav(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
