/** Fallback when athlete clears plan title — matches informal server-side naming. */
export function planTitleFallback(firstName: string | null | undefined): string {
  const name = firstName?.trim();
  if (name) return `${name}'s plan`;
  return 'My training plan';
}

export function normalizePlanTitleInput(
  value: string,
  firstName: string | null | undefined
): string {
  const trimmed = value.trim();
  return trimmed || planTitleFallback(firstName);
}
