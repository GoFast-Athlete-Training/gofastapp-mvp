"use client";

import { Loader2, X } from "lucide-react";
import {
  EntitySearch,
  type AffiliationPick,
  type RunAffiliationDraft,
} from "@/components/runmanage/RunManageRunAffiliations";

type Props = {
  cityRunType: string | null | undefined;
  draft: RunAffiliationDraft;
  onChange: (next: RunAffiliationDraft) => void;
  saving?: boolean;
  onSave?: () => void | Promise<void>;
  error?: string | null;
  message?: string | null;
};

export default function RunManageAssociateStep({
  cityRunType,
  draft,
  onChange,
  saving,
  onSave,
  error,
  message,
}: Props) {
  const isShakeout = cityRunType === "RACE_SHAKEOUT";
  const isSpecial = cityRunType === "SPECIAL";
  const isClub = cityRunType === "CLUB";

  const addExtraClub = (hit: AffiliationPick) => {
    if (draft.partnerExtras.some((e) => e.kind === "CLUB" && e.refId === hit.id)) return;
    onChange({
      ...draft,
      partnerExtras: [
        ...draft.partnerExtras,
        {
          kind: "CLUB",
          refId: hit.id,
          nameSnapshot: hit.name,
          logoUrlSnapshot: hit.logoUrl ?? null,
        },
      ],
    });
  };

  const removeExtra = (refId: string) => {
    onChange({
      ...draft,
      partnerExtras: draft.partnerExtras.filter((e) => e.refId !== refId),
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white px-4 py-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Associate</h3>
        <p className="mt-1 text-xs text-gray-600">
          Optional partners on this run. Does not change the container or run type.
        </p>
      </div>

      {(isShakeout || isClub) ? (
        <EntitySearch
          label={isClub ? "Hosting club (optional)" : "Hosting club"}
          placeholder="Search clubs…"
          kind="club"
          selected={draft.runClubPick}
          onSelect={(h: AffiliationPick) =>
            onChange({
              ...draft,
              runClubId: h.id,
              runClubLabel: h.name,
              runClubPick: h,
            })
          }
          onClear={() =>
            onChange({ ...draft, runClubId: null, runClubLabel: null, runClubPick: null })
          }
        />
      ) : null}

      <EntitySearch
        label={isSpecial ? "Brand lead (optional)" : "Brand stamp"}
        placeholder="Search brands…"
        kind="brand"
        selected={draft.runBrandPick}
        onSelect={(h: AffiliationPick) =>
          onChange({
            ...draft,
            runBrandId: h.id,
            runBrandLabel: h.name,
            runBrandPick: h,
          })
        }
        onClear={() =>
          onChange({ ...draft, runBrandId: null, runBrandLabel: null, runBrandPick: null })
        }
      />

      {isSpecial ? (
        <div>
          <p className="text-sm font-medium text-gray-800">Affiliated clubs</p>
          <EntitySearch
            label="Add club"
            placeholder="Search clubs…"
            kind="club"
            selected={null}
            onSelect={addExtraClub}
            onClear={() => {}}
          />
          {draft.partnerExtras.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {draft.partnerExtras.map((e) => (
                <li
                  key={e.refId}
                  className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                >
                  <span>{e.nameSnapshot}</span>
                  <button type="button" onClick={() => removeExtra(e.refId)} aria-label="Remove">
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      {onSave ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save associates
        </button>
      ) : (
        <p className="text-xs text-gray-500">Stamps apply when you create or save the run.</p>
      )}
    </div>
  );
}
