/**
 * Race Parser - Strict Pass-Through for RunSignUp Data
 * 
 * MVP1 Stability: NO URL INVENTION, NO GUESSING, NO MAGIC
 * 
 * Rules:
 * - Only use URLs explicitly provided by RunSignUp
 * - Do NOT construct, guess, or improve URLs
 * - Return empty string if no valid URL exists
 */

export interface ParsedRace {
  id: string;
  name: string;
  startDate: string | null;
  location: string;
  url: string; // May be empty - client will handle disabled state
}

/**
 * Extract URL from RunSignUp race object (strict pass-through)
 * 
 * Priority order:
 * 1. race.url if it exists and starts with http
 * 2. race.url_string
 *    - If absolute (starts with http) → use as-is
 *    - If relative (starts with /) → prefix with https://runsignup.com
 *    - Otherwise → return empty string
 * 
 * Forbidden:
 * - Building URLs from city/state/name
 * - Using race_id to create URLs
 * - Guessing /TicketEvent vs /Race
 * - Slugifying race names
 */
function extractUrl(race: any): string {
  // Priority 1: race.url if absolute
  if (race.url && typeof race.url === 'string' && race.url.startsWith('http')) {
    return race.url;
  }

  // Priority 2: race.url_string
  if (race.url_string && typeof race.url_string === 'string') {
    // Absolute URL
    if (race.url_string.startsWith('http')) {
      return race.url_string;
    }
    // Relative URL (starts with /)
    if (race.url_string.startsWith('/')) {
      return `https://runsignup.com${race.url_string}`;
    }
    // Otherwise - invalid format, return empty
    return '';
  }

  // No valid URL found
  return '';
}

/**
 * Parse a raw RunSignUp race object into normalized format
 * 
 * @param race - Raw race object from RunSignUp API
 * @returns Normalized race object (url may be empty)
 */
export function parseRace(race: any): ParsedRace {
  return {
    id: String(race.race_id || race.id || ''),
    name: race.name || 'Untitled Event',
    startDate: race.start_date || race.event_date || null,
    location: [race.city, race.state].filter(Boolean).join(', ') || 'Location TBD',
    url: extractUrl(race), // Strict pass-through - may be empty
  };
}

