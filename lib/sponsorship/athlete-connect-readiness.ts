export type AthleteConnectSnapshot = {
  stripeConnectAccountId: string | null;
  stripeConnectChargesEnabled: boolean;
  stripeConnectPayoutsEnabled: boolean;
  stripeConnectDetailsSubmitted: boolean;
  stripeConnectRequirementsJson?: unknown;
};

export type AthleteConnectReadinessState =
  | "setup_required"
  | "verification_pending"
  | "action_required"
  | "payouts_ready";

export function isAthletePayoutReady(athlete: AthleteConnectSnapshot): boolean {
  return Boolean(
    athlete.stripeConnectAccountId &&
      athlete.stripeConnectChargesEnabled &&
      athlete.stripeConnectPayoutsEnabled &&
      athlete.stripeConnectDetailsSubmitted,
  );
}

export function describeAthleteConnectReadiness(athlete: AthleteConnectSnapshot): {
  state: AthleteConnectReadinessState;
  label: string;
  detail: string;
} {
  if (!athlete.stripeConnectAccountId) {
    return {
      state: "setup_required",
      label: "Set up payouts",
      detail:
        "Add your bank account and identity details so GoFast can route sponsorship payments to your Stripe balance.",
    };
  }

  const requirements = athlete.stripeConnectRequirementsJson as
    | { currently_due?: string[]; past_due?: string[]; disabled_reason?: string | null }
    | null
    | undefined;
  const due = [...(requirements?.currently_due ?? []), ...(requirements?.past_due ?? [])];

  if (isAthletePayoutReady(athlete)) {
    return {
      state: "payouts_ready",
      label: "Payouts ready",
      detail:
        "Your payout account is verified. Paid sponsorships credit your Stripe balance at checkout; Stripe pays your bank on its payout schedule.",
    };
  }

  if (due.length > 0 || requirements?.disabled_reason) {
    return {
      state: "action_required",
      label: "Action required",
      detail: "Stripe needs additional information before payouts can be enabled.",
    };
  }

  return {
    state: "verification_pending",
    label: "Verification pending",
    detail:
      "Stripe is reviewing your payout details. Paid sponsorship checkout stays blocked until verification completes.",
  };
}

export function connectRequirementsFromAccount(account: {
  requirements?: {
    currently_due?: string[] | null;
    past_due?: string[] | null;
    eventually_due?: string[] | null;
    disabled_reason?: string | null;
  } | null;
}) {
  return {
    currently_due: account.requirements?.currently_due ?? [],
    past_due: account.requirements?.past_due ?? [],
    eventually_due: account.requirements?.eventually_due ?? [],
    disabled_reason: account.requirements?.disabled_reason ?? null,
  };
}
