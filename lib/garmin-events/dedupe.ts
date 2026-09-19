/**
 * Deduplication utilities for Garmin webhook events
 * Prevents double-saving activities and other data
 */

import { prisma } from '../prisma';
import type { FitLapDataPayload } from './fit-lap-types';

/**
 * Check if activity already exists by sourceActivityId (avoids duplicate webhook/sync saves).
 */
export async function activityExists(
  sourceActivityId: string
): Promise<boolean> {
  const existing = await prisma.athlete_activities.findUnique({
    where: { sourceActivityId },
    select: { id: true },
  });
  return !!existing;
}

function readFitLapStartTimes(fitLapData: unknown): number[] | null {
  if (fitLapData == null || typeof fitLapData !== 'object') return null;
  const laps = (fitLapData as FitLapDataPayload).laps;
  if (!Array.isArray(laps)) return null;
  return laps
    .map((lap) => lap?.startTimeInSeconds)
    .filter((t): t is number => typeof t === 'number' && Number.isFinite(t));
}

/**
 * True when this activity already has FIT lap data with the same lap start sequence.
 */
export async function activityFileAlreadyProcessed(
  activityRowId: string,
  fileType: string,
  lapStartTimes: number[]
): Promise<boolean> {
  const row = await prisma.athlete_activities.findUnique({
    where: { id: activityRowId },
    select: { fitLapData: true },
  });
  if (!row?.fitLapData || typeof row.fitLapData !== 'object') return false;

  const existing = row.fitLapData as FitLapDataPayload;
  if (String(existing.fileType ?? '').toUpperCase() !== fileType.toUpperCase()) {
    return false;
  }

  const existingStarts = readFitLapStartTimes(existing) ?? [];
  if (existingStarts.length === 0 || existingStarts.length !== lapStartTimes.length) {
    return false;
  }
  return fitLapStartTimesMatch(existingStarts, lapStartTimes);
}

/** Pure helper for idempotent FIT lap comparison (unit-tested). */
export function fitLapStartTimesMatch(a: number[], b: number[]): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  return a.every((t, i) => t === b[i]);
}

/**
 * Early skip when ping includes sourceActivityId and FIT laps are already stored.
 */
export async function activityFileExists(
  sourceActivityId: string,
  fileType: string
): Promise<boolean> {
  const row = await prisma.athlete_activities.findUnique({
    where: { sourceActivityId },
    select: { fitLapData: true },
  });
  if (!row?.fitLapData || typeof row.fitLapData !== 'object') return false;
  const existing = row.fitLapData as FitLapDataPayload;
  return (
    String(existing.fileType ?? '').toUpperCase() === fileType.toUpperCase() &&
    Array.isArray(existing.laps) &&
    existing.laps.length > 0
  );
}

/** @deprecated FIT laps are persisted via fitLapData replace; kept for call-site compatibility. */
export async function markActivityFileProcessed(
  _sourceActivityId: string,
  _fileType: string
): Promise<void> {
  // No-op: handleActivityFile writes fitLapData directly.
}
