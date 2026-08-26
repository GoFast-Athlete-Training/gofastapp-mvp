"use client";

import { GripVertical } from "lucide-react";
import { useCallback, useState } from "react";

export type RotationOrderItem = {
  id: string;
  title: string;
  subtitle?: string;
};

type Props = {
  items: RotationOrderItem[];
  onReorder: (orderedIds: string[]) => void;
  slotLabel?: (index: number) => string;
};

export function RotationOrderList({
  items,
  onReorder,
  slotLabel = (i) => `Week ${i + 1} slot`,
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const move = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= items.length || from === to) return;
      const next = [...items];
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed!);
      onReorder(next.map((x) => x.id));
    },
    [items, onReorder]
  );

  const onDragStart = (index: number) => {
    setDragIndex(index);
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex == null || dragIndex === index) return;
    move(dragIndex, index);
    setDragIndex(index);
  };

  const onDragEnd = () => setDragIndex(null);

  if (!items.length) {
    return (
      <p className="text-sm text-gray-600">Rotation loaded from your distance template.</p>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
      {items.map((item, idx) => (
        <li
          key={item.id}
          draggable
          onDragStart={() => onDragStart(idx)}
          onDragOver={(e) => onDragOver(e, idx)}
          onDragEnd={onDragEnd}
          className={`flex items-center gap-2 px-3 py-3 text-sm ${
            dragIndex === idx ? "bg-orange-50" : ""
          }`}
        >
          <span
            className="cursor-grab text-gray-400 active:cursor-grabbing"
            aria-hidden
          >
            <GripVertical className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900">{slotLabel(idx)}</p>
            <p className="truncate text-gray-600">
              {item.title}
              {item.subtitle ? (
                <span className="text-gray-400"> · {item.subtitle}</span>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              disabled={idx === 0}
              aria-label={`Move ${item.title} earlier`}
              onClick={() => move(idx, idx - 1)}
              className="rounded border border-gray-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700 disabled:opacity-40"
            >
              Earlier
            </button>
            <button
              type="button"
              disabled={idx === items.length - 1}
              aria-label={`Move ${item.title} later`}
              onClick={() => move(idx, idx + 1)}
              className="rounded border border-gray-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700 disabled:opacity-40"
            >
              Later
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
