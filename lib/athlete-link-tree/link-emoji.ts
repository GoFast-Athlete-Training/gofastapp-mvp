/** Normalize a single emoji (or short ZWJ sequence) for link buttons. */
export function normalizeLinkEmoji(input: string | null | undefined): string | null {
  const trimmed = input?.trim();
  if (!trimmed) return null;
  const graphemes = [...trimmed];
  if (graphemes.length === 0 || graphemes.length > 8) {
    return null;
  }
  return trimmed;
}
