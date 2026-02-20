import { prisma } from './prisma';

/**
 * Check if RunClub exists in gofastapp-mvp database
 * 
 * @param slug - RunClub slug to check
 * @returns RunClub data if exists, null if not found
 */
export async function checkRunClubExists(slug: string): Promise<any | null> {
  if (!slug || !slug.trim()) {
    return null;
  }

  try {
    const existing = await prisma.run_clubs.findUnique({
      where: { slug: slug.trim() },
    });
    return existing;
  } catch (error: any) {
    console.error(`Failed to check RunClub ${slug}:`, error?.message || error);
    return null;
  }
}

/**
 * Save RunClub data to gofastapp-mvp run_clubs table
 * Checks if exists first - only saves/updates if needed
 * Called when RunClub object is provided (e.g., from GoFastCompany POST)
 * 
 * IMPORTANT: Prisma generates the UUID `id` automatically via @default(uuid())
 * We NEVER set `id` manually - Prisma is the canonical source for IDs
 * 
 * @param runClub - RunClub object with: slug, name, logoUrl (or logo), city
 * @returns Saved RunClub data (with Prisma-generated id) or null if save failed
 */
export async function saveRunClub(runClub: {
  slug: string;
  name: string;
  logoUrl?: string | null;
  logo?: string | null;
  city?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  stravaUrl?: string | null;
}): Promise<any | null> {
  if (!runClub.slug || !runClub.name) {
    console.warn('RunClub missing required fields (slug or name)');
    return null;
  }

  try {
    // Check if RunClub already exists
    const existing = await checkRunClubExists(runClub.slug);
    
    if (existing) {
      // Already exists - check if update is needed
      const logoUrl = runClub.logoUrl || runClub.logo || null;
      const needsUpdate = 
        existing.name !== runClub.name ||
        existing.logoUrl !== logoUrl ||
        existing.city !== (runClub.city || null) ||
        existing.description !== (runClub.description || null) ||
        existing.websiteUrl !== (runClub.websiteUrl || null) ||
        existing.instagramUrl !== (runClub.instagramUrl || null) ||
        existing.stravaUrl !== (runClub.stravaUrl || null);
      
      if (needsUpdate) {
        // Update if data changed
        const updated = await prisma.run_clubs.update({
          where: { slug: runClub.slug },
          data: {
            name: runClub.name,
            logoUrl: logoUrl,
            city: runClub.city || null,
            description: runClub.description || null,
            websiteUrl: runClub.websiteUrl || null,
            instagramUrl: runClub.instagramUrl || null,
            stravaUrl: runClub.stravaUrl || null,
            syncedAt: new Date(),
          },
        });
        return updated;
      } else {
        // No changes needed - return existing
        return existing;
      }
    } else {
      // Doesn't exist - create it
      const created = await prisma.run_clubs.create({
        data: {
          slug: runClub.slug,
          name: runClub.name,
          logoUrl: runClub.logoUrl || runClub.logo || null,
          city: runClub.city || null,
          description: runClub.description || null,
          websiteUrl: runClub.websiteUrl || null,
          instagramUrl: runClub.instagramUrl || null,
          stravaUrl: runClub.stravaUrl || null,
          syncedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      return created;
    }
  } catch (error: any) {
    console.error(`Failed to save RunClub ${runClub.slug}:`, error?.message || error);
    return null;
  }
}

