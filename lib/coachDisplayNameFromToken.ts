/**
 * Normalize Firebase displayName into firstName / lastName (aligned with athlete create).
 */
export function coachDisplayNameFromToken(displayName: string | undefined): {
  firstName: string | null;
  lastName: string | null;
} {
  if (!displayName) return { firstName: null, lastName: null };
  const trimmed = displayName.trim();
  if (!trimmed) return { firstName: null, lastName: null };
  const parts = trimmed.split(/\s+/).filter((p) => p.length > 0);
  if (parts.length === 0) return { firstName: null, lastName: null };
  const firstName = parts[0] ?? null;
  let lastName =
    parts.length > 1 ? parts.slice(1).join(' ').trim() || null : null;
  if (firstName && lastName) {
    const lastParts = lastName.split(/\s+/);
    if (
      lastParts.length > 0 &&
      firstName.toLowerCase() === lastParts[0].toLowerCase()
    ) {
      lastName = lastParts.slice(1).join(' ').trim() || null;
    }
  }
  if (
    firstName &&
    lastName &&
    firstName.toLowerCase() === lastName.toLowerCase()
  ) {
    return { firstName, lastName: null };
  }
  return { firstName, lastName };
}
