import { prisma } from './prisma';

/**
 * Fetch RunClub data from GoFastCompany API and save to gofastapp-mvp
 * Called when a run is created with runClubSlug (dual save pattern)
 * 
 * @param slug - RunClub slug to fetch and save
 * @returns Saved RunClub data or null if fetch failed
 */
export async function fetchAndSaveRunClub(slug: string): Promise<any | null> {
  if (!slug || !slug.trim()) {
    return null;
  }

  try {
    // Get GoFastCompany API URL from environment
    const gofastCompanyApiUrl = process.env.GOFAST_COMPANY_API_URL || process.env.NEXT_PUBLIC_GOFAST_COMPANY_API_URL;
    
    if (!gofastCompanyApiUrl) {
      console.warn('GOFAST_COMPANY_API_URL not configured, skipping RunClub sync');
      return null;
    }

    // Fetch RunClub from GoFastCompany API (GET request)
    const apiUrl = `${gofastCompanyApiUrl}/api/runclub-public/by-slug/${slug}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`RunClub ${slug} not found in GoFastCompany`);
        return null;
      }
      console.error(`Failed to fetch RunClub ${slug} from GoFastCompany: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.success || !data.runClub) {
      console.error(`Invalid response from GoFastCompany API for RunClub ${slug}`);
      return null;
    }

    const runClub = data.runClub;

    // Upsert into gofastapp-mvp database
    // Only save minimal fields needed for card/run display (name, logo, city)
    // All rich data stays in GoFastCompany for SEO/public pages
    const savedRunClub = await prisma.run_clubs.upsert({
      where: { slug },
      update: {
        name: runClub.name,
        logoUrl: runClub.logoUrl || runClub.logo || null, // Handle both logoUrl and logo fields
        city: runClub.city || null,
        syncedAt: new Date(),
      },
      create: {
        slug: runClub.slug,
        name: runClub.name,
        logoUrl: runClub.logoUrl || runClub.logo || null, // Handle both logoUrl and logo fields
        city: runClub.city || null,
        syncedAt: new Date(),
      },
    });

    return savedRunClub;
  } catch (error: any) {
    console.error(`Failed to fetch and save RunClub ${slug}:`, error?.message || error);
    return null;
  }
}

