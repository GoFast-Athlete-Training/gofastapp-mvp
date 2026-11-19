"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCalendarDate, isDateKey } from "@/lib/calendar-date";
import { localTodayKey } from "@/lib/training/plan-utils";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  className?: string;
  disabled?: boolean;
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toKey(year: number, monthIndex: number, day: number) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function parseMonth(value: string): { y: number; m: number } | null {
  if (!isDateKey(value)) return null;
  const [y, m] = value.split("-").map(Number);
  if (!y || !m) return null;
  return { y, m: m - 1 };
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function shiftMonth(year: number, monthIndex: number, delta: number) {
  const next = new Date(year, monthIndex + delta, 1);
  return { y: next.getFullYear(), m: next.getMonth() };
}

export function DateField({ id, value, onChange, min, max, className, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(
    () => parseMonth(value) ?? parseMonth(localTodayKey()) ?? { y: new Date().getFullYear(), m: new Date().getMonth() }
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function openPicker() {
    const parsed = parseMonth(value) ?? parseMonth(localTodayKey());
    if (parsed) setView(parsed);
    setOpen(true);
  }

  const cells = useMemo(() => {
    const count = daysInMonth(view.y, view.m);
    const lead = new Date(view.y, view.m, 1).getDay();
    const days: Array<{ key: string; day: number } | null> = Array.from({ length: lead }, () => null);
    for (let day = 1; day <= count; day++) {
      days.push({ key: toKey(view.y, view.m, day), day });
    }
    return days;
  }, [view]);

  const today = localTodayKey();
  const monthLabel = formatCalendarDate(toKey(view.y, view.m, 1), {
    month: "long",
    year: "numeric",
  });
  const prev = shiftMonth(view.y, view.m, -1);
  const next = shiftMonth(view.y, view.m, 1);
  const prevDisabled = Boolean(min && toKey(prev.y, prev.m, daysInMonth(prev.y, prev.m)) < min);
  const nextDisabled = Boolean(max && toKey(next.y, next.m, 1) > max);
  const triggerClass =
    className ??
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500";

  return (
    <div className={open ? "relative z-[70]" : "relative"}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={`flex items-center justify-between gap-2 text-left disabled:opacity-60 ${triggerClass}`}
      >
        <span className={value && isDateKey(value) ? "text-gray-900" : "text-gray-500"}>
          {value && isDateKey(value) ? formatCalendarDate(value) : "Select a date"}
        </span>
        <Calendar className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] cursor-default bg-black/20 lg:bg-transparent"
            aria-label="Close calendar"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Choose a date"
            className="fixed inset-x-3 z-[70] bottom-[calc(4.5rem+env(safe-area-inset-bottom))] rounded-2xl border border-gray-200 bg-white p-3 shadow-xl lg:absolute lg:inset-x-auto lg:bottom-auto lg:left-0 lg:top-full lg:mt-1 lg:w-80"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Previous month"
                disabled={prevDisabled}
                onClick={() => setView(prev)}
                className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-sm font-semibold text-gray-900">{monthLabel}</p>
              <button
                type="button"
                aria-label="Next month"
                disabled={nextDisabled}
                onClick={() => setView(next)}
                className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500">
              {WEEKDAYS.map((label) => (
                <div key={label} className="py-1">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell, index) => {
                if (!cell) return <div key={`blank-${index}`} />;
                const outOfRange = Boolean((min && cell.key < min) || (max && cell.key > max));
                const selected = cell.key === value;
                const isToday = cell.key === today;
                return (
                  <button
                    key={cell.key}
                    type="button"
                    disabled={outOfRange}
                    onClick={() => {
                      onChange(cell.key);
                      setOpen(false);
                    }}
                    className={`h-9 rounded-lg text-sm ${
                      selected
                        ? "bg-orange-500 font-semibold text-white"
                        : isToday
                          ? "border border-orange-300 font-semibold text-gray-900"
                          : "text-gray-800 hover:bg-orange-50"
                    } disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
