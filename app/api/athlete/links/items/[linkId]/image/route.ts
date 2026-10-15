import { put } from "@vercel/blob";
import {
  loadEditableAthleteTree,
  reloadAthleteLinkTreeDetail,
} from "@/lib/athlete-link-tree/athlete-link-tree-service";
import { isHydratedLinkKind } from "@/lib/athlete-link-tree/link-kinds";
import { requireAthleteWithHandleForLinks } from "@/lib/content/require-athlete-link-tree";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

type RouteContext = { params: Promise<{ linkId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { success: false, error: "Image upload is not configured on this deployment" },
      { status: 500 },
    );
  }

  const { linkId } = await context.params;
  const loaded = await loadEditableAthleteTree(gate.athlete.id);
  if (!loaded.ok) {
    return NextResponse.json({ success: false, error: loaded.error }, { status: loaded.status });
  }
  const treeId = loaded.tree.id;

  const link = await prisma.athlete_link_tree_links.findFirst({
    where: { id: linkId, treeId },
  });
  if (!link) {
    return NextResponse.json({ success: false, error: "Link not found" }, { status: 404 });
  }
  if (isHydratedLinkKind(link.kind)) {
    return NextResponse.json(
      { success: false, error: "GoFast cards use auto-filled images" },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Choose an image file" }, { status: 400 });
  }

  const ext = ALLOWED.get(file.type);
  if (!ext) {
    return NextResponse.json(
      { success: false, error: "Image must be JPG, PNG, or WebP" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ success: false, error: "Image must be 5MB or smaller" }, { status: 400 });
  }

  const blob = await put(
    `athlete-link-trees/${treeId}/${linkId}/${crypto.randomUUID()}.${ext}`,
    file,
    { access: "public", token },
  );

  await prisma.athlete_link_tree_links.update({
    where: { id: linkId },
    data: { linkLogoUrl: blob.url, emoji: null },
  });

  const tree = await reloadAthleteLinkTreeDetail(gate.athlete.id);
  if (!tree) {
    return NextResponse.json({ success: false, error: "Link tree not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, linkLogoUrl: blob.url, tree });
}
