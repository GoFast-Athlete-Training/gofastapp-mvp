export const PERSONA_TRAINING_PROFILE_KEYS = [
  "experience",
  "primaryGoal",
  "targetDistance",
  "weeklyMileage",
  "volumeTolerance",
  "intensityTolerance",
  "trainingFrequency",
  "aerobicFoundation",
  "recoveryConsiderations",
  "lifestyleConstraints",
  "coachingPhilosophy",
  "trainingPriorities",
] as const;

export type PersonaTrainingProfileKey = (typeof PERSONA_TRAINING_PROFILE_KEYS)[number];

export type FactSource = "explicit" | "inferred";

export type SourcedText = {
  value: string;
  source: FactSource;
};

export type PersonaTrainingProfile = Partial<Record<PersonaTrainingProfileKey, SourcedText>>;

function readSourced(entry: unknown): SourcedText | "invalid" | null {
  if (entry == null) return null;
  if (typeof entry !== "object" || Array.isArray(entry)) return "invalid";
  const record = entry as Record<string, unknown>;
  if (typeof record.value !== "string") return "invalid";
  const value = record.value.trim();
  if (!value) return null;
  const source: FactSource = record.source === "explicit" ? "explicit" : "inferred";
  return { value, source };
}

export function parsePersonaTrainingProfile(raw: unknown):
  | { ok: true; profile: PersonaTrainingProfile | null }
  | { ok: false; error: string } {
  if (raw == null) return { ok: true, profile: null };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "trainingProfile must be an object" };
  }
  const record = raw as Record<string, unknown>;
  const profile: PersonaTrainingProfile = {};
  for (const key of PERSONA_TRAINING_PROFILE_KEYS) {
    if (!(key in record)) continue;
    const sourced = readSourced(record[key]);
    if (sourced === "invalid") {
      return { ok: false, error: `trainingProfile.${key} must be { value, source }` };
    }
    if (sourced) profile[key] = sourced;
  }
  return { ok: true, profile: Object.keys(profile).length ? profile : null };
}

/** Drops malformed attributes instead of failing the whole profile. */
export function coercePersonaTrainingProfile(raw: unknown): PersonaTrainingProfile | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const profile: PersonaTrainingProfile = {};
  for (const key of PERSONA_TRAINING_PROFILE_KEYS) {
    const sourced = readSourced(record[key]);
    if (sourced && sourced !== "invalid") profile[key] = sourced;
  }
  return Object.keys(profile).length ? profile : null;
}
