"use client";

import { useCallback, useEffect, useState } from "react";
import { RotationOrderList } from "@/components/training/RotationOrderList";
import { CATALOGUE_ROTATION_SLOTS } from "@/lib/training/athlete-rotation-constants";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";

export type CatalogueOption = {
  id: string;
  name: string;
};

type SlotRow = {
  id: string;
  catalogueWorkoutId: string;
  name: string;
};

type Props = {
  workoutType: "Tempo" | "Intervals";
  initialCatalogueIds: string[];
  getToken: () => Promise<string | null>;
  onChange: (orderedCatalogueIds: string[]) => void;
};

export function CatalogueRotationEditor({
  workoutType,
  initialCatalogueIds,
  getToken,
  onChange,
}: Props) {
  const [catalogue, setCatalogue] = useState<CatalogueOption[]>([]);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const token = await getToken();
        const res = await fetch(
          `/api/workouts/catalogue-browse?workoutType=${encodeURIComponent(workoutType)}`,
          { headers: token ? athleteBearerFetchHeaders(token) : {} }
        );
        const data = (await res.json()) as { items?: CatalogueOption[]; error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "Could not load catalogue");
        }
        const items = data.items ?? [];
        setCatalogue(items);
        const byId = new Map(items.map((i) => [i.id, i.name]));
        const seed = initialCatalogueIds.filter(Boolean);
        const slotCount = Math.max(seed.length, CATALOGUE_ROTATION_SLOTS);
        const ids = seed.slice(0, slotCount);
        while (ids.length < slotCount) {
          ids.push(ids[ids.length - 1] ?? items[0]?.id ?? "");
        }
        setSlots(
          ids.map((catalogueWorkoutId, idx) => ({
            id: `slot-${idx}`,
            catalogueWorkoutId,
            name: byId.get(catalogueWorkoutId) ?? "Select workout",
          }))
        );
      } catch (e) {
        setCatalogue([]);
        setSlots([]);
        setLoadError(e instanceof Error ? e.message : "Could not load catalogue");
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken, initialCatalogueIds, workoutType]);

  const emit = useCallback(
    (next: SlotRow[]) => {
      onChange(next.map((s) => s.catalogueWorkoutId));
    },
    [onChange]
  );

  const updateSlot = (index: number, catalogueWorkoutId: string) => {
    const name =
      catalogue.find((c) => c.id === catalogueWorkoutId)?.name ?? "Select workout";
    const next = slots.map((s, i) =>
      i === index ? { ...s, catalogueWorkoutId, name } : s
    );
    setSlots(next);
    emit(next);
  };

  const reorder = (orderedIds: string[]) => {
    const byId = new Map(slots.map((s) => [s.id, s]));
    const next = orderedIds
      .map((id) => byId.get(id))
      .filter((s): s is SlotRow => s != null);
    setSlots(next);
    emit(next);
  };

  if (loading) {
    return <p className="text-sm text-gray-600">Loading catalogue…</p>;
  }

  if (loadError) {
    return <p className="text-sm text-red-700">{loadError}</p>;
  }

  const rotationItems = slots.map((s) => ({
    id: s.id,
    title: s.name,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {slots.map((slot, idx) => (
          <label key={slot.id} className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-600">
              Slot {idx + 1}
            </span>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              value={slot.catalogueWorkoutId}
              onChange={(e) => updateSlot(idx, e.target.value)}
            >
              <option value="">Select workout</option>
              {catalogue.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Rotation order
        </p>
        <RotationOrderList
          items={rotationItems}
          onReorder={reorder}
          slotLabel={(i) => `Rotation ${i + 1}`}
        />
      </div>
    </div>
  );
}
