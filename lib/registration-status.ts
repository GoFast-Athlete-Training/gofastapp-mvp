/**
 * Derived registration CTA state from organizer fields.
 */

import { isRegistrationDeadlinePastUtc } from "./registration-deadline";

export type RegistrationCtaFields = {
  registrationUrl?: string | null;
  registrationCloseDate?: string | Date | null;
  registrationSoldOut?: boolean | null;
};

export function isRegistrationOrganizerCtaOpen(
  reg: RegistrationCtaFields | null | undefined
): boolean {
  if (!reg?.registrationUrl?.trim()) return false;
  if (reg.registrationSoldOut === true) return false;
  if (isRegistrationDeadlinePastUtc(reg.registrationCloseDate)) return false;
  return true;
}

export function registrationOrganizerStatusLabel(
  reg: RegistrationCtaFields | null | undefined
): string | null {
  if (!reg?.registrationUrl?.trim()) return null;
  if (reg.registrationSoldOut === true) return "Registration sold out";
  if (isRegistrationDeadlinePastUtc(reg.registrationCloseDate)) {
    return "Registration closed";
  }
  return null;
}

export function isTransferWindowOpen(
  transferDeadline: string | Date | null | undefined
): boolean {
  if (transferDeadline == null) return false;
  return !isRegistrationDeadlinePastUtc(transferDeadline);
}
