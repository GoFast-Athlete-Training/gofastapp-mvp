import { createHash, randomBytes } from 'crypto';

export const INVITE_TOKEN_BYTES = 32;
export const INVITE_EXPIRY_DAYS = 30;

export function generateInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString('base64url');
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

export function getInviteExpiryDate(from = new Date()): Date {
  const expires = new Date(from);
  expires.setDate(expires.getDate() + INVITE_EXPIRY_DAYS);
  return expires;
}

export function buildClubOwnerInviteUrl(token: string, baseUrl?: string): string {
  const base =
    baseUrl ??
    process.env.NEXT_PUBLIC_GOFAST_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3001';
  return `${base.replace(/\/$/, '')}/clubowner/invite?token=${encodeURIComponent(token)}`;
}
