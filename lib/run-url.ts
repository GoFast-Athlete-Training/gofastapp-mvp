/**
 * Generate run URL for a city run
 * 
 * @deprecated Use generateCityRunUrl from @/lib/slug-utils instead
 * 
 * @param runId - Run ID (UUID)
 * @param citySlug - Optional city slug (e.g., "dc", "boston")
 * @param baseUrl - Optional base URL (defaults to current origin or env var)
 * @returns Full URL to the run detail page
 * 
 * Examples:
 * - With citySlug: "https://gofastapp.com/dc/runs/abc-123-def"
 * - Without citySlug: "https://gofastapp.com/runs/abc-123-def"
 * 
 * New format (preferred):
 * - With RunClub: "/cityrun/{runClubSlug}/{runSlug}"
 * - Without RunClub: "/cityrun/{runSlug}"
 */
export function generateRunUrl(
  runId: string,
  citySlug?: string | null,
  baseUrl?: string
): string {
  const base = baseUrl || 
    (typeof window !== 'undefined' ? window.location.origin : '') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://gofastapp.com';
  
  const path = citySlug 
    ? `/${citySlug}/runs/${runId}`
    : `/runs/${runId}`;
  
  return `${base}${path}`;
}

/**
 * Generate run URL path (without base URL)
 * 
 * @param runId - Run ID (UUID)
 * @param citySlug - Optional city slug
 * @returns Path to the run detail page
 * 
 * Examples:
 * - With citySlug: "/dc/runs/abc-123-def"
 * - Without citySlug: "/runs/abc-123-def"
 */
export function generateRunPath(runId: string, citySlug?: string | null): string {
  return citySlug 
    ? `/${citySlug}/runs/${runId}`
    : `/runs/${runId}`;
}

/**
 * Parse run URL to extract runId and citySlug
 * 
 * @param url - Full URL or path
 * @returns Object with runId and citySlug (if present)
 * 
 * Examples:
 * - "/dc/runs/abc-123-def" → { runId: "abc-123-def", citySlug: "dc" }
 * - "/runs/abc-123-def" → { runId: "abc-123-def", citySlug: null }
 * - "https://gofastapp.com/dc/runs/abc-123-def" → { runId: "abc-123-def", citySlug: "dc" }
 */
export function parseRunUrl(url: string): { runId: string | null; citySlug: string | null } {
  try {
    // Remove base URL if present
    const path = url.includes('/runs/') 
      ? url.split('/runs/')[0] + '/runs/' + url.split('/runs/')[1]
      : url;
    
    // Match pattern: /{citySlug}/runs/{runId} or /runs/{runId}
    const match = path.match(/\/([^\/]+)?\/?runs\/([^\/\?]+)/);
    
    if (!match) {
      return { runId: null, citySlug: null };
    }
    
    const [, potentialCitySlug, runId] = match;
    
    // If first capture group is "runs", then no citySlug
    if (potentialCitySlug === 'runs') {
      return { runId, citySlug: null };
    }
    
    return { runId, citySlug: potentialCitySlug };
  } catch (error) {
    console.error('Failed to parse run URL:', error);
    return { runId: null, citySlug: null };
  }
}
