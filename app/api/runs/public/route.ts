export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getRuns } from '@/lib/domain-runs';

/**
 * GET /api/runs/public
 * 
 * PUBLIC endpoint to get runs with optional filters (no authentication required)
 * 
 * Query params:
 * - gofastCity (optional) - Filter by city slug
 * - day (optional) - Filter by day of week ("Monday", "Tuesday", etc.)
 * 
 * Returns:
 * {
 *   success: true,
 *   runs: [...]
 * }
 */
export async function GET(request: Request) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const gofastCity = searchParams.get('gofastCity') || undefined;
    const day = searchParams.get('day') || undefined;

    // Get runs with filters (public-safe data only)
    const runs = await getRuns({ gofastCity, day });

    return NextResponse.json({
      success: true,
      runs,
    });
  } catch (error: any) {
    console.error('Error fetching public runs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch runs', details: error?.message },
      { status: 500 }
    );
  }
}

