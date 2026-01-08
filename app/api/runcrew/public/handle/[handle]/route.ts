export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCrewPublicMetadataByHandle } from '@/lib/domain-runcrew';

/**
 * GET /api/runcrew/public/handle/[handle]
 * 
 * Public endpoint to fetch minimal crew metadata by handle.
 * No authentication required - returns only safe, public information.
 * 
 * Returns:
 * - id
 * - handle
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
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params;
    
    if (!handle) {
      return NextResponse.json(
        { error: 'Missing handle' },
        { status: 400 }
      );
    }

    const crew = await getCrewPublicMetadataByHandle(handle);

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
    console.error('Error fetching public crew metadata by handle:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

