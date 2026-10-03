"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  EntitySearch,
  type AffiliationPick,
  type RunAffiliationDraft,
} from "@/components/runmanage/RunManageRunAffiliations";
import type { StaffCreateRunType } from "@/lib/runmanage/partner-extras";
import { emptyAffiliationDraft } from "@/components/runmanage/RunManageRunAffiliations";

export type HostScope = "CLUB" | "RUN_STORE" | "BRAND" | "INDIVIDUAL";

const SCOPE_OPTIONS: { id: HostScope; label: string; hint: string }[] = [
  { id: "CLUB", label: "Club", hint: "A run club is hosting." },
  { id: "RUN_STORE", label: "Run store", hint: "Store-hosted group run." },
  { id: "BRAND", label: "Brand", hint: "Brand-led run or activation." },
  { id: "INDIVIDUAL", label: "Just me", hint: "Athlete-hosted — no org required." },
];

function scopeToDraft(scope: HostScope, prev: RunAffiliationDraft): RunAffiliationDraft {
  const base = emptyAffiliationDraft(
    scope === "BRAND" ? "SPECIAL" : (scope as StaffCreateRunType)
  );
  return {
    ...base,
    runBrandId: scope === "BRAND" ? prev.runBrandId : null,
    runBrandLabel: scope === "BRAND" ? prev.runBrandLabel : null,
    runBrandPick: scope === "BRAND" ? prev.runBrandPick : null,
    runClubId: scope === "CLUB" ? prev.runClubId : null,
    runClubLabel: scope === "CLUB" ? prev.runClubLabel : null,
    runClubPick: scope === "CLUB" ? prev.runClubPick : null,
    runStoreId: scope === "RUN_STORE" ? prev.runStoreId : null,
    runStoreLabel: scope === "RUN_STORE" ? prev.runStoreLabel : null,
    runStorePick: scope === "RUN_STORE" ? prev.runStorePick : null,
    partnerExtras: prev.partnerExtras,
  };
}

export function hostScopeFromDraft(draft: RunAffiliationDraft): HostScope | null {
  if (draft.cityRunType === "CLUB") return "CLUB";
  if (draft.cityRunType === "RUN_STORE") return "RUN_STORE";
  if (draft.cityRunType === "INDIVIDUAL") return "INDIVIDUAL";
  if (draft.cityRunType === "SPECIAL" && draft.runBrandPick) return "BRAND";
  if (draft.cityRunType === "SPECIAL" && !draft.runClubPick && !draft.runStorePick) return null;
  return null;
}

export function validateHostStep(
  scope: HostScope | null,
  draft: RunAffiliationDraft
): string | null {
  if (!scope) return "Choose who is hosting.";
  if (scope === "CLUB" && !draft.runClubId) {
    return "Search the catalog and attach a club.";
  }
  if (scope === "RUN_STORE" && !draft.runStoreId) {
    return "Search the catalog and attach a run store.";
  }
  if (scope === "BRAND" && !draft.runBrandId) {
    return "Search the catalog and attach a brand.";
  }
  return null;
}

type Props = {
  draft: RunAffiliationDraft;
  onChange: (next: RunAffiliationDraft) => void;
  onScopeChange?: (scope: HostScope | null) => void;
};

export default function RunManageRunHostStep({ draft, onChange, onScopeChange }: Props) {
  const [pickedScope, setPickedScope] = useState<HostScope | null>(() =>
    hostScopeFromDraft(draft)
  );
  const activeScope = pickedScope ?? hostScopeFromDraft(draft);

  const setScope = (scope: HostScope) => {
    setPickedScope(scope);
    onScopeChange?.(scope);
    onChange(scopeToDraft(scope, draft));
  };

  useEffect(() => {
    onScopeChange?.(activeScope);
  }, [activeScope, onScopeChange]);

  const showOptionalBrand =
    draft.cityRunType !== "INDIVIDUAL" &&
    activeScope !== "BRAND" &&
    (draft.cityRunType === "CLUB" ||
      draft.cityRunType === "RUN_STORE" ||
      draft.cityRunType === "SPECIAL");

  const addExtraClub = (hit: AffiliationPick) => {
    if (draft.partnerExtras.some((e) => e.kind === "CLUB" && e.refId === hit.id)) return;
    if (draft.runClubId === hit.id) return;
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

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white px-4 py-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Host</h3>
        <p className="mt-1 text-xs text-gray-600">
          Pick who is hosting. We search one catalog at a time — nothing is linked until you attach.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SCOPE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setScope(opt.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              activeScope === opt.id
                ? "bg-sky-600 text-white"
                : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {activeScope ? (
        <p className="text-xs text-gray-600">
          {SCOPE_OPTIONS.find((o) => o.id === activeScope)?.hint}
        </p>
      ) : (
        <p className="text-xs text-amber-800">Choose Club, Run store, Brand, or Just me.</p>
      )}

      {activeScope === "CLUB" ? (
        <EntitySearch
          label="Hosting club"
          placeholder="Search clubs…"
          kind="club"
          selected={draft.runClubPick}
          onSelect={(h) =>
            onChange({
              ...draft,
              cityRunType: "CLUB",
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

      {activeScope === "RUN_STORE" ? (
        <EntitySearch
          label="Hosting store"
          placeholder="Search stores…"
          kind="store"
          selected={draft.runStorePick}
          onSelect={(h) =>
            onChange({
              ...draft,
              cityRunType: "RUN_STORE",
              runStoreId: h.id,
              runStoreLabel: h.name,
              runStorePick: h,
            })
          }
          onClear={() =>
            onChange({ ...draft, runStoreId: null, runStoreLabel: null, runStorePick: null })
          }
        />
      ) : null}

      {activeScope === "BRAND" ? (
        <EntitySearch
          label="Hosting brand"
          placeholder="Search brands…"
          kind="brand"
          selected={draft.runBrandPick}
          onSelect={(h) =>
            onChange({
              ...draft,
              cityRunType: "SPECIAL",
              runBrandId: h.id,
              runBrandLabel: h.name,
              runBrandPick: h,
            })
          }
          onClear={() =>
            onChange({ ...draft, runBrandId: null, runBrandLabel: null, runBrandPick: null })
          }
        />
      ) : null}

      {activeScope === "INDIVIDUAL" ? (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          This run will be athlete-hosted. No catalog attach required.
        </p>
      ) : null}

      {showOptionalBrand ? (
        <EntitySearch
          label="Brand partner (optional)"
          placeholder="Search brands…"
          kind="brand"
          selected={draft.runBrandPick}
          onSelect={(h) =>
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
      ) : null}

      {activeScope && activeScope !== "CLUB" ? (
        <div>
          <p className="text-sm font-medium text-gray-800">Co-host club (optional)</p>
          <EntitySearch
            label="Additional club"
            placeholder="Search another club…"
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
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...draft,
                        partnerExtras: draft.partnerExtras.filter((x) => x.refId !== e.refId),
                      })
                    }
                    aria-label="Remove"
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
