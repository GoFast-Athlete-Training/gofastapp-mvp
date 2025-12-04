import crypto from 'crypto';

/**
 * Generate PKCE code verifier and challenge for Garmin OAuth 2.0
 */
export function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('hex');
  
  return {
    codeVerifier,
    codeChallenge,
    state
  };
}

/**
 * Build Garmin authorization URL with PKCE parameters
 */
export function buildGarminAuthUrl(codeChallenge: string, state: string, redirectUri: string) {
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
    state: state,
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
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Garmin token exchange failed:', response.status, errorText);
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
    }
    
    const tokenData = await response.json();
    console.log('✅ Tokens received from Garmin');
    
    return {
      success: true,
      tokens: tokenData
    };
    
  } catch (error: any) {
    console.error('❌ Token exchange error:', error);
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

