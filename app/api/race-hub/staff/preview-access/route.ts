export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { forwardToCompany } from "@/lib/runmanage/company-forward";

/** Firebase-only gate: is this user Company staff? Used for read-only race hub preview. */
export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const res = await forwardToCompany(request, "/api/staff/find-or-create", {
      method: "POST",
      body: "{}",
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      staff?: { id?: string; email?: string | null; name?: string | null };
      error?: string;
    };

    if (!res.ok || !data.success || !data.staff?.id) {
      return NextResponse.json(
        { success: false, error: data.error ?? "Not company staff" },
        { status: res.status === 200 ? 403 : res.status },
      );
    }

    return NextResponse.json({
      success: true,
      staff: {
        id: data.staff.id,
        email: data.staff.email ?? null,
        name: data.staff.name ?? null,
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/race-hub/staff/preview-access:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
