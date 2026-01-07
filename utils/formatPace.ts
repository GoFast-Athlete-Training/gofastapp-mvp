/**
 * Format pace helper
 * Converts seconds per mile to min:sec/mi format
 * Handles both number and string inputs
 */
export function formatPace(activity: { pace?: number | string | null }): string | null {
  if (!activity.pace) return null;
  if (typeof activity.pace === 'string') return activity.pace;
  // If pace is in seconds per mile, convert to min:sec/mi
  if (typeof activity.pace === 'number') {
    const minutes = Math.floor(activity.pace / 60);
    const seconds = Math.floor(activity.pace % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/mi`;
  }
  return null;
}

/**
 * Format pace input as user types - enforces MM:SS format
 * Examples:
 * - "8" -> "8:00"
 * - "8:3" -> "8:03"
 * - "8:30" -> "8:30"
 * - "8:300" -> "8:30" (invalid seconds, caps at 59)
 */
export function formatPaceInput(value: string): string {
  // Remove all non-numeric characters except colon
  let cleaned = value.replace(/[^\d:]/g, '');
  
  // If empty, return empty
  if (!cleaned) return '';
  
  // Split by colon
  const parts = cleaned.split(':');
  
  if (parts.length === 1) {
    // No colon yet - just numbers
    const num = parts[0];
    if (num.length <= 2) {
      // Allow typing minutes (e.g., "8")
      return num;
    } else if (num.length === 3) {
      // "830" -> "8:30"
      return `${num[0]}:${num.slice(1)}`;
    } else if (num.length === 4) {
      // "8300" -> "8:30"
      return `${num.slice(0, 2)}:${num.slice(2)}`;
    } else {
      // Too long, truncate
      return `${num.slice(0, 2)}:${num.slice(2, 4)}`;
    }
  } else if (parts.length === 2) {
    // Has colon - format as MM:SS
    let minutes = parts[0].slice(0, 2); // Max 2 digits for minutes
    let seconds = parts[1].slice(0, 2); // Max 2 digits for seconds
    
    // Ensure seconds don't exceed 59
    if (seconds && parseInt(seconds) > 59) {
      seconds = '59';
    }
    
    // Pad seconds to 2 digits if it exists
    if (seconds && seconds.length === 1) {
      return `${minutes}:${seconds}0`;
    }
    
    return `${minutes}:${seconds}`;
  }
  
  return cleaned;
}

/**
 * Validate pace format - must be MM:SS (e.g., "8:00", "9:30")
 */
export function validatePaceFormat(pace: string | null | undefined): boolean {
  if (!pace) return true; // Empty is valid (optional field)
  
  const paceRegex = /^\d{1,2}:\d{2}$/;
  if (!paceRegex.test(pace)) return false;
  
  const [minutes, seconds] = pace.split(':').map(Number);
  
  // Minutes should be reasonable (0-99)
  if (minutes < 0 || minutes > 99) return false;
  
  // Seconds should be 0-59
  if (seconds < 0 || seconds > 59) return false;
  
  return true;
}

/**
 * Normalize pace string to MM:SS format
 * Handles various input formats and converts to standard "8:00" format
 */
export function normalizePace(pace: string | null | undefined): string | null {
  if (!pace) return null;
  
  // Remove whitespace
  pace = pace.trim();
  
  // If already in MM:SS format, validate and return
  if (validatePaceFormat(pace)) {
    // Ensure it's properly formatted (e.g., "8:0" -> "8:00")
    const [minutes, seconds] = pace.split(':');
    return `${minutes}:${seconds.padStart(2, '0')}`;
  }
  
  // Try to parse other formats
  // Handle "8.5" (8 minutes 30 seconds) -> "8:30"
  if (pace.includes('.')) {
    const [mins, dec] = pace.split('.');
    const minutes = parseInt(mins) || 0;
    const seconds = Math.round(parseFloat(`0.${dec}`) * 60);
    if (seconds < 60) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }
  
  // Handle plain number "8" -> "8:00"
  const numMatch = pace.match(/^(\d+)$/);
  if (numMatch) {
    const minutes = parseInt(numMatch[1]);
    if (minutes >= 0 && minutes <= 99) {
      return `${minutes}:00`;
    }
  }
  
  // If we can't parse it, return null (invalid)
  return null;
}

/**
 * Convert pace from MM:SS format to seconds per mile
 * Examples: "8:00" → 480, "9:30" → 570, "7:15" → 435
 */
export function paceToSeconds(pace: string | null | undefined): number | null {
  if (!pace) return null;
  
  const normalized = normalizePace(pace);
  if (!normalized) return null;
  
  const [minutes, seconds] = normalized.split(':').map(Number);
  return minutes * 60 + seconds;
}

/**
 * Convert seconds per mile to MM:SS format
 * Examples: 480 → "8:00", 570 → "9:30", 435 → "7:15"
 */
export function secondsToPace(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined) return null;
  
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

