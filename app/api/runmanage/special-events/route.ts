export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertRunManageAuth,
  staffGeneratedIdFromAuth,
} from "@/lib/runmanage/require-run-manage-auth";
import { partnerExtrasForWrite } from "@/lib/runmanage/partner-extras";
import { parseCalendarDateForWrite } from "@/lib/calendar-date";

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

/** POST /api/runmanage/special-events — write parent before bolting city run */
export async function POST(request: NextRequest) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ success: false, error: "name is required" }, { status: 400 });
  }

  const brandIdRaw = body.brandId;
  const brandId =
    brandIdRaw === null || brandIdRaw === ""
      ? null
      : typeof brandIdRaw === "string"
        ? brandIdRaw.trim() || null
        : null;
  if (!brandId) {
    return NextResponse.json({ success: false, error: "brandId (event lead) is required" }, { status: 400 });
  }

  const brand = await prisma.brands.findUnique({ where: { id: brandId }, select: { id: true } });
  if (!brand) {
    return NextResponse.json({ success: false, error: "Brand not found" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() || null : null;
  const description =
    typeof body.description === "string" ? body.description.trim() || null : null;
  const url = typeof body.url === "string" ? body.url.trim() || null : null;

  let eventDate: Date | null = null;
  if (body.eventDate !== null && body.eventDate !== undefined && body.eventDate !== "") {
    try {
      eventDate = parseCalendarDateForWrite(String(body.eventDate));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Invalid event date";
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
  }

  const extras = partnerExtrasForWrite(body.partnerExtras);
  const staffGeneratedId = staffGeneratedIdFromAuth(auth);

  const row = await prisma.special_events.create({
    data: {
      id: generateId(),
      name,
      title,
      description,
      eventDate,
      url,
      brandId,
      partnerExtras: extras ? (extras as Prisma.InputJsonValue) : Prisma.JsonNull,
      staffGeneratedId,
      updatedAt: new Date(),
    },
    include: {
      brand: { select: { id: true, name: true, logoUrl: true, brandType: true } },
    },
  });

  return NextResponse.json({ success: true, specialEvent: row });
}
