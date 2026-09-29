import { NextRequest, NextResponse } from "next/server";
import { forwardToCompany } from "@/lib/runmanage/company-forward";

export const dynamic = "force-dynamic";

/**
 * GET /api/runmanage/staff/me
 * Prod gate: verify Firebase on Company and return staff cockpit role (no browser call to HQ).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const res = await forwardToCompany(request, "/api/staff/me", { method: "GET" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: data.error ?? "Unauthorized" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("GET /api/runmanage/staff/me:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load staff", details: e?.message },
      { status: 500 }
    );
  }
}
