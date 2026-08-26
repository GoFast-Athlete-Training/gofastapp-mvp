/**
 * @deprecated Use reorderAthleteLongRunOrder — updates shared catalog positions.
 * Kept for any legacy callers; uses collision-safe two-phase reorder.
 */

import { prisma } from "@/lib/prisma";
import { reorderPositionRows } from "@/lib/training/reorder-position-rows";

export async function reorderLongRunConfigPositions(params: {
  longRunConfigId: string;
  /** Position ids in desired cycle order (index 0 → cyclePosition 1). */
  orderedPositionIds: string[];
}): Promise<void> {
  const positions = await prisma.long_run_config_position.findMany({
    where: { longRunConfigId: params.longRunConfigId },
    orderBy: { cyclePosition: "asc" },
  });
  if (positions.length === 0) {
    throw new Error("No long-run positions to reorder");
  }

  await prisma.$transaction(async (tx) => {
    await reorderPositionRows({
      rows: positions,
      orderedIds: params.orderedPositionIds,
      tempOffset: 100,
      update: async (id, cyclePosition) => {
        await tx.long_run_config_position.update({
          where: { id },
          data: { cyclePosition, updatedAt: new Date() },
        });
      },
    });
  });
}
