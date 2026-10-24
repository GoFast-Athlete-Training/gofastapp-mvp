export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertRunManageAuth } from "@/lib/runmanage/require-run-manage-auth";
import { isStoreTypeValue } from "@/lib/store-type";

/** GET /api/runmanage/run-stores/search?q= */
export async function GET(request: NextRequest) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ success: false, error: "q must be at least 2 characters" }, { status: 400 });
  }

  const storeTypeRaw = request.nextUrl.searchParams.get("storeType")?.trim() ?? "";
  const storeTypeUpper = storeTypeRaw.toUpperCase();
  const storeTypeFilter =
    storeTypeUpper && storeTypeUpper !== "PLACE" && isStoreTypeValue(storeTypeUpper)
      ? storeTypeUpper
      : null;

  const stores = await prisma.run_stores.findMany({
    where: {
      ...(storeTypeFilter ? { storeType: storeTypeFilter } : {}),
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      city: true,
      state: true,
      websiteUrl: true,
      storeType: true,
    },
    take: 20,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ success: true, stores });
}
