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
 * Generate unique slug for CityRun
 * 
 * Checks if slug exists, and if so, adds number suffix until unique
 * 
 * @param title - Run title
 * @param excludeRunId - Optional run ID to exclude from uniqueness check (for updates)
 * @returns Unique slug
 * 
 * Examples:
 * - "Morning Run" → "morning-run"
 * - "Morning Run" (if exists) → "morning-run-1"
 * - "Morning Run" (if both exist) → "morning-run-2"
 */
export async function generateUniqueCityRunSlug(
  title: string,
  excludeRunId?: string
): Promise<string> {
  const baseSlug = generateSlug(title);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.city_runs.findUnique({
      where: { slug },
      select: { id: true }
    });

    // If not found, or if it's the same run (for updates), use this slug
    if (!existing || (excludeRunId && existing.id === excludeRunId)) {
      return slug;
    }

    // If exists, add number suffix
    slug = `${baseSlug}-${counter}`;
    counter++;

    // Safety check - prevent infinite loop
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
