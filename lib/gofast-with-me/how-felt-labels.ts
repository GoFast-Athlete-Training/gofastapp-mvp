/** Honest 1–5 labels for community story (not trophy scoring). */
export const HOW_FELT_LABELS: Record<number, string> = {
  1: 'It sucked',
  2: 'Heavy',
  3: 'Honest',
  4: 'Strong',
  5: 'Breakthrough',
};

export function howFeltLabel(rating: number | null | undefined): string | null {
  if (rating == null || rating < 1 || rating > 5) return null;
  return HOW_FELT_LABELS[rating] ?? null;
}

export function normalizeHowFeltRating(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < 1 || n > 5) return null;
  return n;
}
