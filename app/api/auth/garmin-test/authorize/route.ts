export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { generatePKCE, buildGarminTestAuthUrl } from "@/lib/garmin-pkce";
import { cookies } from "next/headers";

/**
 * GET /api/auth/garmin-test/authorize?athleteId=xxx
 *
 * Starts OAuth with **test** Garmin app (GARMIN_TEST_CLIENT_ID).
 * Callback: /api/auth/garmin-test/callback — writes only garmin_test_* columns.
 */
export async function GET(request: Request) {
  try {
    if (!process.env.GARMIN_TEST_CLIENT_ID?.trim()) {
      return NextResponse.json(
        { error: "GARMIN_TEST_CLIENT_ID is not configured" },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const athleteId = url.searchParams.get("athleteId");
    const linkedEmailHint = url.searchParams.get("garminTestLinkedEmail")?.trim() || "";

    if (!athleteId) {
      return NextResponse.json({ error: "athleteId is required" }, { status: 400 });
    }

    const { codeVerifier, codeChallenge } = generatePKCE();

    const cookieStore = await cookies();
    const cookieOptions: Record<string, unknown> = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 600,
      path: "/",
    };

    if (process.env.NODE_ENV === "production") {
      cookieOptions.domain = ".gofastcrushgoals.com";
    }

    cookieStore.set(`garmin_test_code_verifier_${athleteId}`, codeVerifier, cookieOptions);

    if (linkedEmailHint) {
      cookieStore.set(
        `garmin_test_linked_email_hint_${athleteId}`,
        linkedEmailHint.slice(0, 320),
        cookieOptions
      );
    }

    let serverUrl =
      process.env.SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`;

    if (process.env.NODE_ENV === "production") {
      serverUrl = "https://pr.gofastcrushgoals.com";
    } else if (!serverUrl) {
      return NextResponse.json({ error: "Server URL not configured" }, { status: 500 });
    }

    const redirectUri = `${serverUrl}/api/auth/garmin-test/callback`;
    const authUrl = buildGarminTestAuthUrl(codeChallenge, athleteId, redirectUri);

    return NextResponse.json({ success: true, authUrl });
  } catch (error: unknown) {
    console.error("Garmin test authorize error:", error);
    return NextResponse.json({ error: "Failed to initiate Garmin test OAuth" }, { status: 500 });
  }
}
