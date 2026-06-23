/**
 * Shared secret for Company → Product internal calls (companypush-adjacent sync).
 */
export function verifyInternalApiKey(request: Request): boolean {
  const expected = process.env.GOFAST_INTERNAL_API_KEY?.trim() ?? '';
  if (!expected) {
    console.warn('[verifyInternalApiKey] GOFAST_INTERNAL_API_KEY is not configured');
    return false;
  }
  const provided = request.headers.get('x-gofast-internal-key')?.trim() ?? '';
  return provided.length > 0 && provided === expected;
}
