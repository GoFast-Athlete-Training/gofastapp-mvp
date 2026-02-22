import { prisma } from './prisma';

/**
 * Generate URL-friendly slug from title
 * 
 * @param title - Run title (e.g., "Morning Waterfront Run")
 * @returns URL-friendly slug (e.g., "morning-waterfront-run")
 * 
 * Rules:
 * - Lowercase
 * - Replace spaces with hyphens
 * - Remove special characters
 * - Remove leading/trailing hyphens
 */
export function generateSlug(title: string): string {
  if (!title || !title.trim()) {
    throw new Error('Title is required to generate slug');
  }

  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars (keep alphanumeric, spaces, hyphens)
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '');   // Remove leading/trailing hyphens
}

/**
 * Date to URL-safe code (YYYY-MM-DD) for use in slugs so same-title runs on different days are unique.
 */
function dateToSlugCode(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Generate unique slug for CityRun
 * 
 * Uses title + optional date code (YYYY-MM-DD) so "Club Thursday" on different dates get unique slugs.
 * If slug exists, adds number suffix until unique.
 * 
 * @param title - Run title
 * @param options - Optional: excludeRunId (for updates), date (run date for uniqueness)
 * @returns Unique slug
 * 
 * Examples:
 * - "Club Thursday" + date 2026-02-21 → "club-thursday-2026-02-21"
 * - "Club Thursday" (no date) → "club-thursday"
 * - If "club-thursday-2026-02-21" exists → "club-thursday-2026-02-21-1"
 */
export async function generateUniqueCityRunSlug(
  title: string,
  options?: { excludeRunId?: string; date?: Date | string | null }
): Promise<string> {
  const excludeRunId = options?.excludeRunId;
  const date = options?.date;
  const titlePart = generateSlug(title);
  const dateCode =
    date != null && !Number.isNaN(new Date(date).getTime())
      ? dateToSlugCode(new Date(date))
      : '';
  const baseSlug = dateCode ? `${titlePart}-${dateCode}` : titlePart;
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.city_runs.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!existing || (excludeRunId && existing.id === excludeRunId)) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;

    if (counter > 1000) {
      throw new Error('Unable to generate unique slug after 1000 attempts');
    }
  }
}

/**
 * Generate CityRun URL path
 * 
 * Format:
 * - With RunClub: /cityrun/{runClubSlug}/{runSlug}
 * - Without RunClub: /cityrun/{runSlug}
 * - Fallback (no slug): /runs/{runId}
 * 
 * @param run - CityRun object with slug, id, and optional runClub
 * @returns URL path
 */
export function generateCityRunUrlPath(run: {
  id: string;
  slug?: string | null;
  runClub?: { slug: string } | null;
}): string {
  // Prefer slug-based URL if available
  if (run.slug) {
    if (run.runClub?.slug) {
      return `/cityrun/${run.runClub.slug}/${run.slug}`;
    }
    return `/cityrun/${run.slug}`;
  }

  // Fallback to ID-based URL
  return `/runs/${run.id}`;
}

/**
 * Generate full CityRun URL
 * 
 * @param run - CityRun object with slug, id, and optional runClub
 * @param baseUrl - Optional base URL (defaults to env var or current origin)
 * @returns Full URL
 */
export function generateCityRunUrl(
  run: {
    id: string;
    slug?: string | null;
    runClub?: { slug: string } | null;
  },
  baseUrl?: string
): string {
  const base = baseUrl || 
    (typeof window !== 'undefined' ? window.location.origin : '') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_CONTENT_PUBLIC_BASE_DOMAIN ||
    'https://gofastapp.com';
  
  const path = generateCityRunUrlPath(run);
  return `${base}${path}`;
}

/**
 * Parse CityRun URL to extract components
 * 
 * Supports formats:
 * - /cityrun/{runClubSlug}/{runSlug}
 * - /cityrun/{runSlug}
 * - /runs/{runId}
 * 
 * @param url - Full URL or path
 * @returns Object with runClubSlug, runSlug, and runId
 */
export function parseCityRunUrl(url: string): {
  runClubSlug: string | null;
  runSlug: string | null;
  runId: string | null;
} {
  try {
    // Remove base URL if present
    const path = url.includes('://') 
      ? new URL(url).pathname
      : url;
    
    // Match /cityrun/{runClubSlug}/{runSlug} or /cityrun/{runSlug}
    const cityrunMatch = path.match(/\/cityrun\/([^\/]+)(?:\/([^\/\?]+))?/);
    if (cityrunMatch) {
      const [, first, second] = cityrunMatch;
      if (second) {
        // Format: /cityrun/{runClubSlug}/{runSlug}
        return {
          runClubSlug: first,
          runSlug: second,
          runId: null
        };
      } else {
        // Format: /cityrun/{runSlug}
        return {
          runClubSlug: null,
          runSlug: first,
          runId: null
        };
      }
    }
    
    // Match /runs/{runId}
    const runsMatch = path.match(/\/runs\/([^\/\?]+)/);
    if (runsMatch) {
      return {
        runClubSlug: null,
        runSlug: null,
        runId: runsMatch[1]
      };
    }
    
    return {
      runClubSlug: null,
      runSlug: null,
      runId: null
    };
  } catch (error) {
    console.error('Failed to parse CityRun URL:', error);
    return {
      runClubSlug: null,
      runSlug: null,
      runId: null
    };
  }
}
