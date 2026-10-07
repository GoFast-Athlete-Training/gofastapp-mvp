import { contentAthleteLinkTreeFetch } from "@/lib/content/athlete-link-tree-client";
import type { AthleteLinkTreeDetail } from "@/lib/content/athlete-link-tree-types";
import { requireAthleteWithHandleForLinks } from "@/lib/content/require-athlete-link-tree";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ linkId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const { linkId } = await context.params;
  const incoming = await request.formData();
  const file = incoming.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Choose an image file" }, { status: 400 });
  }

  const outbound = new FormData();
  outbound.append("file", file);

  const res = await contentAthleteLinkTreeFetch(
    gate.athlete.id,
    `/links/${encodeURIComponent(linkId)}/image`,
    { method: "POST", body: outbound, headers: {} },
  );

  const data = (await res.json()) as {
    success?: boolean;
    tree?: AthleteLinkTreeDetail;
    error?: string;
  };

  if (!res.ok || !data.success || !data.tree) {
    return NextResponse.json(
      { success: false, error: data.error || "Failed to upload image" },
      { status: res.status >= 400 ? res.status : 502 },
    );
  }

  return NextResponse.json({ success: true, tree: data.tree });
}
