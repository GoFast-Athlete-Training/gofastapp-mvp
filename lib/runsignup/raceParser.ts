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

export type RaceCategory = 'race' | 'training_program' | 'other';

export interface ParsedRace {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  location: string;
  url: string; // May be empty - client will handle disabled state
  category: RaceCategory; // Classification for selection logic
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
 * Classify race category based on RunSignUp data
 * 
 * Classification rules (simple + explicit):
 * - training_program if: name contains "training"/"program" OR spans multiple months OR all events have null distance
 * - race if: single-day/short-duration OR name contains race keywords (5K, 10K, Half, Marathon, Run, etc.)
 * - otherwise → other
 */
function classifyRace(race: any): RaceCategory {
  const name = (race.name || '').toLowerCase();
  
  // Check for training program indicators
  const hasTrainingKeywords = name.includes('training') || name.includes('program');
  
  // Check if spans multiple months (training programs typically do)
  let spansMultipleMonths = false;
  if (race.next_date && race.next_end_date) {
    try {
      const start = new Date(race.next_date);
      const end = new Date(race.next_end_date);
      const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      spansMultipleMonths = monthsDiff > 1;
    } catch {
      // Invalid dates, skip this check
    }
  }
  
  // Check if all events have null distance (training programs often don't specify distance)
  const allEventsNullDistance = race.events && Array.isArray(race.events) && race.events.length > 0 &&
    race.events.every((event: any) => !event.distance || event.distance === null);
  
  if (hasTrainingKeywords || spansMultipleMonths || allEventsNullDistance) {
    return 'training_program';
  }
  
  // Check for race indicators (single-day events with race keywords)
  const hasRaceKeywords = name.includes('5k') || name.includes('10k') || name.includes('half') ||
                         name.includes('marathon') || name.includes('run') || name.includes('race');
  
  // Check if it's a single-day or short-duration event
  let isShortDuration = false;
  if (race.next_date && race.next_end_date) {
    try {
      const start = new Date(race.next_date);
      const end = new Date(race.next_end_date);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      isShortDuration = daysDiff <= 7; // 7 days or less
    } catch {
      // Invalid dates, assume it might be a race
      isShortDuration = true;
    }
  } else if (race.next_date) {
    // Has start date but no end date - likely a single-day race
    isShortDuration = true;
  }
  
  if (hasRaceKeywords || isShortDuration) {
    return 'race';
  }
  
  return 'other';
}

/**
 * Parse a raw RunSignUp race object into normalized format
 * 
 * STEP 2: Normalize (NO filtering yet)
 * - Converts raw RunSignUp data to consistent format
 * - Classifies category (race, training_program, other)
 * - Does NOT filter anything out
 * 
 * @param race - Raw race object from RunSignUp API
 * @returns Normalized race object with category classification
 */
export function parseRace(race: any): ParsedRace {
  // Get start date from race or first event
  let startDate = race.start_date || race.event_date || race.next_date || null;
  if (!startDate && race.events && Array.isArray(race.events) && race.events.length > 0) {
    startDate = race.events[0].start_time || null;
  }

  // Get end date
  let endDate = race.end_date || race.next_end_date || null;
  if (!endDate && race.events && Array.isArray(race.events) && race.events.length > 0) {
    endDate = race.events[0].end_time || null;
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
    endDate: endDate,
    location: location,
    url: extractUrl(race), // Strict pass-through - may be empty
    category: classifyRace(race), // Classification for selection logic
  };
}

