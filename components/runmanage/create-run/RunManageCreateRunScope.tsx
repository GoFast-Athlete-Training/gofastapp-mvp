"use client";

import {
  EntitySearch,
  emptyAffiliationDraft,
  type RunAffiliationDraft,
  RUN_MANAGE_TYPE_LABELS,
  RUN_MANAGE_TYPE_HINTS,
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
  /** Race hub front door — company race id resolved to registry on create. */
  imprintedCompanyRaceId?: string | null;
  imprintedRaceLabel?: string | null;
};

export default function RunManageCreateRunScope({
  title,
  draft,
  fork,
  specialEvent,
  onDraftChange,
  onForkChange,
  onSpecialEventChange,
  imprintedCompanyRaceId,
  imprintedRaceLabel,
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
      </div>

      {type === "RACE_SHAKEOUT" ? (
        <div className="space-y-3 rounded-lg border border-amber-200/80 bg-white p-4">
          <p className="text-sm font-semibold text-gray-900">Race scope</p>
          {imprintedCompanyRaceId || draft.raceRegistryId ? (
            <p className="text-sm text-gray-700">
              {imprintedRaceLabel?.trim() || "Race on this hub"}{" "}
              <span className="text-xs text-gray-500">(registry stamped on save)</span>
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-600">
                Optional — attach a prod race registry id, or save as a plain city run and bolt later.
              </p>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Race registry id</span>
                <input
                  type="text"
                  value={draft.raceRegistryId ?? ""}
                  onChange={(e) =>
                    onDraftChange({ ...draft, raceRegistryId: e.target.value.trim() || null })
                  }
                  className="mt-1 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </>
          )}
        </div>
      ) : null}

      {type === "CLUB" ? (
        <>
          <EntitySearch
            label="Hosting club (optional)"
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
          {draft.runClubId ? (
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
          ) : null}
        </>
      ) : null}

      {type === "SPECIAL" ? (
        <div className="space-y-4 rounded-lg border border-orange-200/80 bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Special event parent (optional)</p>
            <p className="mt-1 text-xs text-gray-600">
              Event name stamps SPECIAL when set. Brand and affiliate clubs are Associate after save.
            </p>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-gray-900">Event name</span>
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
        </div>
      ) : null}

      {!title.trim() ? (
        <p className="text-xs text-gray-500">Add a title above to open the run builder.</p>
      ) : null}
    </div>
  );
}
