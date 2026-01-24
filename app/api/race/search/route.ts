export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query string required' },
        { status: 400 }
      );
    }

    // Fuzzy search by name (case-insensitive, partial match)
    const races = await prisma.race_registry.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        raceType: true,
        distanceMiles: true,
        raceDate: true,
        city: true,
        state: true,
        country: true,
      },
      take: 20,
      orderBy: {
        raceDate: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      race_registry: races, // Match frontend expectation
    });
  } catch (error: any) {
    console.error('❌ RACE SEARCH: Error:', error);
    
    // Handle table doesn't exist error gracefully
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      console.error('❌ RACE SEARCH: race_registry table does not exist');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Race search is temporarily unavailable', 
          details: 'Database table not found. Please try creating a new race instead.' 
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to search races', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

