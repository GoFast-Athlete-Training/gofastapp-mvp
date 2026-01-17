/**
 * RunSignUp Race Parser - Strict Pass-Through
 * 
 * MVP1 Stability: NO URL INVENTION, NO GUESSING, NO MAGIC
 * 
 * CRITICAL RULES:
 * - Only use URLs explicitly provided by RunSignUp
 * - Do NOT construct, guess, or improve URLs
 * - Return empty string if no valid URL exists
 * 
 * WHY URL GUESSING IS FORBIDDEN:
 * - RunSignUp URL patterns are inconsistent and undocumented
 * - Constructed URLs frequently result in 404s
 * - Only RunSignUp knows the correct URL format for each race
 * - MVP1 requires predictable, stable behavior
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
 * FORBIDDEN (will cause 404s):
 * - Building URLs from city/state/name (e.g., /Race/VA/Arlington/RaceName)
 * - Using race_id to create URLs (e.g., /Race/12345)
 * - Guessing /TicketEvent vs /Race format
 * - Slugifying race names
 * - Any URL construction or inference
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
    // DO NOT attempt to construct or guess the URL
    return '';
  }

  // No valid URL found
  // DO NOT fall back to construction - return empty and let client handle it
  return '';
}

/**
 * Parse a raw RunSignUp race object into normalized format
 * 
 * @param race - Raw race object from RunSignUp API
 * @returns Normalized race object (url may be empty)
 */
export function parseRace(race: any): ParsedRace {
  // Get start date from race or first event
  let startDate = race.start_date || race.event_date || race.next_date || null;
  if (!startDate && race.events && Array.isArray(race.events) && race.events.length > 0) {
    startDate = race.events[0].start_time || null;
  }

  // Get location from race address or city/state
  let location = 'Location TBD';
  if (race.address) {
    const parts = [
      race.address.city,
      race.address.state
    ].filter(Boolean);
    location = parts.join(', ') || location;
  } else {
    const parts = [race.city, race.state].filter(Boolean);
    location = parts.join(', ') || location;
  }

  return {
    id: String(race.race_id || race.id || ''),
    name: race.name || 'Untitled Event',
    startDate: startDate,
    location: location,
    url: extractUrl(race), // Strict pass-through - may be empty
  };
}

