import Stripe from "stripe";

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
}

export type PaymentIntentDetails = {
  paymentIntentId: string | null;
  chargeId: string | null;
  transferId: string | null;
  applicationFeeId: string | null;
  processingFeeCents: number | null;
};

export async function loadPaymentIntentDetails(
  paymentIntentId: string | null,
): Promise<PaymentIntentDetails> {
  if (!paymentIntentId) {
    return {
      paymentIntentId: null,
      chargeId: null,
      transferId: null,
      applicationFeeId: null,
      processingFeeCents: null,
    };
  }

  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  });

  const latestCharge = paymentIntent.latest_charge;
  const charge =
    typeof latestCharge === "string"
      ? await stripe.charges.retrieve(latestCharge, {
          expand: ["balance_transaction", "transfer", "application_fee"],
        })
      : latestCharge;

  const chargeId = charge && typeof charge !== "string" ? charge.id : null;

  const balanceTransaction =
    charge && typeof charge !== "string" ? charge.balance_transaction : null;
  const processingFeeCents =
    balanceTransaction && typeof balanceTransaction !== "string"
      ? (balanceTransaction.fee ?? null)
      : null;

  let transferId: string | null = null;
  if (charge && typeof charge !== "string") {
    const chargeTransfer = (charge as Stripe.Charge & { transfer?: string | Stripe.Transfer | null })
      .transfer;
    transferId =
      typeof chargeTransfer === "string" ? chargeTransfer : (chargeTransfer?.id ?? null);
  }

  let applicationFeeId: string | null = null;
  if (charge && typeof charge !== "string") {
    const chargeApplicationFee = (
      charge as Stripe.Charge & { application_fee?: string | Stripe.ApplicationFee | null }
    ).application_fee;
    applicationFeeId =
      typeof chargeApplicationFee === "string"
        ? chargeApplicationFee
        : (chargeApplicationFee?.id ?? null);
  }

  if (!applicationFeeId) {
    const applicationFee = (
      paymentIntent as Stripe.PaymentIntent & {
        application_fee?: string | Stripe.ApplicationFee | null;
      }
    ).application_fee;
    applicationFeeId =
      typeof applicationFee === "string" ? applicationFee : (applicationFee?.id ?? null);
  }

  return {
    paymentIntentId,
    chargeId,
    transferId,
    applicationFeeId,
    processingFeeCents,
  };
}
