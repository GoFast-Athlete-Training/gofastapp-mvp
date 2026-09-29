import { NextRequest, NextResponse } from "next/server";
import { forwardToCompany } from "@/lib/runmanage/company-forward";

export const dynamic = "force-dynamic";

/**
 * POST /api/runmanage/staff/bootstrap
 * Invite-only staff resolution via Company find-or-create (Firebase Bearer only).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const res = await forwardToCompany(request, "/api/staff/find-or-create", {
      method: "POST",
      body: "{}",
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("POST /api/runmanage/staff/bootstrap:", err);
    return NextResponse.json(
      { success: false, error: "Failed to bootstrap staff", details: e?.message },
      { status: 500 }
    );
  }
}
