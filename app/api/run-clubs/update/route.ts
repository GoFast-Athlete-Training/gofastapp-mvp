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
 * POST /api/run-clubs/update
 *
 * Receives run club data from Company app (prodpush).
 * Product app owns parse/save - it's Product's DB!
 * 
 * If data is jacked, Product app and services handle it: "Go to work boys and get this ready"
 * 
 * Body:
 *   runClub  object  (required) — data from GoFastCompany acq_run_clubs
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

    console.log('📥 PRODUCT UPDATE: Received run club payload:', {
      id,
      name: nameVal,
      allRunsDescription: rc.allRunsDescription ? `${String(rc.allRunsDescription).substring(0, 50)}...` : null,
      fieldsReceived: Object.keys(rc).length,
    });

    // Product app owns parse/validate/transform - all the magic happens here
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
      logoUrl: rc.logoUrl != null ? String(rc.logoUrl).trim() || null : null,
      instagramUrl: rc.instagramUrl != null ? String(rc.instagramUrl).trim() || null : null,
      state: rc.state != null ? String(rc.state).trim() || null : null,
      neighborhood: rc.neighborhood != null ? String(rc.neighborhood).trim() || null : null,
      syncedAt: new Date(),
    };

    console.log('📥 PRODUCT UPDATE: Processed updateData:', {
      id,
      allRunsDescription: updateData.allRunsDescription ? `${updateData.allRunsDescription.substring(0, 50)}...` : null,
    });

    // Original genius design: Company ID = Product app ID!
    // When id is provided, it's the Company ID - use it directly as Product app ID
    let runClub;
    
    if (id) {
      // Check if club with this ID already exists
      const existingById = await prisma.run_clubs.findUnique({ where: { id } });
      
      // Check if club with this slug already exists (might have different ID)
      const existingBySlug = await prisma.run_clubs.findUnique({ where: { slug: slugFinal } });
      
      console.log('📥 PRODUCT UPDATE: Checking existing clubs:', {
        id,
        slug: slugFinal,
        existsById: !!existingById,
        existsBySlug: !!existingBySlug,
        existingBySlugId: existingBySlug?.id,
        idsMatch: existingBySlug?.id === id,
      });
      
      // If slug exists with different ID, update that club instead (slug conflict resolution)
      if (existingBySlug && existingBySlug.id !== id) {
        console.log('⚠️ PRODUCT UPDATE: Slug conflict - updating existing club by slug:', {
          existingId: existingBySlug.id,
          newId: id,
          slug: slugFinal,
        });
        
        // Update the existing club (by slug) with new data
        runClub = await prisma.run_clubs.update({
          where: { id: existingBySlug.id },
          data: updateData,
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            allRunsDescription: true,
            runUrl: true,
            logoUrl: true,
          },
        });
      } else if (existingById) {
        // Club with this ID exists - update it
        console.log('📥 PRODUCT UPDATE: Updating existing club by ID:', { id });
        runClub = await prisma.run_clubs.update({
          where: { id },
          data: updateData,
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            allRunsDescription: true,
            runUrl: true,
            logoUrl: true,
          },
        });
      } else {
        // No existing club - create new one
        console.log('📥 PRODUCT UPDATE: Creating new club:', { id, slug: slugFinal });
        runClub = await prisma.run_clubs.create({
          data: { id, ...updateData },
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            allRunsDescription: true,
            runUrl: true,
            logoUrl: true,
          },
        });
      }
      
      // Verify what was actually saved
      const verified = await prisma.run_clubs.findUnique({
        where: { id: runClub.id },
        select: {
          allRunsDescription: true,
        },
      });
      
      console.log('📥 PRODUCT UPDATE: After save, verified from database:', {
        id: runClub.id,
        slug: runClub.slug,
        allRunsDescription: verified?.allRunsDescription ? `${verified.allRunsDescription.substring(0, 100)}...` : null,
        allRunsDescriptionLength: verified?.allRunsDescription?.length || 0,
        allRunsDescriptionMatches: verified?.allRunsDescription === updateData.allRunsDescription,
      });
      
      // Update runClub with verified values
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
            runUrl: true,
            logoUrl: true,
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
            runUrl: true,
            logoUrl: true,
          },
        });
      }
    }

    console.log('✅ PRODUCT UPDATE: Successfully saved run club:', {
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
    console.error('[update-run-clubs] Error:', error);
    const response = NextResponse.json(
      { success: false, error: error?.message || 'Failed to update run club' },
      { status: 500, headers: corsHeaders }
    );
    return response;
  }
}
