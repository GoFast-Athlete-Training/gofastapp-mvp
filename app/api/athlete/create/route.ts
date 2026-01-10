export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { GOFAST_COMPANY_ID } from '@/lib/goFastCompanyConfig';

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('❌ ATHLETE CREATE: Missing or invalid auth header');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    console.log('🔑 ATHLETE CREATE: Received token (first 20 chars):', token.substring(0, 20) + '...');
    
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
      console.log('✅ ATHLETE CREATE: Token verified for UID:', decodedToken.uid);
      console.log('✅ ATHLETE CREATE: Token project:', decodedToken.firebase?.project_id || 'unknown');
    } catch (err: any) {
      console.error('❌ ATHLETE CREATE: Token verification failed');
      console.error('❌ ATHLETE CREATE: Error code:', err?.code);
      console.error('❌ ATHLETE CREATE: Error message:', err?.message);
      console.error('❌ ATHLETE CREATE: Error name:', err?.name);
      
      // Check if it's a Firebase Admin initialization error
      if (err?.message?.includes('Firebase Admin env vars missing') || err?.message?.includes('Firebase Admin')) {
        console.error('❌ ATHLETE CREATE: Firebase Admin initialization failed');
        console.error('❌ ATHLETE CREATE: Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars');
        return NextResponse.json({ 
          success: false, 
          error: 'Firebase Admin initialization failed',
          details: err?.message || 'Check Firebase environment variables'
        }, { status: 500 });
      }
      
      console.error('❌ ATHLETE CREATE: Token (first 50 chars):', token.substring(0, 50));
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid token',
        details: err?.message || 'Token verification failed'
      }, { status: 401 });
    }

    const firebaseId = decodedToken.uid;
    const email = decodedToken.email || undefined;
    // Firebase Admin SDK uses 'name' field for displayName in decoded token
    // Check both 'name' and 'displayName' fields (though 'displayName' is less common)
    const displayName = decodedToken.name || decodedToken.displayName || undefined;
    const picture = decodedToken.picture || undefined;
    
    console.log('👤 ATHLETE CREATE: Firebase token name:', displayName || 'missing');
    console.log('📸 ATHLETE CREATE: Firebase token picture:', picture ? 'present' : 'missing');
    if (picture) {
      console.log('📸 ATHLETE CREATE: Picture URL:', picture.substring(0, 50) + '...');
    }
    
    // Log all available token fields for debugging
    const relevantFields = Object.keys(decodedToken).filter(k => ['name', 'email', 'picture', 'displayName'].includes(k));
    console.log('🔍 ATHLETE CREATE: Available token fields:', relevantFields);
    if (decodedToken.name && decodedToken.displayName && decodedToken.name !== decodedToken.displayName) {
      console.warn('⚠️ ATHLETE CREATE: name field differs from displayName field. name:', decodedToken.name, 'displayName:', decodedToken.displayName);
    }

    // Normalize displayName into firstName/lastName with duplicate detection
    // Rules:
    // 1. Split on whitespace (handles single space, multiple spaces, tabs, etc.)
    // 2. First token = firstName
    // 3. All remaining tokens = lastName (handles middle names)
    // 4. If only one token exists, it's firstName (no lastName)
    // 5. Empty/null displayName = both null
    // 6. SAFETY: Detect and fix duplicated names (e.g., "Adam Adam" -> firstName="Adam", lastName=null)
    let firstName: string | null = null;
    let lastName: string | null = null;
    
    if (displayName) {
      const trimmed = displayName.trim();
      if (trimmed) {
        // Split on any whitespace and filter out empty strings
        const parts = trimmed.split(/\s+/).filter(part => part.length > 0);
        
        if (parts.length > 0) {
          firstName = parts[0] || null;
          
          // Only set lastName if there are additional parts after firstName
          if (parts.length > 1) {
            const remainingParts = parts.slice(1);
            lastName = remainingParts.join(' ').trim() || null;
            
            // SAFETY GUARD: Detect duplicated names (e.g., "Adam Adam" or "Adam Adam Cole")
            // If firstName equals the first part of lastName, it's likely a duplicate
            // Fix by treating the first occurrence as firstName and subsequent as lastName
            if (firstName && lastName) {
              const lastNameParts = lastName.split(/\s+/);
              // If firstName matches first part of lastName exactly, it's a duplicate
              if (lastNameParts.length > 0 && firstName.toLowerCase() === lastNameParts[0].toLowerCase()) {
                console.warn('⚠️ ATHLETE CREATE: Detected duplicated firstName in displayName:', displayName);
                // Remove the duplicate first word from lastName
                lastName = lastNameParts.slice(1).join(' ').trim() || null;
                console.log('👤 ATHLETE CREATE: Fixed duplicate - firstName:', firstName, 'lastName:', lastName);
              }
            }
          }
          // If only one part, firstName is set, lastName remains null
        }
      }
    }
    
    console.log('👤 ATHLETE CREATE: Normalized from displayName:', displayName);
    console.log('👤 ATHLETE CREATE: → firstName:', firstName);
    console.log('👤 ATHLETE CREATE: → lastName:', lastName);
    
    // Additional validation warnings
    if (displayName) {
      if (firstName && lastName && firstName.toLowerCase() === lastName.toLowerCase()) {
        console.warn('⚠️ ATHLETE CREATE: firstName === lastName after normalization:', firstName, 'from displayName:', displayName);
        // If they're still equal after normalization, clear lastName (likely a duplicate)
        lastName = null;
      }
      if (firstName && !lastName && displayName.includes(' ')) {
        console.warn('⚠️ ATHLETE CREATE: displayName contains space but lastName is null after normalization:', displayName);
      }
    }

    // Step 1: Resolve Canonical Company (Pin to First Company)
    // Always use the first company (oldest by createdAt) as the single source of truth
    let company = await prisma.goFastCompany.findUnique({
      where: { id: GOFAST_COMPANY_ID },
    });
    
    // If company doesn't exist with the configured ID, find the first company by creation date
    if (!company) {
      console.log("⚠️ ATHLETE CREATE: Configured company ID not found, finding first company by createdAt...");
      company = await prisma.goFastCompany.findFirst({
        orderBy: { createdAt: 'asc' },
      });
      
      if (!company) {
        throw new Error("No GoFastCompany found. Please run setup script or check database migrations.");
      }
      
      console.log(`⚠️ ATHLETE CREATE: Using first company (${company.id}) instead of configured ID. Update config to match.`);
    }
    
    console.log('✅ ATHLETE CREATE: Using company:', company.id, company.name || company.slug);

    console.log('🔍 ATHLETE CREATE: Looking up athlete with firebaseId:', firebaseId);

    // Check if athlete already exists to preserve user-edited profile data
    const existingAthlete = await prisma.athlete.findUnique({
      where: { firebaseId },
      select: { id: true, firstName: true, lastName: true, photoURL: true }
    });

    // Use upsert pattern to atomically handle create/update and prevent race conditions
    // This ensures only one athlete record exists per firebaseId
    const updateData: any = {};
    const createData: any = {
      firebaseId,
      companyId: company.id,
    };

    // Sync Firebase data - only include fields that are defined
    if (email !== undefined) {
      updateData.email = email || undefined;
      createData.email = email || undefined;
    }
    
    // IDEMPOTENT name handling: Only use displayName if athlete name is empty
    // Rules:
    // 1. Never append or concatenate names
    // 2. Never merge existing + incoming values
    // 3. Treat displayName as authoritative ONLY if athlete name is empty
    // 4. If athlete already has a name, preserve it (do not overwrite or merge)
    if (displayName !== undefined && (firstName !== null || lastName !== null)) {
      // For new athletes (create), always set names from displayName
      createData.firstName = firstName || null;
      createData.lastName = lastName || null;
      
      // For existing athletes (update), only set if name is empty
      // This ensures idempotency - repeated calls won't overwrite user-edited names
      const hasExistingName = existingAthlete?.firstName || existingAthlete?.lastName;
      
      if (!hasExistingName) {
        // Athlete has no name - safe to set from displayName
        if (firstName !== null) {
          updateData.firstName = firstName;
          console.log('👤 ATHLETE CREATE: Setting firstName from token (athlete has no name):', firstName);
        }
        if (lastName !== null) {
          updateData.lastName = lastName;
          console.log('👤 ATHLETE CREATE: Setting lastName from token (athlete has no name):', lastName);
        }
      } else {
        // Athlete already has a name - preserve it (idempotent behavior)
        console.log('👤 ATHLETE CREATE: Preserving existing name fields (idempotent) - firstName:', existingAthlete?.firstName, 'lastName:', existingAthlete?.lastName);
        console.log('👤 ATHLETE CREATE: Ignoring displayName to prevent overwrite:', displayName);
      }
    } else {
      if (displayName === undefined) {
        console.log('👤 ATHLETE CREATE: No displayName in token, skipping name sync');
      } else {
        console.log('👤 ATHLETE CREATE: displayName exists but normalized to null - skipping name sync');
      }
    }
    // Sync photoURL only if athlete doesn't already have one set
    if (picture !== undefined) {
      createData.photoURL = picture || undefined;
      if (!existingAthlete?.photoURL) {
        updateData.photoURL = picture || undefined;
      }
    }
    // companyId is always derived from GoFastCompany (ultra container)
    updateData.companyId = company.id;

    const athlete = await prisma.athlete.upsert({
      where: { firebaseId },
      update: updateData,
      create: createData,
    });

    if (athlete.firebaseId === firebaseId && athlete.companyId === company.id) {
      console.log('✅ ATHLETE CREATE: Athlete record synced successfully:', athlete.id);
    } else {
      console.log('✅ ATHLETE CREATE: New athlete record created successfully:', athlete.id);
    }

    // Format response like MVP1
    const response = NextResponse.json({
      success: true,
      message: 'Athlete found or created',
      athleteId: athlete.id,
      data: {
        id: athlete.id,
        firebaseId: athlete.firebaseId,
        email: athlete.email,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        gofastHandle: athlete.gofastHandle,
        birthday: athlete.birthday,
        gender: athlete.gender,
        city: athlete.city,
        state: athlete.state,
        primarySport: athlete.primarySport,
        photoURL: athlete.photoURL,
        bio: athlete.bio,
        instagram: athlete.instagram,
        createdAt: athlete.createdAt,
        updatedAt: athlete.updatedAt,
      },
    });

    return response;
  } catch (err: any) {
    console.error('❌ ATHLETE CREATE: Error:', err);
    console.error('❌ ATHLETE CREATE: Error code:', err?.code);
    console.error('❌ ATHLETE CREATE: Error name:', err?.name);
    console.error('❌ ATHLETE CREATE: Error stack:', err?.stack);
    
    // Check for table doesn't exist error (P2021)
    if (err?.code === 'P2021') {
      console.error('❌ ATHLETE CREATE: Database table does not exist');
      console.error('❌ ATHLETE CREATE: Table:', err?.meta?.table);
      console.error('❌ ATHLETE CREATE: This usually means migrations need to be run');
      return NextResponse.json({ 
        success: false, 
        error: 'Database table does not exist',
        details: `Table ${err?.meta?.table || 'Athlete'} does not exist. Please run database migrations: npx prisma db push or npx prisma migrate deploy`,
        code: err?.code,
        table: err?.meta?.table
      }, { status: 500 });
    }
    
    // Check for Prisma unique constraint violations (email already exists)
    if (err?.code === 'P2002') {
      console.error('❌ ATHLETE CREATE: Unique constraint violation');
      console.error('❌ ATHLETE CREATE: Meta:', err?.meta);
      return NextResponse.json({ 
        success: false, 
        error: 'Email already exists',
        details: err?.meta?.target ? `Field ${err.meta.target.join(', ')} already exists` : err?.message
      }, { status: 409 });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Server error', 
      details: err?.message || 'Unknown error',
      code: err?.code
    }, { status: 500 });
  }
}
