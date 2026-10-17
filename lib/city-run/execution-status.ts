import type { CityRunExecutionStatus } from "@prisma/client";

export const CITY_RUN_EXECUTION_STATUSES: CityRunExecutionStatus[] = [
  "PLANNED",
  "RAN",
  "CANCELED",
];

export function parseCityRunExecutionStatus(
  raw: unknown,
): CityRunExecutionStatus | null {
  if (raw === "PLANNED" || raw === "RAN" || raw === "CANCELED") return raw;
  return null;
}

export function executionStatusPatchData(status: CityRunExecutionStatus): {
  cityRunExecutionStatus: CityRunExecutionStatus;
  executedAt: Date | null;
  canceledAt: Date | null;
} {
  const now = new Date();
  if (status === "RAN") {
    return {
      cityRunExecutionStatus: "RAN",
      executedAt: now,
      canceledAt: null,
    };
  }
  if (status === "CANCELED") {
    return {
      cityRunExecutionStatus: "CANCELED",
      executedAt: null,
      canceledAt: now,
    };
  }
  return {
    cityRunExecutionStatus: "PLANNED",
    executedAt: null,
    canceledAt: null,
  };
}

/** Upcoming athlete lists: hide runs the host marked canceled or completed. */
export function isCityRunUpcomingForLists(status: CityRunExecutionStatus): boolean {
  return status === "PLANNED";
}
