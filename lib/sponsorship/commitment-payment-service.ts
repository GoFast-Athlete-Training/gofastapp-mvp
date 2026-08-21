import { prisma } from "@/lib/prisma";
import { SponsorCommitmentPaymentLifecycle } from "@prisma/client";

export type CreateCommitmentPaymentInput = {
  sponsorCommitmentId: string;
  stripeBrandCustomerId?: string | null;
  stripeConnectAccountId: string;
  grossAmountCents: number;
  athleteShareCents: number;
  platformShareCents: number;
  currency?: string;
  payoutConfigKey: string;
  payoutConfigVersion: number;
  athleteSharePercent: number;
  platformSharePercent: number;
  stripeCheckoutSessionId?: string | null;
};

export async function createCheckoutPendingPayment(input: CreateCommitmentPaymentInput) {
  return prisma.sponsor_commitment_payments.create({
    data: {
      sponsorCommitmentId: input.sponsorCommitmentId,
      stripeBrandCustomerId: input.stripeBrandCustomerId ?? null,
      stripeConnectAccountId: input.stripeConnectAccountId,
      grossAmountCents: input.grossAmountCents,
      athleteShareCents: input.athleteShareCents,
      platformShareCents: input.platformShareCents,
      currency: input.currency ?? "usd",
      payoutConfigKey: input.payoutConfigKey,
      payoutConfigVersion: input.payoutConfigVersion,
      athleteSharePercent: input.athleteSharePercent,
      platformSharePercent: input.platformSharePercent,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
      lifecycle: SponsorCommitmentPaymentLifecycle.CHECKOUT_PENDING,
    },
  });
}

export async function attachCheckoutSessionToPayment(
  sponsorCommitmentId: string,
  stripeCheckoutSessionId: string,
) {
  const payment = await prisma.sponsor_commitment_payments.findFirst({
    where: { sponsorCommitmentId },
    orderBy: [{ createdAt: "desc" }],
  });
  if (!payment) {
    throw new Error("Commitment payment record not found");
  }

  return prisma.sponsor_commitment_payments.update({
    where: { id: payment.id },
    data: {
      stripeCheckoutSessionId,
      updatedAt: new Date(),
    },
  });
}

export type FinalizeCommitmentPaymentInput = {
  sponsorCommitmentId: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  stripeTransferId?: string | null;
  stripeApplicationFeeId?: string | null;
  stripeProcessingFeeCents?: number | null;
  paidAt?: Date;
  transferredAt?: Date | null;
};

export async function finalizeCommitmentPayment(input: FinalizeCommitmentPaymentInput) {
  const payment = await prisma.sponsor_commitment_payments.findFirst({
    where: {
      sponsorCommitmentId: input.sponsorCommitmentId,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  if (!payment) {
    throw new Error("Commitment payment record not found");
  }

  const paidAt = input.paidAt ?? new Date();
  const lifecycle =
    input.stripeTransferId != null
      ? SponsorCommitmentPaymentLifecycle.TRANSFERRED
      : SponsorCommitmentPaymentLifecycle.PAID;

  return prisma.sponsor_commitment_payments.update({
    where: { id: payment.id },
    data: {
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      stripePaymentIntentId: input.stripePaymentIntentId ?? undefined,
      stripeChargeId: input.stripeChargeId ?? undefined,
      stripeTransferId: input.stripeTransferId ?? undefined,
      stripeApplicationFeeId: input.stripeApplicationFeeId ?? undefined,
      stripeProcessingFeeCents: input.stripeProcessingFeeCents ?? undefined,
      lifecycle,
      paidAt,
      transferredAt: input.transferredAt ?? (input.stripeTransferId ? paidAt : null),
      updatedAt: new Date(),
    },
  });
}

export async function getLatestCommitmentPayment(sponsorCommitmentId: string) {
  return prisma.sponsor_commitment_payments.findFirst({
    where: { sponsorCommitmentId },
    orderBy: [{ createdAt: "desc" }],
  });
}
