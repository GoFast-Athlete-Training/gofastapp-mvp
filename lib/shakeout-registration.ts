/** Branded shakeout registration — not race bib registration on `race_registrations`. */

export function parseRegistrationRequiredInput(value: unknown): boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (!s) return null;
  if (["true", "yes", "1", "required", "y"].includes(s)) return true;
  if (["false", "no", "0", "optional", "n"].includes(s)) return false;
  return null;
}

/** undefined = omit from PATCH; null = clear / unknown. */
export function registrationRequiredFromBody(value: unknown): boolean | null | undefined {
  if (value === undefined) return undefined;
  return parseRegistrationRequiredInput(value);
}

export function normalizeRegistrationUrl(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function isValidRegistrationUrl(value: string | null | undefined): boolean {
  return normalizeRegistrationUrl(value ?? "") != null;
}
