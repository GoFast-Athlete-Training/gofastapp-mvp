"use client";

import {
  EntitySearch,
  emptyAffiliationDraft,
  RunManageRunAffiliations,
  type RunAffiliationDraft,
  RUN_MANAGE_TYPE_LABELS,
  RUN_MANAGE_TYPE_HINTS,
} from "@/components/runmanage/RunManageRunAffiliations";
import {
  RUN_MANAGE_STAFF_CREATE_RUN_TYPES,
  type ClubBoltMode,
  type CreateRunScopeFork,
  type SpecialLeadMode,
  type RunManageStaffCreateRunType,
} from "@/lib/runmanage/create-run-scope";

type Props = {
  title: string;
  draft: RunAffiliationDraft;
  fork: CreateRunScopeFork;
  onDraftChange: (next: RunAffiliationDraft) => void;
  onForkChange: (next: CreateRunScopeFork) => void;
};

export default function RunManageCreateRunScope({
  title,
  draft,
  fork,
  onDraftChange,
  onForkChange,
}: Props) {
  const type = draft.cityRunType;

  const setRunType = (next: RunManageStaffCreateRunType) => {
    onDraftChange(emptyAffiliationDraft(next));
    onForkChange({ clubBoltMode: null, specialLeadMode: null });
  };

  const setClubBolt = (clubBoltMode: ClubBoltMode) => {
    onForkChange({ ...fork, clubBoltMode });
  };

  const setSpecialLead = (specialLeadMode: SpecialLeadMode) => {
    onForkChange({ ...fork, specialLeadMode });
    if (specialLeadMode === "floating") {
      onDraftChange({
        ...draft,
        runBrandId: null,
        runBrandLabel: null,
        runBrandPick: null,
      });
    }
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

      {type === "RUN_STORE" ? (
        <EntitySearch
          label="Hosting store"
          placeholder="Search stores…"
          kind="store"
          selected={draft.runStorePick}
          onSelect={(h) =>
            onDraftChange({
              ...draft,
              runStoreId: h.id,
              runStoreLabel: h.name,
              runStorePick: h,
            })
          }
          onClear={() =>
            onDraftChange({ ...draft, runStoreId: null, runStoreLabel: null, runStorePick: null })
          }
        />
      ) : null}

      {type === "RACE_SHAKEOUT" ? (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-gray-900">Race registry id *</span>
            <input
              type="text"
              value={draft.raceRegistryId ?? ""}
              onChange={(e) =>
                onDraftChange({ ...draft, raceRegistryId: e.target.value.trim() || null })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-gray-600">
              Shakeout bolts to the race container — not a brand-led host.
            </span>
          </label>
          <EntitySearch
            label="Brand sponsor stamp (optional)"
            placeholder="Search brands…"
            kind="brand"
            selected={draft.runBrandPick}
            onSelect={(h) =>
              onDraftChange({
                ...draft,
                runBrandId: h.id,
                runBrandLabel: h.name,
                runBrandPick: h,
              })
            }
            onClear={() =>
              onDraftChange({ ...draft, runBrandId: null, runBrandLabel: null, runBrandPick: null })
            }
          />
        </div>
      ) : null}

      {type === "SPECIAL" ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Special event shape</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSpecialLead("floating")}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  fork.specialLeadMode === "floating"
                    ? "bg-sky-600 text-white"
                    : "bg-white text-gray-700 ring-1 ring-gray-200"
                }`}
              >
                Floating event
              </button>
              <button
                type="button"
                onClick={() => setSpecialLead("brand_popup")}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  fork.specialLeadMode === "brand_popup"
                    ? "bg-sky-600 text-white"
                    : "bg-white text-gray-700 ring-1 ring-gray-200"
                }`}
              >
                Brand-led pop-up
              </button>
            </div>
          </div>
          {fork.specialLeadMode === "brand_popup" ? (
            <EntitySearch
              label="Pop-up host brand *"
              placeholder="Search brands…"
              kind="brand"
              selected={draft.runBrandPick}
              onSelect={(h) =>
                onDraftChange({
                  ...draft,
                  runBrandId: h.id,
                  runBrandLabel: h.name,
                  runBrandPick: { ...h, secondary: h.kindLabel ?? h.secondary },
                })
              }
              onClear={() =>
                onDraftChange({
                  ...draft,
                  runBrandId: null,
                  runBrandLabel: null,
                  runBrandPick: null,
                })
              }
            />
          ) : null}
          {fork.specialLeadMode ? (
            <RunManageRunAffiliations
              draft={draft}
              onChange={onDraftChange}
              showTypePicker={false}
              scopeMode="special_partners_only"
            />
          ) : null}
        </div>
      ) : null}

      {!title.trim() ? (
        <p className="text-xs text-gray-500">Add a title above to finish scope.</p>
      ) : null}
    </div>
  );
}
