import { contentAthleteLinkTreeFetch } from "@/lib/content/athlete-link-tree-client";
import { athleteLinksPublicUrl } from "@/lib/content/athlete-links-public-url";
import type { AthleteLinkTreeDetail } from "@/lib/content/athlete-link-tree-types";
import { requireAthleteWithHandleForLinks } from "@/lib/content/require-athlete-link-tree";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function parseTreeResponse(res: Response) {
  const data = (await res.json()) as {
    success?: boolean;
    tree?: AthleteLinkTreeDetail;
    error?: string;
  };
  return { res, data };
}

/** GET — load athlete link tree (create on first visit) */
export async function GET(request: NextRequest) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  let res = await contentAthleteLinkTreeFetch(gate.athlete.id, "", { method: "GET" });
  let { data } = await parseTreeResponse(res);

  if (res.status === 404) {
    res = await contentAthleteLinkTreeFetch(gate.athlete.id, "", {
      method: "POST",
      body: JSON.stringify({ slug: gate.slug, name: gate.displayName }),
    });
    ({ data } = await parseTreeResponse(res));
  }

  if (!res.ok || !data.success || !data.tree) {
    return NextResponse.json(
      { success: false, error: data.error || "Failed to load link page" },
      { status: res.status >= 400 ? res.status : 502 },
    );
  }

  return NextResponse.json({
    success: true,
    tree: data.tree,
    handle: gate.handle,
    shareUrl: athleteLinksPublicUrl(gate.handle),
  });
}

/** PATCH — tree metadata */
export async function PATCH(request: NextRequest) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const body = await request.json();
  const res = await contentAthleteLinkTreeFetch(gate.athlete.id, "", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const { data } = await parseTreeResponse(res);

  if (!res.ok || !data.success || !data.tree) {
    return NextResponse.json(
      { success: false, error: data.error || "Failed to save" },
      { status: res.status >= 400 ? res.status : 502 },
    );
  }

  return NextResponse.json({ success: true, tree: data.tree });
}
