/**
 * Collision-safe cyclePosition reorder — two-phase temp positions then finals.
 */

export async function reorderPositionRows<T extends { id: string }>(params: {
  rows: T[];
  orderedIds: string[];
  tempOffset: number;
  update: (id: string, cyclePosition: number) => Promise<unknown>;
}): Promise<void> {
  const idSet = new Set(params.rows.map((r) => r.id));
  if (params.orderedIds.length !== params.rows.length) {
    throw new Error("Reorder must include every position exactly once");
  }
  if (new Set(params.orderedIds).size !== params.orderedIds.length) {
    throw new Error("Reorder must include every position exactly once");
  }
  for (const id of params.orderedIds) {
    if (!idSet.has(id)) {
      throw new Error("Invalid position id in reorder");
    }
  }

  const tempBase = params.tempOffset;
  for (let i = 0; i < params.orderedIds.length; i++) {
    await params.update(params.orderedIds[i]!, tempBase + i + 1);
  }
  for (let i = 0; i < params.orderedIds.length; i++) {
    await params.update(params.orderedIds[i]!, i + 1);
  }
}
