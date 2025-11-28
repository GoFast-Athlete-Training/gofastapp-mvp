export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// This is a webhook endpoint for Garmin to send activity data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Process Garmin webhook data
    // This is a simplified version - you'll need to implement full webhook handling
    const { activityId, userId, activityData } = body;

    // Find athlete by Garmin user ID
    const athlete = await prisma.athlete.findUnique({
      where: { garmin_user_id: userId },
    });

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Create or update activity
    // TODO: Implement full activity creation logic

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error processing Garmin activity:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process activity' },
      { status: 500 }
    );
  }
}

