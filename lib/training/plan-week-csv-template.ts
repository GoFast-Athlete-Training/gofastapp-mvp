/**
 * Replace-this-week CSV contract — keep in sync with parse-plan-week-csv.ts.
 *
 * Lines starting with # are ignored on upload. Do not include goal race day in the file.
 */

export const PLAN_WEEK_CSV_HEADER_LINE = "Date,Workout,Type,Mileage,Pace";

export const PLAN_WEEK_CSV_DOWNLOAD_FILENAME = "gofast-replace-week-template.csv";

/** Downloaded file: instructions first, then header only — athlete fills training days. */
export const PLAN_WEEK_CSV_TEMPLATE = `# Do NOT include goal race day. No Race type rows — race day lives in My Race, not this upload.
# Use YYYY-MM-DD dates in the calendar week you are replacing on Training.
# Type column (WorkoutType only): Easy | Tempo | Intervals | LongRun — pre-race shakeout is Easy (say "shakeout" in Workout name if you want).
# Workout name is for you; Pace is optional (simple rate or structured warm-up/tempo/cool-down text).
${PLAN_WEEK_CSV_HEADER_LINE}
`;

const CSV_HEADER = new RegExp(
  "^" +
    PLAN_WEEK_CSV_HEADER_LINE.split(",")
      .map((col) => col.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s*,\\s*") +
    "$",
  "i"
);

export function isPlanWeekCsvHeaderLine(line: string): boolean {
  return CSV_HEADER.test(line.trim());
}
