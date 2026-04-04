/**
 * RunSignUp Affiliate URL Builder
 * 
 * Affiliate tracking for race discovery clicks (RunSignUp referral URLs).
 * 
 * WHY AFFILIATE TOKENS ARE PUBLIC:
 * - RunSignUp affiliate tokens are designed to be client-safe
 * - They're used in URLs that users click, so they must be public
 * - They're different from API keys/secrets which are server-only
 * - Affiliate tokens don't grant API access, only track referrals
 * 
 * WHY API SECRETS ARE NOT PUBLIC:
 * - API keys/secrets grant full API access (read/write data)
 * - Exposing them would allow unauthorized API calls
 * - They must remain server-only for security
 */

/**
 * Build RunSignUp affiliate URL with tracking parameters
 * 
 * Behavior:
 * - Accepts an already-valid RunSignUp URL (from race.url)
 * - Does NOT guess or rebuild URLs (strict pass-through)
 * - Appends affiliate token using `aff` parameter
 * - Appends UTMs for campaign tracking
 * - Returns final URL string
 * 
 * @param raceUrl - Valid RunSignUp URL from race data (may be empty)
 * @returns Final URL with affiliate tracking, or empty string if input invalid
 */
export function buildRunSignUpAffiliateUrl(
  raceUrl: string,
  options?: { applyAffiliate?: boolean }
): string {
  // If raceUrl is empty or invalid → return empty string
  if (!raceUrl || typeof raceUrl !== 'string' || raceUrl.trim() === '') {
    return '';
  }

  const trimmed = raceUrl.trim();

  // External registration sites: open as-is (no RunSignup tracking)
  if (!trimmed.includes('runsignup.com')) {
    return trimmed;
  }

  if (options?.applyAffiliate === false) {
    return trimmed;
  }

  // Get affiliate token from public env var (safe for client)
  // NOTE: In Next.js, NEXT_PUBLIC_ vars are embedded at build time
  // If you change .env.local, you need to restart the dev server
  const affiliateToken = process.env.NEXT_PUBLIC_RUNSIGNUP_AFFILIATE_TOKEN;

  console.log('🔍 Affiliate URL Builder Debug:', {
    hasToken: !!affiliateToken,
    tokenLength: affiliateToken?.length || 0,
    tokenPreview: affiliateToken ? `${affiliateToken.substring(0, 4)}...` : 'missing',
    inputUrl: trimmed,
  });

  if (!affiliateToken) {
    console.warn('⚠️ RunSignUp affiliate token not configured - check NEXT_PUBLIC_RUNSIGNUP_AFFILIATE_TOKEN in .env.local');
    // Still return the URL without affiliate tracking
    return trimmed;
  }

  try {
    // Parse existing URL to preserve all existing params
    const url = new URL(trimmed);

    // Append affiliate token (RunSignUp uses 'aff' parameter)
    url.searchParams.set('aff', affiliateToken);

    // Append UTMs for campaign tracking
    url.searchParams.set('utm_source', 'gofast');
    url.searchParams.set('utm_medium', 'race_discovery');
    url.searchParams.set('utm_campaign', 'runsignup_affiliate');

    const finalUrl = url.toString();
    console.log('✅ Built affiliate URL:', {
      original: trimmed,
      final: finalUrl,
      hasAffParam: finalUrl.includes('aff='),
    });

    return finalUrl;
  } catch (error) {
    // Invalid URL format - return empty string
    console.error('❌ Invalid RunSignUp URL format:', trimmed);
    return '';
  }
}

