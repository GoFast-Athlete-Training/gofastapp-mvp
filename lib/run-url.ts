/**
 * Generate run URL for a city run
 * 
 * @deprecated Use generateCityRunUrl from @/lib/slug-utils instead
 * 
 * @param runId - Run ID (UUID)
 * @param gofastCity - Optional city slug (e.g., "dc", "boston")
 * @param baseUrl - Optional base URL (defaults to current origin or env var)
 * @returns Full URL to the run detail page
 * 
 * Examples:
 * - With gofastCity: "https://gofastapp.com/dc/runs/abc-123-def"
 * - Without gofastCity: "https://gofastapp.com/runs/abc-123-def"
 * 
 * New format (preferred):
 * - With RunClub: "/cityrun/{runClubSlug}/{runSlug}"
 * - Without RunClub: "/cityrun/{runSlug}"
 */
export function generateRunUrl(
  runId: string,
  gofastCity?: string | null,
  baseUrl?: string
): string {
  const base = baseUrl || 
    (typeof window !== 'undefined' ? window.location.origin : '') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://gofastapp.com';
  
  const path = gofastCity 
    ? `/${gofastCity}/runs/${runId}`
    : `/runs/${runId}`;
  
  return `${base}${path}`;
}

/**
 * Generate run URL path (without base URL)
 * 
 * @param runId - Run ID (UUID)
 * @param gofastCity - Optional city slug
 * @returns Path to the run detail page
 * 
 * Examples:
 * - With gofastCity: "/dc/runs/abc-123-def"
 * - Without gofastCity: "/runs/abc-123-def"
 */
export function generateRunPath(runId: string, gofastCity?: string | null): string {
  return gofastCity 
    ? `/${gofastCity}/runs/${runId}`
    : `/runs/${runId}`;
}

/**
 * Parse run URL to extract runId and gofastCity
 * 
 * @param url - Full URL or path
 * @returns Object with runId and gofastCity (if present)
 * 
 * Examples:
 * - "/dc/runs/abc-123-def" → { runId: "abc-123-def", gofastCity: "dc" }
 * - "/runs/abc-123-def" → { runId: "abc-123-def", gofastCity: null }
 * - "https://gofastapp.com/dc/runs/abc-123-def" → { runId: "abc-123-def", gofastCity: "dc" }
 */
export function parseRunUrl(url: string): { runId: string | null; gofastCity: string | null } {
  try {
    // Remove base URL if present
    const path = url.includes('/runs/') 
      ? url.split('/runs/')[0] + '/runs/' + url.split('/runs/')[1]
      : url;
    
    // Match pattern: /{gofastCity}/runs/{runId} or /runs/{runId}
    const match = path.match(/\/([^\/]+)?\/?runs\/([^\/\?]+)/);
    
    if (!match) {
      return { runId: null, gofastCity: null };
    }
    
    const [, potentialCitySlug, runId] = match;
    
    // If first capture group is "runs", then no gofastCity
    if (potentialCitySlug === 'runs') {
      return { runId, gofastCity: null };
    }
    
    return { runId, gofastCity: potentialCitySlug };
  } catch (error) {
    console.error('Failed to parse run URL:', error);
    return { runId: null, gofastCity: null };
  }
}
