export function normalizeLinkDestination(input: { url?: string | null }): {
  url: string | null;
  error?: string;
} {
  const url = input.url?.trim() || null;
  if (!url) {
    return { url: null, error: "Add a URL" };
  }
  return { url };
}
