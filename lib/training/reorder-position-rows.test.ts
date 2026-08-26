import assert from "node:assert/strict";
import test from "node:test";
import { reorderPositionRows } from "@/lib/training/reorder-position-rows";

test("reorderPositionRows applies two-phase cycle positions", async () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const updates: Array<{ id: string; pos: number }> = [];

  await reorderPositionRows({
    rows,
    orderedIds: ["c", "a", "b"],
    tempOffset: 100,
    update: async (id, cyclePosition) => {
      updates.push({ id, pos: cyclePosition });
    },
  });

  assert.deepEqual(
    updates.filter((u) => u.pos <= 3).map((u) => u.id),
    ["c", "a", "b"]
  );
  assert.equal(updates.filter((u) => u.pos === 1).length, 1);
  assert.equal(updates.find((u) => u.pos === 1)?.id, "c");
});

test("reorderPositionRows rejects duplicate ids", async () => {
  await assert.rejects(
    reorderPositionRows({
      rows: [{ id: "a" }, { id: "b" }],
      orderedIds: ["a", "a"],
      tempOffset: 100,
      update: async () => {},
    }),
    /every position exactly once/
  );
});
