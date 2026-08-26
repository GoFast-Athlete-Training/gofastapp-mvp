/**
 * Reorder long_run_config_position cycle positions (1–4) without changing weights or pool sum.
 */

import { prisma } from "@/lib/prisma";

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
  const idSet = new Set(positions.map((p) => p.id));
  if (params.orderedPositionIds.length !== positions.length) {
    throw new Error("Reorder must include every position exactly once");
  }
  for (const id of params.orderedPositionIds) {
    if (!idSet.has(id)) {
      throw new Error("Invalid position id in reorder");
    }
  }
  const now = new Date();
  await prisma.$transaction(
    params.orderedPositionIds.map((id, idx) =>
      prisma.long_run_config_position.update({
        where: { id },
        data: { cyclePosition: idx + 1, updatedAt: now },
      })
    )
  );
}
