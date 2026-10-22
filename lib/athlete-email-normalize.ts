/** Lowercase trimmed email for Athlete.email uniqueness and claim lookups. */
export function normalizeAthleteEmail(
  email: string | null | undefined,
): string | null {
  if (email == null) return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

/** Split a display name into first / last (same rules as athlete create). */
export function splitDisplayName(name: string): {
  firstName: string;
  lastName: string | null;
} {
  const trimmed = name.trim();
  if (!trimmed) {
    return { firstName: 'Runner', lastName: null };
  }
  const parts = trimmed.split(/\s+/).filter((p) => p.length > 0);
  if (parts.length === 0) {
    return { firstName: 'Runner', lastName: null };
  }
  const firstName = parts[0]!;
  const lastName = parts.length > 1 ? parts.slice(1).join(' ').trim() || null : null;
  if (lastName && firstName.toLowerCase() === lastName.split(/\s+/)[0]?.toLowerCase()) {
    const rest = lastName.split(/\s+/).slice(1).join(' ').trim();
    return { firstName, lastName: rest || null };
  }
  return { firstName, lastName };
}
