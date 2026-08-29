/** Segment row helpers for athlete catalogue mutation form (mirrors Company). */

export function segmentPayloadFromMilesRow(row: {
  miles: string;
  paceKey?: string;
  pace: string;
}): Record<string, unknown> {
  const miles = Number(row.miles);
  if (!Number.isFinite(miles) || miles <= 0) return {};
  const paceT = row.pace.trim();
  const payload: Record<string, unknown> = { miles };
  if (paceT !== "") {
    const off = Number(paceT);
    if (Number.isFinite(off)) {
      payload.paceOffsetSecPerMile = Math.round(off);
    } else {
      payload.paceOffsetSecPerMile = null;
    }
  }
  return payload;
}

export function segmentPayloadFromMetersRow(row: {
  distanceMeters: string;
  paceKey?: string;
  pace: string;
  reps?: string;
}): Record<string, unknown> {
  const distanceMeters = Math.round(Number(row.distanceMeters));
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return {};
  const paceT = row.pace.trim();
  const base: Record<string, unknown> = { distanceMeters };
  if (paceT !== "") {
    const off = Number(paceT);
    if (Number.isFinite(off)) {
      base.paceOffsetSecPerMile = Math.round(off);
    } else {
      base.paceOffsetSecPerMile = null;
    }
  }
  if (row.reps != null && row.reps.trim() !== "") {
    const reps = Math.max(1, Math.round(Number(row.reps) || 1));
    return { ...base, reps };
  }
  return base;
}
