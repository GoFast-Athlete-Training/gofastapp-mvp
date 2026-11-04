import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertRunManageAuth } from "@/lib/runmanage/require-run-manage-auth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/runmanage/runs/[runId]/week-validate
 * Toggle date/time/meetup validation stamps or save instance routeNotes.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { runId } = await params;
  let body: {
    dateValidate?: boolean;
    timeValidate?: boolean;
    meetupValidate?: boolean;
    routeNotes?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const data: {
    dateValidate?: boolean;
    timeValidate?: boolean;
    meetupValidate?: boolean;
    routeNotes?: string | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (typeof body.dateValidate === "boolean") data.dateValidate = body.dateValidate;
  if (typeof body.timeValidate === "boolean") data.timeValidate = body.timeValidate;
  if (typeof body.meetupValidate === "boolean") data.meetupValidate = body.meetupValidate;
  if (body.routeNotes !== undefined) {
    data.routeNotes =
      body.routeNotes === null || body.routeNotes === "" ? null : String(body.routeNotes).trim();
  }

  if (
    data.dateValidate === undefined &&
    data.timeValidate === undefined &&
    data.meetupValidate === undefined &&
    data.routeNotes === undefined
  ) {
    return NextResponse.json(
      { success: false, error: "No validation or routeNotes fields to update" },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.city_runs.update({
      where: { id: runId },
      data,
      select: {
        id: true,
        dateValidate: true,
        timeValidate: true,
        meetupValidate: true,
        routeNotes: true,
        routeId: true,
      },
    });
    return NextResponse.json({ success: true, run: updated });
  } catch {
    return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });
  }
}
