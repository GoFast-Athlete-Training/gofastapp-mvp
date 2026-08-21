export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { syncConnectAccountFromStripe } from "@/lib/sponsorship/athlete-stripe-connect-service";
import Stripe from "stripe";

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
}

/** POST /api/stripe/connect/webhook — athlete Express account.updated sync */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim();

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_CONNECT_WEBHOOK_SECRET is not configured" }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Signature verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    await syncConnectAccountFromStripe(account);
  }

  return NextResponse.json({ received: true, eventType: event.type });
}
