import crypto from "crypto";
import OAuth from "oauth-1.0a";

export interface GarminOAuthHeaderParams {
  method: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
  body?: unknown;
}

export interface GarminOAuth1Config {
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
}

function normalizeBodyForSigning(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }
  return body as Record<string, unknown>;
}

/**
 * Generate OAuth 1.0a Authorization header for Garmin Training API calls.
 */
export function generateGarminOAuthHeader({
  method,
  url,
  consumerKey,
  consumerSecret,
  token,
  tokenSecret,
  body,
}: GarminOAuthHeaderParams): string {
  const oauth = new OAuth({
    consumer: {
      key: consumerKey,
      secret: consumerSecret,
    },
    signature_method: "HMAC-SHA1",
    hash_function(baseString, key) {
      return crypto.createHmac("sha1", key).update(baseString).digest("base64");
    },
  });

  const requestData = {
    url,
    method: method.toUpperCase(),
    data: normalizeBodyForSigning(body),
  };

  const auth = oauth.authorize(requestData, {
    key: token,
    secret: tokenSecret,
  });

  return oauth.toHeader(auth).Authorization;
}
