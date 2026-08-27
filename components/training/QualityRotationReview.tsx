"use client";

import { RotationOrderList } from "@/components/training/RotationOrderList";

export type QualityRotationSlot = {
  id: string;
  cyclePosition: number;
  catalogueWorkoutId: string | null;
  workout_catalogue?: {
    name: string;
    description?: string | null;
    workoutType?: string;
  } | null;
};

type Props = {
  slots: QualityRotationSlot[];
  onReorder: (orderedSlotIds: string[]) => void;
  slotLabel?: (index: number) => string;
};

export function QualityRotationReview({ slots, onReorder, slotLabel }: Props) {
  const ordered = [...slots].sort((a, b) => a.cyclePosition - b.cyclePosition);

  const reorder = (orderedIds: string[]) => {
    onReorder(orderedIds);
  };

  return (
    <RotationOrderList
      items={ordered.map((slot, idx) => ({
        id: slot.id,
        title: slot.workout_catalogue?.name ?? "Workout",
        subtitle: slot.workout_catalogue?.description?.trim() || undefined,
      }))}
      onReorder={reorder}
      slotLabel={slotLabel ?? ((i) => `Rotation ${i + 1}`)}
    />
  );
}

export function qualitySlotsHaveCatalogue(slots: QualityRotationSlot[]): boolean {
  return slots.some((s) => Boolean(s.catalogueWorkoutId?.trim()));
}

export function catalogueIdsFromQualitySlots(slots: QualityRotationSlot[]): string[] {
  return [...slots]
    .sort((a, b) => a.cyclePosition - b.cyclePosition)
    .map((s) => s.catalogueWorkoutId)
    .filter((id): id is string => Boolean(id?.trim()));
}
