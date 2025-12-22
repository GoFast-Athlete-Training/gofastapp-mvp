export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCrewPublicMetadata } from '@/lib/domain-runcrew';

/**
 * GET /api/runcrew/public/[crewId]
 * 
 * Public endpoint to fetch minimal crew metadata for invite links.
 * No authentication required - returns only safe, public information.
 * 
 * Returns:
 * - id
 * - name
 * - description
 * - logo (if exists)
 * - icon (if exists)
 * - joinCode (for manual join fallback)
 * 
 * Does NOT return:
 * - memberships
 * - messages
 * - announcements
 * - runs
 * - managers
 * - any sensitive data
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ crewId: string }> }
) {
  try {
    const { crewId } = await params;
    
    if (!crewId) {
      return NextResponse.json(
        { error: 'Missing crew id' },
        { status: 400 }
      );
    }

    const crew = await getCrewPublicMetadata(crewId);

    if (!crew) {
      return NextResponse.json(
        { error: 'Crew not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      runCrew: crew,
    });
  } catch (err) {
    console.error('Error fetching public crew metadata:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

