import { dateKeyToUtcNoonDate } from "@/lib/calendar-date";
import { prisma } from "@/lib/prisma";
import {
  type DayCorrectionRow,
  parseStartTimeValue,
} from "@/lib/runmanage/day-corrections";
import { maybeStampCityRunStartsAtOnUpdate } from "@/lib/city-run/stamp-city-run-write";

export type DayCorrectionPreviewItem = {
  line: number;
  runId: string;
  field: string;
  before: string;
  after: string;
  ok: boolean;
  reason?: string;
};

export async function previewDayCorrections(
  rows: DayCorrectionRow[],
  allowedRunIds: Set<string>
): Promise<DayCorrectionPreviewItem[]> {
  const out: DayCorrectionPreviewItem[] = [];
  for (const row of rows) {
    if (!allowedRunIds.has(row.runId)) {
      out.push({
        line: row.line,
        runId: row.runId,
        field: row.field,
        before: "—",
        after: row.value,
        ok: false,
        reason: "Run not in this day chunk",
      });
      continue;
    }
    const run = await prisma.city_runs.findUnique({
      where: { id: row.runId },
      select: {
        title: true,
        date: true,
        startTimeHour: true,
        startTimeMinute: true,
        startTimePeriod: true,
        meetUpPoint: true,
      },
    });
    if (!run) {
      out.push({
        line: row.line,
        runId: row.runId,
        field: row.field,
        before: "—",
        after: row.value,
        ok: false,
        reason: "Run not found",
      });
      continue;
    }
    let before = "";
    if (row.field === "title") before = run.title;
    if (row.field === "date") before = run.date.toISOString().slice(0, 10);
    if (row.field === "startTime") {
      before = `${run.startTimeHour ?? "?"}:${String(run.startTimeMinute ?? 0).padStart(2, "0")} ${run.startTimePeriod ?? ""}`.trim();
    }
    if (row.field === "meetUpPoint") before = run.meetUpPoint ?? "";
    if (row.action !== "replace" && row.action !== "enrich") {
      out.push({
        line: row.line,
        runId: row.runId,
        field: row.field,
        before,
        after: row.value,
        ok: false,
        reason: `Unsupported action: ${row.action}`,
      });
      continue;
    }
    if (!row.value && row.field !== "meetUpPoint") {
      out.push({
        line: row.line,
        runId: row.runId,
        field: row.field,
        before,
        after: row.value,
        ok: false,
        reason: "Empty value",
      });
      continue;
    }
    if (row.field === "startTime" && !parseStartTimeValue(row.value)) {
      out.push({
        line: row.line,
        runId: row.runId,
        field: row.field,
        before,
        after: row.value,
        ok: false,
        reason: 'Use format like 6:30 PM',
      });
      continue;
    }
    if (row.field === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(row.value)) {
      out.push({
        line: row.line,
        runId: row.runId,
        field: row.field,
        before,
        after: row.value,
        ok: false,
        reason: "Date must be YYYY-MM-DD",
      });
      continue;
    }
    out.push({
      line: row.line,
      runId: row.runId,
      field: row.field,
      before,
      after: row.value,
      ok: true,
    });
  }
  return out;
}

export async function applyDayCorrections(rows: DayCorrectionRow[], allowedRunIds: Set<string>) {
  const applied: string[] = [];
  const errors: string[] = [];
  const byRun = new Map<string, DayCorrectionRow[]>();
  for (const row of rows) {
    if (!allowedRunIds.has(row.runId)) continue;
    const list = byRun.get(row.runId) ?? [];
    list.push(row);
    byRun.set(row.runId, list);
  }

  for (const [runId, patchRows] of byRun) {
    const data: Record<string, unknown> = { updatedAt: new Date() };
    for (const row of patchRows) {
      if (row.field === "title") data.title = row.value;
      if (row.field === "meetUpPoint") data.meetUpPoint = row.value;
      if (row.field === "date") {
        data.date = dateKeyToUtcNoonDate(row.value);
        data.dateValidate = true;
      }
      if (row.field === "startTime") {
        const t = parseStartTimeValue(row.value);
        if (t) {
          data.startTimeHour = t.startTimeHour;
          data.startTimeMinute = t.startTimeMinute;
          data.startTimePeriod = t.startTimePeriod;
          data.timeValidate = true;
        }
      }
      if (row.field === "meetUpPoint") data.meetupValidate = true;
    }
    const existing = await prisma.city_runs.findUnique({
      where: { id: runId },
      select: {
        date: true,
        runDay: true,
        startTimeHour: true,
        startTimeMinute: true,
        startTimePeriod: true,
        timezone: true,
        citySlug: true,
      },
    });
    if (existing) {
      maybeStampCityRunStartsAtOnUpdate(data, {
        ...existing,
        citySlug: existing.citySlug ?? "",
      });
    }
    try {
      await prisma.city_runs.update({
        where: { id: runId },
        data: data as Parameters<typeof prisma.city_runs.update>[0]["data"],
      });
      applied.push(runId);
    } catch (e: unknown) {
      errors.push(`${runId}: ${e instanceof Error ? e.message : "update failed"}`);
    }
  }
  return { applied, errors };
}
