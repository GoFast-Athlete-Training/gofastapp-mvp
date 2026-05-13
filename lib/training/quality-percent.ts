/** Normalizes preset shape for API JSON (no derived workout fields; catalogue drives quality volume). */
export function serializePlanPresetForApi<T extends object>(preset: T): T {
  return { ...preset };
}
