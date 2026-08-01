import {
  projectPaidSponsorshipToCompany,
} from "@/lib/sponsorship/company-finance-projection-client";
import {
  finalizePaidCommitment,
  getCommitmentById,
} from "@/lib/sponsorship/commitment-service";
import { SponsorCommitmentPaymentStatus, type sponsor_commitments } from "@prisma/client";
import type Stripe from "stripe";

export class StripeWebhookValidationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "StripeWebhookValidationError";
    this.status = status;
  }
}

export function isBrandPartnershipCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.metadata?.type === "brand_partnership";
}

export function validateBrandPartnershipCheckoutSession(
  session: Stripe.Checkout.Session,
): string {
  if (!isBrandPartnershipCheckoutSession(session)) {
    throw new StripeWebhookValidationError("Not a brand partnership checkout session");
  }

  if (session.payment_status !== "paid") {
    throw new StripeWebhookValidationError("Checkout session is not paid");
  }

  const sponsorCommitmentId = session.metadata?.sponsorCommitmentId?.trim();
  if (!sponsorCommitmentId) {
    throw new StripeWebhookValidationError("Missing sponsorCommitmentId metadata");
  }

  return sponsorCommitmentId;
}

export function validateCommitmentAgainstCheckoutSession(
  commitment: sponsor_commitments,
  session: Stripe.Checkout.Session,
): void {
  const amountPaidCents = session.amount_total ?? 0;
  const sessionCurrency = (session.currency ?? "usd").toLowerCase();
  const commitmentCurrency = commitment.currency.toLowerCase();

  if (
    commitment.stripeCheckoutSessionId &&
    commitment.stripeCheckoutSessionId !== session.id
  ) {
    throw new StripeWebhookValidationError("Checkout session id mismatch");
  }

  if (commitment.quotedAmountCents !== amountPaidCents) {
    throw new StripeWebhookValidationError("Paid amount does not match quoted amount");
  }

  if (commitmentCurrency !== sessionCurrency) {
    throw new StripeWebhookValidationError("Paid currency does not match quoted currency");
  }

  const allowedStatuses = new Set<SponsorCommitmentPaymentStatus>([
    SponsorCommitmentPaymentStatus.CHECKOUT_PENDING,
    SponsorCommitmentPaymentStatus.PAID,
  ]);

  if (!allowedStatuses.has(commitment.paymentStatus)) {
    throw new StripeWebhookValidationError(
      `Commitment payment status ${commitment.paymentStatus} cannot be finalized`,
    );
  }
}

function resolvePaymentIntentId(session: Stripe.Checkout.Session): string | null {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  return session.payment_intent?.id ?? null;
}

export type BrandPartnershipCheckoutResult = {
  handled: boolean;
  newlyActivated: boolean;
  sponsorCommitmentId?: string;
};

export async function handleBrandPartnershipCheckoutCompleted(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
): Promise<BrandPartnershipCheckoutResult> {
  if (!isBrandPartnershipCheckoutSession(session)) {
    return { handled: false, newlyActivated: false };
  }

  const sponsorCommitmentId = validateBrandPartnershipCheckoutSession(session);
  const commitment = await getCommitmentById(sponsorCommitmentId);
  if (!commitment) {
    throw new StripeWebhookValidationError("Commitment not found", 404);
  }

  validateCommitmentAgainstCheckoutSession(commitment, session);

  const amountPaidCents = session.amount_total ?? 0;
  const { commitment: activatedCommitment, newlyActivated } = await finalizePaidCommitment({
    commitmentId: sponsorCommitmentId,
    amountPaidCents,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: resolvePaymentIntentId(session),
    paidAt: new Date(),
  });

  const athleteId = session.metadata?.athleteId?.trim();
  if (!athleteId) {
    throw new StripeWebhookValidationError("Missing athleteId metadata");
  }

  await projectPaidSponsorshipToCompany(event.id);

  return {
    handled: true,
    newlyActivated,
    sponsorCommitmentId,
  };
}
