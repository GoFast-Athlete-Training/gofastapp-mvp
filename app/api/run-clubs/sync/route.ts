import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_COMPANY_APP_URL || 'https://gofasthq.gofastcrushgoals.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/run-clubs/sync
 *
 * Syncs a run club from Company (acq_run_clubs) to Product (run_clubs).
 * This is a dedicated endpoint for hydrating run clubs without creating series.
 *
 * Body:
 *   runClub  object  (required) — source of truth from GoFastCompany acq_run_clubs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const runClubPayload = body.runClub;

    if (!runClubPayload || typeof runClubPayload !== 'object') {
      return NextResponse.json(
        { success: false, error: 'runClub payload is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const rc = runClubPayload as Record<string, unknown>;
    const id = rc.id != null ? String(rc.id).trim() : null;
    const nameVal = rc.name != null ? String(rc.name).trim() : 'Unnamed';
    const slugVal = rc.slug != null ? String(rc.slug).trim() : (id || nameVal.toLowerCase().replace(/\s+/g, '-'));
    const slugFinal = slugVal || id || `club-${Date.now()}`;

    console.log('🔄 PRODUCT SYNC: Received run club payload:', {
      id,
      name: nameVal,
      allRunsDescription: rc.allRunsDescription ? `${String(rc.allRunsDescription).substring(0, 50)}...` : null,
      allRunsDescriptionType: typeof rc.allRunsDescription,
      allRunsDescriptionValue: rc.allRunsDescription,
    });

    const updateData = {
      name: nameVal,
      slug: slugFinal,
      city: rc.city != null ? String(rc.city).trim() || null : null,
      websiteUrl: rc.websiteUrl != null ? String(rc.websiteUrl).trim() || null : null,
      runUrl: rc.runUrl != null ? String(rc.runUrl).trim() || null : null,
      stravaUrl: rc.stravaUrl != null ? String(rc.stravaUrl).trim() || null : null,
      description: rc.description != null ? String(rc.description).trim() || null : null,
      allRunsDescription: (() => {
        if (rc.allRunsDescription == null) return null;
        const trimmed = String(rc.allRunsDescription).trim();
        return trimmed.length > 0 ? trimmed : null;
      })(),
      runSchedule: (() => {
        if (rc.runSchedule == null) return null;
        const trimmed = String(rc.runSchedule).trim();
        return trimmed.length > 0 ? trimmed : null;
      })(),
      logoUrl: rc.logoUrl != null ? String(rc.logoUrl).trim() || null : null,
      syncedAt: new Date(),
    };

    console.log('🔄 PRODUCT SYNC: Processed updateData:', {
      id,
      allRunsDescription: updateData.allRunsDescription ? `${updateData.allRunsDescription.substring(0, 50)}...` : null,
    });

    // Original genius design: Company ID = Product app ID!
    // When id is provided, it's the Company ID - use it directly as Product app ID
    let runClub;
    
    if (id) {
      // Simple upsert: Company ID = Product app ID
      console.log('🔄 PRODUCT SYNC: Using ID-based upsert (Company ID = Product app ID):', { 
        id, 
        slug: slugFinal 
      });
      
      runClub = await prisma.run_clubs.upsert({
        where: { id },
        create: { id, ...updateData },
        update: updateData,
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          allRunsDescription: true,
        },
      });
      
      // Verify what was actually saved
      const verified = await prisma.run_clubs.findUnique({
        where: { id: runClub.id },
        select: { allRunsDescription: true },
      });
      
      console.log('🔄 PRODUCT SYNC: After upsert, verified from database:', {
        id: runClub.id,
        slug: runClub.slug,
        allRunsDescription: verified?.allRunsDescription ? `${verified.allRunsDescription.substring(0, 100)}...` : null,
        allRunsDescriptionLength: verified?.allRunsDescription?.length || 0,
        matchesExpected: verified?.allRunsDescription === updateData.allRunsDescription,
      });
      
      // Update runClub with verified value
      runClub.allRunsDescription = verified?.allRunsDescription || null;
    } else {
      // No ID provided - slug-based matching (fallback)
      const existing = await prisma.run_clubs.findUnique({ where: { slug: slugFinal } });
      if (existing) {
        runClub = await prisma.run_clubs.update({
          where: { id: existing.id },
          data: updateData,
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            allRunsDescription: true,
          },
        });
      } else {
        runClub = await prisma.run_clubs.create({
          data: { ...updateData, slug: slugFinal },
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            allRunsDescription: true,
          },
        });
      }
    }

    console.log('✅ PRODUCT SYNC: Successfully saved run club:', {
      id: runClub.id,
      name: runClub.name,
      allRunsDescription: runClub.allRunsDescription ? `${runClub.allRunsDescription.substring(0, 50)}...` : null,
    });

    const response = NextResponse.json({
      success: true,
      runClub,
    });
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  } catch (error: any) {
    console.error('[sync-run-clubs] Error:', error);
    const response = NextResponse.json(
      { success: false, error: error?.message || 'Failed to sync run club' },
      { status: 500, headers: corsHeaders }
    );
    return response;
  }
}
