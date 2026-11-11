export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertRunManageAuth } from "@/lib/runmanage/require-run-manage-auth";
import { parseDayCorrectionsCsv } from "@/lib/runmanage/day-corrections";
import { applyDayCorrections, previewDayCorrections } from "@/lib/runmanage/apply-day-corrections";

export async function POST(request: NextRequest) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  let body: { csvText?: string; allowedRunIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const csvText = body.csvText?.trim() ?? "";
  if (!csvText) {
    return NextResponse.json({ success: false, error: "csvText is required" }, { status: 400 });
  }

  const allowed = new Set(
    (body.allowedRunIds ?? []).map((id) => id.trim()).filter(Boolean)
  );
  const { rows, parseErrors } = parseDayCorrectionsCsv(csvText);
  if (parseErrors.length > 0) {
    return NextResponse.json({ success: false, parseErrors }, { status: 400 });
  }

  const preview = await previewDayCorrections(rows, allowed);
  const blocked = preview.filter((p) => !p.ok);
  if (blocked.length > 0) {
    return NextResponse.json({
      success: false,
      error: "Fix preview errors before apply",
      preview,
    }, { status: 400 });
  }

  const result = await applyDayCorrections(rows.filter((r) => allowed.has(r.runId)), allowed);

  return NextResponse.json({
    success: result.errors.length === 0,
    appliedRunIds: result.applied,
    errors: result.errors,
  });
}
