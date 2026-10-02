export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertRunManageAuth } from "@/lib/runmanage/require-run-manage-auth";

/** GET /api/runmanage/run-clubs/search?q= */
export async function GET(request: NextRequest) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ success: false, error: "q must be at least 2 characters" }, { status: 400 });
  }

  const clubs = await prisma.run_clubs.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, slug: true, logoUrl: true, city: true },
    take: 20,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ success: true, clubs });
}
