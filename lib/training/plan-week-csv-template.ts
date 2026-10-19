/**
 * Replace-this-week CSV contract — keep in sync with parse-plan-week-csv.ts.
 *
 * - Date: YYYY-MM-DD within the hub week you are replacing
 * - Workout: label for your reference (not stored on plan JSON)
 * - Type: Easy | Tempo | Intervals | LongRun | Shakeout (→ Easy) | Race (row skipped)
 * - Mileage: number (miles)
 * - Pace: optional; simple rates are display-only; multi-part pace builds workout segments
 */

export const PLAN_WEEK_CSV_HEADER_LINE = "Date,Workout,Type,Mileage,Pace";

export const PLAN_WEEK_CSV_DOWNLOAD_FILENAME = "gofast-replace-week-template.csv";

/** Example rows — swap dates to match the calendar week you are replacing. */
export const PLAN_WEEK_CSV_TEMPLATE = `${PLAN_WEEK_CSV_HEADER_LINE}
2026-10-20,Controlled Tempo,Tempo,6,"2 mi warm-up easy; 2 mi tempo @ 6:45/mi; 2 mi cool-down easy"
2026-10-21,Neighborhood Run,Easy,4,8:30/mi
2026-10-22,Social Run,Easy,4.5,8:00-8:30/mi
2026-10-24,Race shakeout,Shakeout,3,8:30-9:00/mi
2026-10-25,Marathon,Race,26.2,goal pace
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
