export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertRunManageAuth } from "@/lib/runmanage/require-run-manage-auth";
import { getGoFastContentApiBase } from "@/lib/content/athlete-link-tree-client";

/** Proxy Content Studio featured-run drafts for this city run id (staff Bearer). */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> }
) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { runId } = await context.params;
  const id = runId?.trim();
  if (!id) {
    return NextResponse.json({ success: false, error: "runId required" }, { status: 400 });
  }

  const base = getGoFastContentApiBase();
  if (!base) {
    return NextResponse.json({ success: true, configured: false, hasDraft: false });
  }

  const bearer = request.headers.get("authorization");
  if (!bearer?.trim()) {
    return NextResponse.json({ success: false, error: "Authorization required" }, { status: 401 });
  }

  try {
    const url = `${base}/api/featured-runs/drafts?runId=${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      headers: { Authorization: bearer },
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      drafts?: unknown[];
      posts?: unknown[];
      error?: string;
    };
    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          configured: true,
          hasDraft: false,
          error: data.error || `Content API ${res.status}`,
        },
        { status: res.status === 401 || res.status === 403 ? res.status : 502 }
      );
    }
    const list = Array.isArray(data.drafts) ? data.drafts : Array.isArray(data.posts) ? data.posts : [];
    return NextResponse.json({
      success: true,
      configured: true,
      hasDraft: list.length > 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Content API request failed";
    return NextResponse.json({ success: false, configured: true, hasDraft: false, error: message }, { status: 502 });
  }
}
