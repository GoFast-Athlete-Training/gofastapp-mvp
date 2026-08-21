export const dynamic = "force-dynamic";

import {
  CompanyFinanceProjectionError,
} from "@/lib/sponsorship/company-finance-projection-client";
import {
  handleBrandPartnershipChargeRefunded,
  handleBrandPartnershipCheckoutCompleted,
  StripeWebhookValidationError,
} from "@/lib/sponsorship/stripe-webhook-service";
import { NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }
  return new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
}

/** POST /api/stripe/webhook — Prod authoritative Brand Partnership checkout completion */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured" }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Signature verification failed";
    console.error("STRIPE WEBHOOK: signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const result = await handleBrandPartnershipCheckoutCompleted(event, session);

      return NextResponse.json({
        received: true,
        handled: result.handled,
        newlyActivated: result.newlyActivated,
      });
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const result = await handleBrandPartnershipChargeRefunded(event, charge);
      return NextResponse.json({ received: true, handled: result.handled, eventType: event.type });
    }

    return NextResponse.json({ received: true, ignored: true, eventType: event.type });
  } catch (error: unknown) {
    if (error instanceof StripeWebhookValidationError) {
      console.warn("STRIPE WEBHOOK: validation failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof CompanyFinanceProjectionError) {
      console.error("STRIPE WEBHOOK: finance projection failed:", error.message);
      return NextResponse.json(
        { error: error.message, retryable: error.retryable },
        { status: error.retryable ? 500 : 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Webhook processing failed";
    console.error("STRIPE WEBHOOK:", error);
    return NextResponse.json({ error: message, retryable: true }, { status: 500 });
  }
}
