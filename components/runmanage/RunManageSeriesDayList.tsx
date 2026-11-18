"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Pencil, Search } from "lucide-react";
import { formatDayLabel } from "@/lib/runmanage/format-day-label";
import { weekdaySortIndex } from "@/lib/runmanage/sort-series-by-weekday";
import type { SeriesManageRow } from "@/lib/runmanage/series-manage-list";

function formatTime(row: SeriesManageRow): string {
  if (row.startTimeHour == null) return "—";
  const min = String(row.startTimeMinute ?? 0).padStart(2, "0");
  const period = row.startTimePeriod?.trim() || "";
  return `${row.startTimeHour}:${min}${period ? ` ${period}` : ""}`;
}

function cityLabel(row: SeriesManageRow): string {
  return row.cityName?.trim() || row.citySlug?.trim() || row.meetUpCity?.trim() || "";
}

export function RunManageSeriesDayList({
  rows,
  onEdit,
}: {
  rows: SeriesManageRow[];
  onEdit: (row: SeriesManageRow) => void;
}) {
  const [query, setQuery] = useState("");

  const showCity = useMemo(() => {
    const names = new Set(rows.map((row) => cityLabel(row)).filter(Boolean));
    return names.size > 1;
  }, [rows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      const hay = [row.clubName, row.name, row.meetUpPoint, cityLabel(row)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [rows, query]);

  const groups = useMemo(() => {
    const map = new Map<string, SeriesManageRow[]>();
    for (const row of filtered) {
      const key = row.dayOfWeek.trim().toUpperCase() || "OTHER";
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => weekdaySortIndex(a[0]) - weekdaySortIndex(b[0]));
  }, [filtered]);

  const searching = Boolean(query.trim());

  return (
    <div className="space-y-3">
      <label className="relative block max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search club, series, or meet-up…"
          aria-label="Search series"
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm"
        />
      </label>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white py-10 text-center text-sm text-gray-500">
          {rows.length === 0 ? "No weekly series in this view." : "No series match that search."}
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map(([day, dayRows]) => (
            <CollapsibleDay
              key={day}
              title={formatDayLabel(day)}
              count={dayRows.length}
              forceOpen={searching}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
                    <tr>
                      <th className="px-4 py-2">Time</th>
                      <th className="px-4 py-2">Series</th>
                      <th className="px-4 py-2">Club</th>
                      {showCity ? <th className="px-4 py-2">City</th> : null}
                      <th className="px-4 py-2">Meet-up</th>
                      <th className="px-4 py-2 text-right">Runs</th>
                      <th className="px-4 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dayRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/80">
                        <td className="px-4 py-3 whitespace-nowrap text-gray-800">{formatTime(row)}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{row.name?.trim() || "—"}</td>
                        <td className="px-4 py-3 text-gray-700">{row.clubName ?? "—"}</td>
                        {showCity ? (
                          <td className="px-4 py-3 text-gray-600">{cityLabel(row) || "—"}</td>
                        ) : null}
                        <td className="max-w-xs truncate px-4 py-3 text-gray-600">
                          {row.meetUpPoint?.trim() || "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{row.runCount}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => onEdit(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleDay>
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsibleDay({
  title,
  count,
  forceOpen,
  children,
}: {
  title: string;
  count: number;
  forceOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const shown = forceOpen || open;
  return (
    <details
      open={shown}
      onToggle={(event) => {
        if (forceOpen) return;
        setOpen(event.currentTarget.open);
      }}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
        <span>
          {title}
          <span className="ml-2 font-normal text-gray-500">{count}</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${shown ? "rotate-180" : ""}`} />
      </summary>
      {children}
    </details>
  );
}
