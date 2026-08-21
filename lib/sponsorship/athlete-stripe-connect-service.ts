import { prisma } from "@/lib/prisma";
import {
  connectRequirementsFromAccount,
  describeAthleteConnectReadiness,
  isAthletePayoutReady,
  type AthleteConnectSnapshot,
} from "@/lib/sponsorship/athlete-connect-readiness";
import type { Athlete } from "@prisma/client";
import Stripe from "stripe";

type AthleteConnectStatusSource = AthleteConnectSnapshot & {
  stripeConnectOnboardedAt: Date | null;
};

/** Prisma select for routes that hydrate connect readiness without loading full Athlete rows. */
export const athleteConnectStatusSelect = {
  stripeConnectAccountId: true,
  stripeConnectChargesEnabled: true,
  stripeConnectPayoutsEnabled: true,
  stripeConnectDetailsSubmitted: true,
  stripeConnectRequirementsJson: true,
  stripeConnectOnboardedAt: true,
} as const;

export type { AthleteConnectStatusSource };

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
}

export class AthletePayoutSetupRequiredError extends Error {
  constructor(message = "Athlete payout setup is required before paid sponsorship checkout") {
    super(message);
    this.name = "AthletePayoutSetupRequiredError";
  }
}

function athleteConnectSnapshot(athlete: AthleteConnectSnapshot): AthleteConnectSnapshot {
  return {
    stripeConnectAccountId: athlete.stripeConnectAccountId,
    stripeConnectChargesEnabled: athlete.stripeConnectChargesEnabled,
    stripeConnectPayoutsEnabled: athlete.stripeConnectPayoutsEnabled,
    stripeConnectDetailsSubmitted: athlete.stripeConnectDetailsSubmitted,
    stripeConnectRequirementsJson: athlete.stripeConnectRequirementsJson,
  };
}

export async function applyConnectAccountToAthlete(
  athleteId: string,
  account: {
    id: string;
    charges_enabled?: boolean | null;
    payouts_enabled?: boolean | null;
    details_submitted?: boolean | null;
    requirements?: {
      currently_due?: string[] | null;
      past_due?: string[] | null;
      eventually_due?: string[] | null;
      disabled_reason?: string | null;
    } | null;
  },
): Promise<Athlete> {
  const existing = await prisma.athlete.findUnique({ where: { id: athleteId } });
  const onboardedAt =
    account.details_submitted && account.charges_enabled
      ? existing?.stripeConnectOnboardedAt ?? new Date()
      : existing?.stripeConnectOnboardedAt ?? undefined;

  return prisma.athlete.update({
    where: { id: athleteId },
    data: {
      stripeConnectAccountId: account.id,
      stripeConnectChargesEnabled: account.charges_enabled ?? false,
      stripeConnectPayoutsEnabled: account.payouts_enabled ?? false,
      stripeConnectDetailsSubmitted: account.details_submitted ?? false,
      stripeConnectRequirementsJson: connectRequirementsFromAccount(account),
      ...(onboardedAt ? { stripeConnectOnboardedAt: onboardedAt } : {}),
    },
  });
}

export async function syncConnectAccountFromStripe(account: {
  id: string;
  metadata?: { athlete_id?: string } | null;
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
  requirements?: {
    currently_due?: string[] | null;
    past_due?: string[] | null;
    eventually_due?: string[] | null;
    disabled_reason?: string | null;
  } | null;
}): Promise<Athlete | null> {
  const metadataAthleteId = account.metadata?.athlete_id?.trim() ?? "";
  const athlete = metadataAthleteId
    ? await prisma.athlete.findUnique({ where: { id: metadataAthleteId } })
    : await prisma.athlete.findFirst({
        where: { stripeConnectAccountId: account.id },
      });

  if (!athlete) return null;
  return applyConnectAccountToAthlete(athlete.id, account);
}

export async function getOrCreateAthleteConnectAccount(input: {
  athlete: Athlete;
}): Promise<{ athlete: Athlete; accountId: string }> {
  const stripe = getStripe();
  const athlete = input.athlete;

  if (athlete.stripeConnectAccountId) {
    const account = await stripe.accounts.retrieve(athlete.stripeConnectAccountId);
    const synced = await applyConnectAccountToAthlete(athlete.id, account);
    return { athlete: synced, accountId: account.id };
  }

  const account = await stripe.accounts.create({
    type: "express",
    country: "US",
    email: athlete.email ?? undefined,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: {
      athlete_id: athlete.id,
    },
  });

  const updated = await applyConnectAccountToAthlete(athlete.id, account);
  return { athlete: updated, accountId: account.id };
}

export async function createAthleteConnectAccountSession(input: {
  accountId: string;
  mode?: "onboarding" | "management";
}): Promise<string> {
  const stripe = getStripe();
  const isManagement = input.mode === "management";

  const session = await stripe.accountSessions.create({
    account: input.accountId,
    components: isManagement
      ? {
          account_management: { enabled: true },
          payouts: { enabled: true },
        }
      : {
          account_onboarding: { enabled: true },
        },
  });

  if (!session.client_secret) {
    throw new Error("Stripe did not return an account session client secret");
  }
  return session.client_secret;
}

export async function getAthleteConnectStatus(athlete: AthleteConnectStatusSource | null) {
  if (!athlete) {
    return {
      ready: false,
      state: "setup_required" as const,
      label: "Athlete required",
      detail: "Sign in as an athlete before setting up payouts.",
      accountId: null,
    };
  }

  const readiness = describeAthleteConnectReadiness(athleteConnectSnapshot(athlete));
  return {
    ready: isAthletePayoutReady(athleteConnectSnapshot(athlete)),
    ...readiness,
    accountId: athlete.stripeConnectAccountId,
    chargesEnabled: athlete.stripeConnectChargesEnabled,
    payoutsEnabled: athlete.stripeConnectPayoutsEnabled,
    detailsSubmitted: athlete.stripeConnectDetailsSubmitted,
    onboardedAt: athlete.stripeConnectOnboardedAt?.toISOString() ?? null,
  };
}

export async function requireAthletePayoutDestination(athleteId: string): Promise<string> {
  const athlete = await prisma.athlete.findUnique({ where: { id: athleteId } });
  if (!athlete || !isAthletePayoutReady(athleteConnectSnapshot(athlete))) {
    throw new AthletePayoutSetupRequiredError();
  }
  return athlete.stripeConnectAccountId!;
}
