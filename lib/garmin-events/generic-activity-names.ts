const GENERIC_NAME_RE = /^(sample|sample activity|sampleactivity)$/i;

export function isGenericGarminActivityName(name: string | null | undefined): boolean {
  const raw = name?.trim();
  if (!raw) return false;
  return GENERIC_NAME_RE.test(raw);
}
