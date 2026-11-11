export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertRunManageAuth } from "@/lib/runmanage/require-run-manage-auth";
import { parseDayCorrectionsPaste } from "@/lib/runmanage/day-corrections-parse-llm";
import type { DayValidateRunRow } from "@/lib/runmanage/day-validate-llm-packet";

export async function POST(request: NextRequest) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  let body: { pasteText?: string; runs?: DayValidateRunRow[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const pasteText = body.pasteText?.trim() ?? "";
  if (!pasteText) {
    return NextResponse.json({ success: false, error: "pasteText is required" }, { status: 400 });
  }

  const runs = Array.isArray(body.runs) ? body.runs : [];
  const { csvText, parseErrors } = await parseDayCorrectionsPaste(pasteText, runs);

  return NextResponse.json({
    success: parseErrors.length === 0 || Boolean(csvText),
    csvText,
    parseErrors,
  });
}
