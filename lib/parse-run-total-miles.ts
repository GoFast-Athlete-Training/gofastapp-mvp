/** Parse staff-entered run distance (miles). Returns null when empty/invalid. */
export function parseRunTotalMiles(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value).trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}
