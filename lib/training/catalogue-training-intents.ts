/** Free-form purpose sentences stored as `trainingIntent` string[]. */

export function normalizeTrainingIntentArray(values: string[]): string[] {
  const uniq = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const t = raw.trim();
    if (!t || uniq.has(t)) continue;
    uniq.add(t);
    out.push(t);
  }
  return out;
}

export function parseTrainingIntentFromCell(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const lines = t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return normalizeTrainingIntentArray(lines.length ? lines : [t]);
}
