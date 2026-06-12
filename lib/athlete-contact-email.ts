/** Apple Hide My Email relay addresses are not usable for outbound contact. */
export function isApplePrivateRelayEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  return email.trim().toLowerCase().includes('privaterelay.appleid.com');
}

export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** True when we can safely send transactional email to this address. */
export function isExternallyContactableEmail(email: string | null | undefined): boolean {
  const trimmed = email?.trim();
  if (!trimmed) return false;
  if (!isValidEmailFormat(trimmed)) return false;
  if (isApplePrivateRelayEmail(trimmed)) return false;
  return true;
}

export type EmailContactability = 'contactable' | 'apple_relay' | 'missing' | 'invalid';

export function emailContactability(email: string | null | undefined): EmailContactability {
  const trimmed = email?.trim();
  if (!trimmed) return 'missing';
  if (isApplePrivateRelayEmail(trimmed)) return 'apple_relay';
  if (!isValidEmailFormat(trimmed)) return 'invalid';
  return 'contactable';
}

/** Strip relay/invalid values for profile form defaults and saves. */
export function sanitizeContactEmailForStorage(
  email: string | null | undefined
): string | null {
  const trimmed = email?.trim();
  if (!trimmed) return null;
  if (!isExternallyContactableEmail(trimmed)) return null;
  return trimmed;
}
