/**
 * Full-plan CSV — Week column + same day columns as single-week template.
 * Keep in sync with parse-plan-multi-week-csv.ts.
 */

export const PLAN_MULTI_WEEK_CSV_HEADER_LINE =
  "Week,Date,Workout,Type,Mileage,Pace";

export const PLAN_MULTI_WEEK_CSV_DOWNLOAD_FILENAME = "gofast-full-plan-template.csv";

export const PLAN_MULTI_WEEK_CSV_TEMPLATE = `# Full training plan — one row per workout day. Week = plan week number (1 = first week of your plan).
# Do NOT include goal race day. No Race type rows — race day lives in My Race.
# Type: Easy | Tempo | Intervals | LongRun. Shakeout → Easy.
${PLAN_MULTI_WEEK_CSV_HEADER_LINE}
`;

const MULTI_HEADER = new RegExp(
  "^" +
    PLAN_MULTI_WEEK_CSV_HEADER_LINE.split(",")
      .map((col) => col.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s*,\\s*") +
    "$",
  "i"
);

export function isPlanMultiWeekCsvHeaderLine(line: string): boolean {
  return MULTI_HEADER.test(line.trim());
}
