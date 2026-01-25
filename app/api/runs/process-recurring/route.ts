export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { processConcludedRecurringRuns } from '@/lib/services/recurring-runs';

/**
 * POST /api/runs/process-recurring
 * 
 * Process concluded recurring runs and generate next instances
 * Can be called manually or via cron job
 * 
 * Authentication: Optional (for manual calls), required for cron
 */
export async function POST(request: Request) {
  try {
    // Optional: Verify authentication for manual calls
    // For cron jobs, you might want to use a secret token instead
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        await adminAuth.verifyIdToken(authHeader.substring(7));
      } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }

    const createdCount = await processConcludedRecurringRuns();

    return NextResponse.json({
      success: true,
      message: `Processed recurring runs, created ${createdCount} new instances`,
      createdCount,
    });
  } catch (error: any) {
    console.error('Error processing recurring runs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process recurring runs', details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/runs/process-recurring
 * 
 * Same as POST, for easier cron job setup
 */
export async function GET(request: Request) {
  return POST(request);
}

