import { contentAthleteLinkTreeFetch } from "@/lib/content/athlete-link-tree-client";
import type { AthleteLinkTreeDetail } from "@/lib/content/athlete-link-tree-types";
import { requireAthleteWithHandleForLinks } from "@/lib/content/require-athlete-link-tree";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** POST — add link or section */
export async function POST(request: NextRequest) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const body = await request.json();
  const res = await contentAthleteLinkTreeFetch(gate.athlete.id, "/links", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    success?: boolean;
    tree?: AthleteLinkTreeDetail;
    linkId?: string;
    error?: string;
  };

  if (!res.ok || !data.success || !data.tree) {
    return NextResponse.json(
      { success: false, error: data.error || "Failed to add link" },
      { status: res.status >= 400 ? res.status : 502 },
    );
  }

  return NextResponse.json(
    { success: true, tree: data.tree, linkId: data.linkId },
    { status: 201 },
  );
}
