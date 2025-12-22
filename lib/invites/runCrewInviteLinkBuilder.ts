/**
 * RunCrew InviteLink Builder Utility
 * 
 * Provides helper functions to generate InviteLinks and manage join codes
 * for RunCrew sharing and invitation flows.
 */

export interface CrewInviteInfo {
  inviteLink: string;
  joinCode?: string;
}

/**
 * Build the canonical InviteLink URL for a crew
 * 
 * @param crewId - The RunCrew ID
 * @returns The full InviteLink URL: /join/crew/<crewId>
 */
export function buildInviteLink(crewId: string): string {
  if (!crewId) {
    throw new Error('crewId is required');
  }
  
  // Get base URL (works in both dev and production)
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_BASE_URL || '';
  
  return `${baseUrl}/join/crew/${crewId}`;
}

/**
 * Build InviteLink info from a crew record
 * 
 * @param crew - RunCrew record (must have at least id and optionally joinCode)
 * @returns Object containing inviteLink and optional joinCode
 */
export function buildCrewInviteInfo(crew: { id: string; joinCode?: string }): CrewInviteInfo {
  if (!crew || !crew.id) {
    throw new Error('Crew record must have an id');
  }

  return {
    inviteLink: buildInviteLink(crew.id),
    joinCode: crew.joinCode,
  };
}

/**
 * Extract crewId from an InviteLink URL
 * 
 * @param inviteLink - Full URL or path like /join/crew/<crewId>
 * @returns The crewId or null if invalid
 */
export function extractCrewIdFromInviteLink(inviteLink: string): string | null {
  if (!inviteLink) {
    return null;
  }

  // Handle both full URLs and paths
  const match = inviteLink.match(/\/join\/crew\/([^\/\?]+)/);
  return match ? match[1] : null;
}

/**
 * Validate if a string is a valid InviteLink format
 * 
 * @param inviteLink - URL or path to validate
 * @returns true if valid InviteLink format
 */
export function isValidInviteLink(inviteLink: string): boolean {
  return extractCrewIdFromInviteLink(inviteLink) !== null;
}

