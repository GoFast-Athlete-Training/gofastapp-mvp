import { contentAthleteLinkTreeFetch } from "@/lib/content/athlete-link-tree-client";
import type { AthleteLinkTreeDetail } from "@/lib/content/athlete-link-tree-types";
import { requireAthleteWithHandleForLinks } from "@/lib/content/require-athlete-link-tree";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ linkId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const { linkId } = await context.params;
  const body = await request.json();
  const res = await contentAthleteLinkTreeFetch(
    gate.athlete.id,
    `/links/${encodeURIComponent(linkId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  const data = (await res.json()) as {
    success?: boolean;
    tree?: AthleteLinkTreeDetail;
    error?: string;
  };

  if (!res.ok || !data.success || !data.tree) {
    return NextResponse.json(
      { success: false, error: data.error || "Failed to save link" },
      { status: res.status >= 400 ? res.status : 502 },
    );
  }

  return NextResponse.json({ success: true, tree: data.tree });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const { linkId } = await context.params;
  const res = await contentAthleteLinkTreeFetch(
    gate.athlete.id,
    `/links/${encodeURIComponent(linkId)}`,
    { method: "DELETE" },
  );
  const data = (await res.json()) as {
    success?: boolean;
    tree?: AthleteLinkTreeDetail;
    error?: string;
  };

  if (!res.ok || !data.success || !data.tree) {
    return NextResponse.json(
      { success: false, error: data.error || "Failed to delete link" },
      { status: res.status >= 400 ? res.status : 502 },
    );
  }

  return NextResponse.json({ success: true, tree: data.tree });
}
