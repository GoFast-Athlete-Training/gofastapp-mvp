export const dynamic = 'force-dynamic';

import { waitUntil } from '@vercel/functions';
import { processGarminHealthWebhook } from '@/lib/garmin-events/process-health-webhook';

function readRawBody(request: Request): Promise<string> {
  return request.text().catch(() => '');
}

/**
 * GET /api/garmin/health-webhook — endpoint verification (Garmin portal / PING probes).
 * Returns OK without processing payload data.
 */
export async function GET() {
  return new Response('OK', { status: 200 });
}

/**
 * POST /api/garmin/health-webhook — Garmin Health API (sleeps, dailies).
 * Register this URL in Garmin Developer Portal for Health endpoints only.
 */
export async function POST(request: Request) {
  console.log('📩 Garmin health webhook POST received', {
    timestamp: new Date().toISOString(),
    contentType: request.headers.get('content-type') ?? 'none',
  });

  const rawText = await readRawBody(request);
  waitUntil(processGarminHealthWebhook(rawText));
  return new Response('OK', { status: 200 });
}

/**
 * PUT /api/garmin/health-webhook — same as POST (Garmin may use PUT).
 */
export async function PUT(request: Request) {
  console.log('📩 Garmin health webhook PUT received', {
    timestamp: new Date().toISOString(),
    contentType: request.headers.get('content-type') ?? 'none',
  });

  const rawText = await readRawBody(request);
  waitUntil(processGarminHealthWebhook(rawText));
  return new Response('OK', { status: 200 });
}
