"use client";

import { X } from "lucide-react";
import {
  EntitySearch,
  emptyAffiliationDraft,
  type RunAffiliationDraft,
  RUN_MANAGE_TYPE_LABELS,
  RUN_MANAGE_TYPE_HINTS,
  type AffiliationPick,
} from "@/components/runmanage/RunManageRunAffiliations";
import {
  RUN_MANAGE_STAFF_CREATE_RUN_TYPES,
  type ClubBoltMode,
  type CreateRunScopeFork,
  type RunManageStaffCreateRunType,
} from "@/lib/runmanage/create-run-scope";
import type { SpecialEventDraft } from "@/lib/runmanage/special-event-draft";

type Props = {
  title: string;
  draft: RunAffiliationDraft;
  fork: CreateRunScopeFork;
  specialEvent: SpecialEventDraft;
  onDraftChange: (next: RunAffiliationDraft) => void;
  onForkChange: (next: CreateRunScopeFork) => void;
  onSpecialEventChange: (next: SpecialEventDraft) => void;
};

export default function RunManageCreateRunScope({
  title,
  draft,
  fork,
  specialEvent,
  onDraftChange,
  onForkChange,
  onSpecialEventChange,
}: Props) {
  const type = draft.cityRunType;

  const setRunType = (next: RunManageStaffCreateRunType) => {
    onDraftChange(emptyAffiliationDraft(next));
    onForkChange({ clubBoltMode: null });
    if (next === "SPECIAL") {
      onSpecialEventChange({
        ...specialEvent,
        id: null,
      });
    }
  };

  const setClubBolt = (clubBoltMode: ClubBoltMode) => {
    onForkChange({ ...fork, clubBoltMode });
  };

  const runTypeValue = RUN_MANAGE_STAFF_CREATE_RUN_TYPES.includes(
    type as RunManageStaffCreateRunType
  )
    ? type
    : "CLUB";

  const addAffiliatedClub = (hit: AffiliationPick) => {
    if (specialEvent.affiliatedClubs.some((e) => e.kind === "CLUB" && e.refId === hit.id)) return;
    onSpecialEventChange({
      ...specialEvent,
      affiliatedClubs: [
        ...specialEvent.affiliatedClubs,
        {
          kind: "CLUB",
          refId: hit.id,
          nameSnapshot: hit.name,
          logoUrlSnapshot: hit.logoUrl ?? null,
        },
      ],
    });
  };

  const removeAffiliatedClub = (refId: string) => {
    onSpecialEventChange({
      ...specialEvent,
      affiliatedClubs: specialEvent.affiliatedClubs.filter((e) => e.refId !== refId),
    });
  };

  return (
    <div className="max-w-3xl space-y-4 rounded-xl border border-gray-200 bg-gray-50/80 p-5">
      <div>
        <label className="block text-sm font-semibold text-gray-900" htmlFor="run-type-select">
          Run type
        </label>
        <select
          id="run-type-select"
          value={runTypeValue}
          onChange={(e) => setRunType(e.target.value as RunManageStaffCreateRunType)}
          className="mt-2 w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          {RUN_MANAGE_STAFF_CREATE_RUN_TYPES.map((t) => (
            <option key={t} value={t}>
              {RUN_MANAGE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-gray-600">
          {RUN_MANAGE_TYPE_HINTS[runTypeValue as RunManageStaffCreateRunType]}
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Race shakeouts are built in Race Manage (race hub → Shakeouts) — not on this form.
        </p>
      </div>

      {type === "CLUB" ? (
        <>
          <EntitySearch
            label="Hosting club"
            placeholder="Search clubs…"
            kind="club"
            selected={draft.runClubPick}
            onSelect={(h) =>
              onDraftChange({
                ...draft,
                runClubId: h.id,
                runClubLabel: h.name,
                runClubPick: h,
              })
            }
            onClear={() =>
              onDraftChange({ ...draft, runClubId: null, runClubLabel: null, runClubPick: null })
            }
          />
          <div>
            <p className="text-sm font-semibold text-gray-900">Bolt to club container</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setClubBolt("one_off")}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  fork.clubBoltMode === "one_off"
                    ? "bg-sky-600 text-white"
                    : "bg-white text-gray-700 ring-1 ring-gray-200"
                }`}
              >
                One-off instance
              </button>
              <button
                type="button"
                onClick={() => setClubBolt("series")}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  fork.clubBoltMode === "series"
                    ? "bg-sky-600 text-white"
                    : "bg-white text-gray-700 ring-1 ring-gray-200"
                }`}
              >
                From series
              </button>
            </div>
            {fork.clubBoltMode === "series" ? (
              <p className="mt-2 text-xs text-amber-800">
                Series picker coming soon — use one-off until club series attach is wired.
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {type === "SPECIAL" ? (
        <div className="space-y-4 rounded-lg border border-orange-200/80 bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">1. Write the special event</p>
            <p className="mt-1 text-xs text-gray-600">
              Parent record first — the city run bolts with specialEventId after this is complete.
            </p>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-gray-900">Event name *</span>
            <input
              type="text"
              value={specialEvent.name}
              onChange={(e) => onSpecialEventChange({ ...specialEvent, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-900">Event title</span>
            <input
              type="text"
              value={specialEvent.eventTitle}
              onChange={(e) =>
                onSpecialEventChange({ ...specialEvent, eventTitle: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-900">Description</span>
            <textarea
              value={specialEvent.description}
              onChange={(e) =>
                onSpecialEventChange({ ...specialEvent, description: e.target.value })
              }
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-gray-900">Event date</span>
              <input
                type="date"
                value={specialEvent.eventDate}
                onChange={(e) =>
                  onSpecialEventChange({ ...specialEvent, eventDate: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-gray-900">Event URL</span>
              <input
                type="url"
                value={specialEvent.url}
                onChange={(e) => onSpecialEventChange({ ...specialEvent, url: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900">2. Brand lead *</p>
            <EntitySearch
              label="Lead brand"
              placeholder="Search brands…"
              kind="brand"
              selected={specialEvent.brandPick}
              onSelect={(h) =>
                onSpecialEventChange({
                  ...specialEvent,
                  brandId: h.id,
                  brandPick: { ...h, secondary: h.kindLabel ?? h.secondary },
                })
              }
              onClear={() =>
                onSpecialEventChange({
                  ...specialEvent,
                  brandId: null,
                  brandPick: null,
                })
              }
            />
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900">3. Affiliate clubs (optional)</p>
            <p className="mt-1 text-xs text-gray-600">Clubs on the event — not a second run scope.</p>
            <div className="mt-2">
              <EntitySearch
                label="Add affiliated club"
                placeholder="Search clubs…"
                kind="club"
                selected={null}
                onSelect={addAffiliatedClub}
                onClear={() => undefined}
              />
            </div>
            {specialEvent.affiliatedClubs.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {specialEvent.affiliatedClubs.map((club) => (
                  <li
                    key={club.refId}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-gray-900">{club.nameSnapshot}</span>
                    <button
                      type="button"
                      onClick={() => removeAffiliatedClub(club.refId)}
                      className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                      aria-label={`Remove ${club.nameSnapshot}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {!title.trim() ? (
        <p className="text-xs text-gray-500">Add a title above to finish scope.</p>
      ) : null}
    </div>
  );
}
