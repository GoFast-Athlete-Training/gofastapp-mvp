/** Standing hub hello from the race_registry row — no extra table. */
export function hubWelcomeFromRegistry(input: {
  description?: string | null;
  summaryPhrase?: string | null;
}): string | null {
  const description = input.description?.trim();
  if (description) return description;
  const summary = input.summaryPhrase?.trim();
  if (summary) return summary;
  return null;
}
