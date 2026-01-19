import crypto from 'crypto';

/**
 * Generate PKCE code verifier and challenge for Garmin OAuth 2.0
 * Note: state is NOT generated here - it will be the athleteId
 */
export function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  
  return {
    codeVerifier,
    codeChallenge
  };
}

/**
 * Build Garmin authorization URL with PKCE parameters
 * @param codeChallenge - SHA-256 hash of code verifier
 * @param athleteId - Athlete ID used as state parameter (matches legacy pattern)
 * @param redirectUri - Server callback URL
 */
export function buildGarminAuthUrl(codeChallenge: string, athleteId: string, redirectUri: string) {
  const clientId = process.env.GARMIN_CLIENT_ID;
  if (!clientId) {
    throw new Error('GARMIN_CLIENT_ID is not configured');
  }

  // Garmin scopes for full access
  const scopes = [
    'CONNECT_READ',      // Read activities, health data
    'CONNECT_WRITE',     // Write training plans, activities
    'PARTNER_READ',     // Partner-level read access
    'PARTNER_WRITE'     // Partner-level write access
  ].join(' ');
  
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: athleteId,  // Use athleteId as state (legacy pattern)
    scope: scopes,
    redirect_uri: redirectUri
  });
  
  return `https://connect.garmin.com/oauthConfirm?${params.toString()}`;
}

/**
 * Exchange authorization code for access tokens
 */
export async function exchangeCodeForTokens(code: string, codeVerifier: string, redirectUri: string) {
  const clientId = process.env.GARMIN_CLIENT_ID;
  const clientSecret = process.env.GARMIN_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Garmin OAuth credentials not configured');
  }

  const tokenUrl = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
  
  try {
    console.log(`🔍 [TOKEN_EXCHANGE] Starting token exchange`);
    console.log(`🔍 [TOKEN_EXCHANGE] Token URL: ${tokenUrl}`);
    console.log(`🔍 [TOKEN_EXCHANGE] Redirect URI: ${redirectUri}`);
    console.log(`🔍 [TOKEN_EXCHANGE] Code length: ${code.length}`);
    console.log(`🔍 [TOKEN_EXCHANGE] Code verifier length: ${codeVerifier.length}`);
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri
      })
    });
    
    console.log(`🔍 [TOKEN_EXCHANGE] Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [TOKEN_EXCHANGE] Garmin token exchange failed:', response.status, errorText);
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
    }
    
    const tokenData = await response.json();
    console.log('✅ [TOKEN_EXCHANGE] Tokens received from Garmin');
    console.log(`🔍 [TOKEN_EXCHANGE] Token data keys:`, Object.keys(tokenData));
    console.log(`🔍 [TOKEN_EXCHANGE] Has access_token: ${!!tokenData.access_token}`);
    console.log(`🔍 [TOKEN_EXCHANGE] Has refresh_token: ${!!tokenData.refresh_token}`);
    
    return {
      success: true,
      tokens: tokenData
    };
    
  } catch (error: any) {
    console.error('❌ [TOKEN_EXCHANGE] Token exchange error:', error);
    console.error('❌ [TOKEN_EXCHANGE] Error message:', error.message);
    console.error('❌ [TOKEN_EXCHANGE] Error stack:', error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Fetch Garmin user info to get user ID
 */
export async function fetchGarminUserInfo(accessToken: string) {
  const userInfoUrl = 'https://apis.garmin.com/wellness-api/rest/user/id';
  
  try {
    const response = await fetch(userInfoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Garmin user info fetch failed:', response.status, errorText);
      throw new Error(`User info fetch failed: ${response.status} - ${errorText}`);
    }
    
    const userData = await response.json();
    console.log('✅ User info received from Garmin');
    
    return {
      success: true,
      userData: userData
    };
    
  } catch (error: any) {
    console.error('❌ User info fetch error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

