/** Human-readable catalogue structure lines for cards and create preview. */

export type CatalogueDetailsInput = {
  workoutType?: string | null;
  warmupMiles?: number | null;
  warmupPaceOffsetSecPerMile?: number | null;
  cooldownMiles?: number | null;
  cooldownPaceOffsetSecPerMile?: number | null;
  workBaseMiles?: number | null;
  workPaceOffsetSecPerMile?: number | null;
  workBaseReps?: number | null;
  workBaseRepMeters?: number | null;
  workBasePaceOffsetSecPerMile?: number | null;
  recoveryDistanceMeters?: number | null;
  recoveryDurationSeconds?: number | null;
};

function fmtMiles(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  return `${rounded} mi`;
}

function fmtOffset(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "";
  if (sec === 0) return " @ anchor";
  const sign = sec > 0 ? "+" : "";
  return ` @ ${sign}${Math.round(sec)} sec/mi`;
}

function fmtMeters(m: number | null | undefined): string | null {
  if (m == null || !Number.isFinite(m)) return null;
  const rounded = Math.round(m);
  if (rounded >= 1600 && rounded % 1600 === 0) {
    return `${rounded / 1600} mi`;
  }
  return `${rounded}m`;
}

export function catalogueDetailLines(row: CatalogueDetailsInput): string[] {
  const lines: string[] = [];

  const wu = fmtMiles(row.warmupMiles);
  if (wu) {
    lines.push(`Warmup: ${wu}${fmtOffset(row.warmupPaceOffsetSecPerMile)}`);
  }

  const wt = row.workoutType ?? "";
  if (wt === "Intervals" || (row.workBaseReps != null && row.workBaseRepMeters != null)) {
    const reps = row.workBaseReps;
    const repM = fmtMeters(row.workBaseRepMeters);
    if (reps != null && repM) {
      lines.push(
        `Work: ${reps}×${repM}${fmtOffset(row.workBasePaceOffsetSecPerMile ?? row.workPaceOffsetSecPerMile)}`
      );
    }
    const recParts: string[] = [];
    if (row.recoveryDurationSeconds != null && row.recoveryDurationSeconds > 0) {
      recParts.push(`${row.recoveryDurationSeconds}s jog`);
    }
    const recDist = fmtMeters(row.recoveryDistanceMeters);
    if (recDist) recParts.push(`${recDist} jog`);
    if (recParts.length) lines.push(`Recovery: ${recParts.join(" · ")}`);
  } else {
    const work = fmtMiles(row.workBaseMiles);
    if (work) {
      lines.push(`Work: ${work}${fmtOffset(row.workPaceOffsetSecPerMile)}`);
    }
  }

  const cd = fmtMiles(row.cooldownMiles);
  if (cd) {
    lines.push(`Cooldown: ${cd}${fmtOffset(row.cooldownPaceOffsetSecPerMile)}`);
  }

  return lines;
}

export function catalogueHasDetails(row: CatalogueDetailsInput): boolean {
  return catalogueDetailLines(row).length > 0;
}
