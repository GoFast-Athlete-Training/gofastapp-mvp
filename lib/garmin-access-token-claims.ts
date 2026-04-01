/**
 * Decode Garmin OAuth access token JWT payload for observability only.
 * Does not verify signature — same as manual jwt.io inspection.
 */

export type GarminAccessTokenClaims = {
  client_id?: string;
  scope?: string[] | string;
  exp?: number;
  iat?: number;
  iss?: string;
  garmin_guid?: string;
  client_type?: string;
  managed_status?: string;
  jti?: string;
};

/**
 * Returns parsed payload claims, or null if the string is not a three-part JWT.
 */
export function decodeGarminAccessTokenClaims(
  accessToken: string | null | undefined
): GarminAccessTokenClaims | null {
  if (!accessToken || typeof accessToken !== "string") return null;
  const parts = accessToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json) as GarminAccessTokenClaims;
  } catch {
    return null;
  }
}

/**
 * Safe summary for logs / API debug payloads (no raw token).
 */
export function summarizeGarminTokenForLogs(
  accessToken: string | null | undefined
): Record<string, unknown> | null {
  const claims = decodeGarminAccessTokenClaims(accessToken);
  if (!claims) return null;
  const envClientId = process.env.GARMIN_CLIENT_ID?.trim();
  const tokenClientId =
    typeof claims.client_id === "string" ? claims.client_id : undefined;
  return {
    client_id: tokenClientId,
    client_id_matches_env:
      envClientId && tokenClientId ? envClientId === tokenClientId : undefined,
    scope: claims.scope,
    exp: claims.exp,
    iat: claims.iat,
    iss: claims.iss,
  };
}
