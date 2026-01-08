export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { hydrateCrew } from '@/lib/domain-runcrew';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing crew id' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const firebaseId = decodedToken.uid;

    let athlete;
    try {
      athlete = await getAthleteByFirebaseId(firebaseId);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Hydrate crew data
    let crew;
    try {
      crew = await hydrateCrew(id);
    } catch (err: any) {
      console.error('❌ RUNCREW GET: Prisma error:', err);
      console.error('❌ RUNCREW GET: Error message:', err?.message);
      console.error('❌ RUNCREW GET: Error stack:', err?.stack);
      return NextResponse.json({ error: 'DB error', details: err?.message }, { status: 500 });
    }

    if (!crew) {
      console.error('❌ RUNCREW GET: Crew not found for id:', id);
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    // SERVER-SIDE MEMBERSHIP ENFORCEMENT (REQUIRED)
    // Verify user is a member of the crew before returning data
    const isMember = crew.membershipsBox?.memberships?.some(
      (membership: any) => membership.athleteId === athlete.id
    );
    
    if (!isMember) {
      console.error('❌ RUNCREW GET: User is not a member of crew:', id, 'athleteId:', athlete.id);
      return NextResponse.json({ error: 'Forbidden - Membership required' }, { status: 403 });
    }

    try {
      // Ensure proper JSON serialization by converting Date objects
      const serializedCrew = JSON.parse(JSON.stringify(crew, (key, value) => {
        // Convert Date objects to ISO strings
        if (value instanceof Date) {
          return value.toISOString();
        }
        // Handle BigInt if present
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      }));
      
      return NextResponse.json({ success: true, runCrew: serializedCrew });
    } catch (serializeErr: any) {
      console.error('❌ RUNCREW GET: JSON serialization error:', serializeErr);
      console.error('❌ RUNCREW GET: Serialization error message:', serializeErr?.message);
      console.error('❌ RUNCREW GET: Crew data type:', typeof crew);
      console.error('❌ RUNCREW GET: Crew keys:', crew ? Object.keys(crew) : 'null');
      return NextResponse.json({ error: 'Serialization error', details: serializeErr?.message }, { status: 500 });
    }
  } catch (err: any) {
    console.error('❌ RUNCREW GET: Unexpected error:', err);
    console.error('❌ RUNCREW GET: Error message:', err?.message);
    console.error('❌ RUNCREW GET: Error stack:', err?.stack);
    return NextResponse.json({ error: 'Server error', details: err?.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing crew id' }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const firebaseId = decodedToken.uid;

    let athlete;
    try {
      athlete = await getAthleteByFirebaseId(firebaseId);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Single hydrate call - get crew data once
    let crew;
    try {
      crew = await hydrateCrew(id);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!crew) {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    // Verify user is admin
    const membership = crew.membershipsBox?.memberships?.find(
      (m: any) => m.athleteId === athlete.id
    );
    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    // Build update data object
    const { prisma } = await import('@/lib/prisma');
    const updateData: any = {};

    // Update name if provided
    if (body.name !== undefined) {
      updateData.name = body.name.trim() || null;
    }

    // Update description if provided
    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null;
    }

    // Update icon if provided
    if (body.icon !== undefined) {
      updateData.icon = body.icon?.trim() || null;
    }

    // Update logo if provided
    if (body.logo !== undefined) {
      updateData.logo = body.logo?.trim() || null;
    }

    // Update message topics if provided
    if (body.messageTopics && Array.isArray(body.messageTopics)) {
      try {
        updateData.messageTopics = body.messageTopics;
      } catch (err: any) {
        // If messageTopics column doesn't exist, log warning but don't fail
        if (err?.code === 'P2022' || err?.message?.includes('messageTopics')) {
          console.warn('⚠️ RUNCREW PUT: messageTopics column not found, skipping update. Run migration to add column.');
          delete updateData.messageTopics;
        } else {
          throw err; // Re-throw if it's a different error
        }
      }
    }

    // Perform update if there's data to update
    if (Object.keys(updateData).length > 0) {
      await prisma.run_crews.update({
        where: { id },
        data: updateData,
      });

      // Update the hydrated crew object with new values (single hydrate, no re-fetch)
      if (updateData.name !== undefined) {
        crew.runCrewBaseInfo.name = updateData.name;
      }
      if (updateData.description !== undefined) {
        crew.runCrewBaseInfo.description = updateData.description;
      }
      if (updateData.icon !== undefined) {
        crew.runCrewBaseInfo.icon = updateData.icon;
      }
      if (updateData.logo !== undefined) {
        crew.runCrewBaseInfo.logo = updateData.logo;
      }
      if (updateData.messageTopics !== undefined) {
        crew.runCrewBaseInfo.messageTopics = updateData.messageTopics;
      }
    }

    // Return the updated crew object (single hydrate, manually updated)
    return NextResponse.json({ success: true, runCrew: crew });
  } catch (err) {
    console.error('Error updating crew:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
