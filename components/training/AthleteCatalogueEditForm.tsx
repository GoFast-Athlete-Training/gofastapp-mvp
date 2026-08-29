"use client";

import { useState } from "react";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import {
  buildAthleteCataloguePayload,
  initAthleteCatalogueFormState,
  type AthleteCatalogueFormState,
  type IntBlockSeg,
  type IntSeg,
  type MilesSeg,
} from "@/lib/training/athlete-catalogue-form-state";
import type { QualityCatalogueItem } from "@/components/training/quality-catalogue-types";

const sectionCard = "rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2";
const sectionHeaderRow = "flex flex-wrap items-end justify-between gap-2 min-h-7";

type Props = {
  workoutType: "Tempo" | "Intervals";
  aiPrefill: Record<string, unknown>;
  getToken: () => Promise<string>;
  onCancel: () => void;
  onSaved: (item: QualityCatalogueItem) => void;
};

export function AthleteCatalogueEditForm({
  workoutType,
  aiPrefill,
  getToken,
  onCancel,
  onSaved,
}: Props) {
  const [form, setForm] = useState<AthleteCatalogueFormState>(() =>
    initAthleteCatalogueFormState(aiPrefill, workoutType)
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const wt = form.workoutType;
  const is5K = form.paceAnchor === "currentBuildup";
  const isMP = form.paceAnchor === "mpSimulation";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setErr("Name is required");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const parsedFields = buildAthleteCataloguePayload(form);
      const token = await getToken();
      const res = await fetch("/api/workouts/athlete-catalogue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...athleteBearerFetchHeaders(token),
        },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          workoutType: wt,
          parsedFields,
        }),
      });
      const data = (await res.json()) as { item?: QualityCatalogueItem; error?: string };
      if (!res.ok || !data.item) {
        throw new Error(data.error ?? "Save failed");
      }
      await onSaved(data.item);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-orange-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">AI-generated entry — review and save</h3>
      <p className="mt-1 text-xs text-purple-700">
        Fields pre-filled by AI. Review warmup, work, and cooldown before saving.
      </p>

      <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-4 text-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-gray-600">Name</span>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-gray-600">Run sub-type (optional)</span>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.runSubType}
              onChange={(e) => setForm((f) => ({ ...f, runSubType: e.target.value }))}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-gray-600">Description (optional)</span>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-gray-600">Purpose (optional)</span>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
              value={form.purpose}
              onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
            />
          </label>
        </div>

        {wt === "Tempo" ? (
          <div>
            <span className="mb-2 block text-xs font-medium text-gray-600">Pace anchor</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, paceAnchor: "currentBuildup" }))}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  is5K ? "bg-orange-100 text-orange-900 ring-2 ring-orange-400" : "bg-gray-100 text-gray-600"
                }`}
              >
                5K / fitness
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, paceAnchor: "mpSimulation" }))}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  isMP ? "bg-orange-100 text-orange-900 ring-2 ring-orange-400" : "bg-gray-100 text-gray-600"
                }`}
              >
                Marathon / goal race
              </button>
            </div>
          </div>
        ) : null}

        {wt === "Tempo" && is5K ? <Tempo5kSections form={form} setForm={setForm} /> : null}
        {wt === "Tempo" && isMP ? <TempoMpSections form={form} setForm={setForm} /> : null}
        {wt === "Intervals" ? <IntervalsSections form={form} setForm={setForm} /> : null}

        {err ? <p className="text-sm text-red-700">{err}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save to my catalogue"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function WarmupCard({
  form,
  setForm,
}: {
  form: AthleteCatalogueFormState;
  setForm: React.Dispatch<React.SetStateAction<AthleteCatalogueFormState>>;
}) {
  return (
    <div className={sectionCard}>
      <div className={sectionHeaderRow}>
        <h4 className="text-sm font-semibold text-gray-900">Warmup</h4>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={form.noWarmup}
            onChange={(e) => {
              const v = e.target.checked;
              setForm((f) => ({
                ...f,
                noWarmup: v,
                ...(v ? { warmupMiles: "", warmupPaceOffsetSecPerMile: "" } : {}),
              }));
            }}
          />
          No warmup
        </label>
      </div>
      {!form.noWarmup ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label>
            <span className="text-xs text-gray-500">Miles</span>
            <input
              className="w-full rounded border border-gray-300 px-2 py-1.5"
              value={form.warmupMiles}
              onChange={(e) => setForm((f) => ({ ...f, warmupMiles: e.target.value }))}
            />
          </label>
          <label>
            <span className="text-xs text-gray-500">Pace offset (sec/mi)</span>
            <input
              className="w-full rounded border border-gray-300 px-2 py-1.5"
              value={form.warmupPaceOffsetSecPerMile}
              onChange={(e) => setForm((f) => ({ ...f, warmupPaceOffsetSecPerMile: e.target.value }))}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function CooldownCard({
  form,
  setForm,
}: {
  form: AthleteCatalogueFormState;
  setForm: React.Dispatch<React.SetStateAction<AthleteCatalogueFormState>>;
}) {
  return (
    <div className={sectionCard}>
      <div className={sectionHeaderRow}>
        <h4 className="text-sm font-semibold text-gray-900">Cooldown</h4>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={form.noCooldown}
            onChange={(e) => {
              const v = e.target.checked;
              setForm((f) => ({
                ...f,
                noCooldown: v,
                ...(v ? { cooldownMiles: "", cooldownPaceOffsetSecPerMile: "" } : {}),
              }));
            }}
          />
          No cooldown
        </label>
      </div>
      {!form.noCooldown ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label>
            <span className="text-xs text-gray-500">Miles</span>
            <input
              className="w-full rounded border border-gray-300 px-2 py-1.5"
              value={form.cooldownMiles}
              onChange={(e) => setForm((f) => ({ ...f, cooldownMiles: e.target.value }))}
            />
          </label>
          <label>
            <span className="text-xs text-gray-500">Pace offset (sec/mi)</span>
            <input
              className="w-full rounded border border-gray-300 px-2 py-1.5"
              value={form.cooldownPaceOffsetSecPerMile}
              onChange={(e) => setForm((f) => ({ ...f, cooldownPaceOffsetSecPerMile: e.target.value }))}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function Tempo5kSections({
  form,
  setForm,
}: {
  form: AthleteCatalogueFormState;
  setForm: React.Dispatch<React.SetStateAction<AthleteCatalogueFormState>>;
}) {
  return (
    <div className="space-y-3">
      <WarmupCard form={form} setForm={setForm} />
      <div className={sectionCard}>
        <div className={sectionHeaderRow}>
          <h4 className="text-sm font-semibold text-gray-900">Work</h4>
          <div className="flex flex-wrap gap-2">
            {(["simple", "segments", "blockRepeat"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setForm((f) => ({ ...f, tempo5kMode: mode }))}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  form.tempo5kMode === mode
                    ? "bg-orange-100 text-orange-900 ring-1 ring-orange-300"
                    : "bg-white text-gray-600 ring-1 ring-slate-200"
                }`}
              >
                {mode === "simple" ? "Steady" : mode === "segments" ? "Progression" : "Repeat group"}
              </button>
            ))}
          </div>
        </div>
        {form.tempo5kMode === "simple" ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label>
              <span className="text-xs text-gray-500">Work miles</span>
              <input
                className="w-full rounded border border-gray-300 px-2 py-1.5"
                value={form.workBaseMiles}
                onChange={(e) => setForm((f) => ({ ...f, workBaseMiles: e.target.value }))}
              />
            </label>
            <label>
              <span className="text-xs text-gray-500">Work pace offset (sec/mi)</span>
              <input
                className="w-full rounded border border-gray-300 px-2 py-1.5"
                value={form.workPaceOffsetSecPerMile}
                onChange={(e) => setForm((f) => ({ ...f, workPaceOffsetSecPerMile: e.target.value }))}
              />
            </label>
          </div>
        ) : null}
        {form.tempo5kMode === "segments" ? (
          <MilesSegEditor
            rows={form.tempoMilesSegs}
            onChange={(tempoMilesSegs) => setForm((f) => ({ ...f, tempoMilesSegs }))}
          />
        ) : null}
        {form.tempo5kMode === "blockRepeat" ? (
          <BlockRepeatEditor
            segs={form.tempoBlockSegs}
            repeatCount={form.tempoBlockRepeatCount}
            recoverySec={form.tempoBlockRecoverySec}
            onSegsChange={(tempoBlockSegs) => setForm((f) => ({ ...f, tempoBlockSegs }))}
            onRepeatChange={(tempoBlockRepeatCount) => setForm((f) => ({ ...f, tempoBlockRepeatCount }))}
            onRecoveryChange={(tempoBlockRecoverySec) => setForm((f) => ({ ...f, tempoBlockRecoverySec }))}
          />
        ) : null}
      </div>
      <CooldownCard form={form} setForm={setForm} />
    </div>
  );
}

function TempoMpSections({
  form,
  setForm,
}: {
  form: AthleteCatalogueFormState;
  setForm: React.Dispatch<React.SetStateAction<AthleteCatalogueFormState>>;
}) {
  return (
    <div className="space-y-3">
      <div className={sectionCard}>
        <h4 className="text-sm font-semibold text-gray-900">Warmup %</h4>
        <input
          className="w-full max-w-xs rounded border border-gray-300 px-2 py-1.5"
          value={form.warmupFractionPct}
          onChange={(e) => setForm((f) => ({ ...f, warmupFractionPct: e.target.value }))}
        />
      </div>
      <div className={sectionCard}>
        <h4 className="text-sm font-semibold text-gray-900">Work at goal MP %</h4>
        <input
          className="w-full max-w-xs rounded border border-gray-300 px-2 py-1.5"
          value={form.workFractionPct}
          onChange={(e) => setForm((f) => ({ ...f, workFractionPct: e.target.value }))}
        />
      </div>
      <div className={sectionCard}>
        <h4 className="text-sm font-semibold text-gray-900">Cooldown %</h4>
        <input
          className="w-full max-w-xs rounded border border-gray-300 px-2 py-1.5"
          value={form.cooldownFractionPct}
          onChange={(e) => setForm((f) => ({ ...f, cooldownFractionPct: e.target.value }))}
        />
      </div>
    </div>
  );
}

function IntervalsSections({
  form,
  setForm,
}: {
  form: AthleteCatalogueFormState;
  setForm: React.Dispatch<React.SetStateAction<AthleteCatalogueFormState>>;
}) {
  return (
    <div className="space-y-3">
      <WarmupCard form={form} setForm={setForm} />
      <div className={sectionCard}>
        <div className={sectionHeaderRow}>
          <h4 className="text-sm font-semibold text-gray-900">Work</h4>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, intervalMode: "flat" }))}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                form.intervalMode === "flat"
                  ? "bg-orange-100 text-orange-900 ring-1 ring-orange-300"
                  : "bg-white text-gray-600 ring-1 ring-slate-200"
              }`}
            >
              Rep ladder
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, intervalMode: "blockRepeat" }))}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                form.intervalMode === "blockRepeat"
                  ? "bg-orange-100 text-orange-900 ring-1 ring-orange-300"
                  : "bg-white text-gray-600 ring-1 ring-slate-200"
              }`}
            >
              Block repeat
            </button>
          </div>
        </div>
        {form.intervalMode === "flat" ? (
          <>
            <IntSegEditor
              rows={form.intervalSegs}
              onChange={(intervalSegs) => setForm((f) => ({ ...f, intervalSegs }))}
            />
            <div className="mt-3 border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-gray-800">Recovery between reps</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label>
                  <span className="text-xs text-gray-500">Time (sec)</span>
                  <input
                    className="w-full rounded border border-gray-300 px-2 py-1.5"
                    value={form.recoveryDurationSeconds}
                    onChange={(e) => setForm((f) => ({ ...f, recoveryDurationSeconds: e.target.value }))}
                  />
                </label>
                <label>
                  <span className="text-xs text-gray-500">Distance (m)</span>
                  <input
                    className="w-full rounded border border-gray-300 px-2 py-1.5"
                    value={form.recoveryDistanceMeters}
                    onChange={(e) => setForm((f) => ({ ...f, recoveryDistanceMeters: e.target.value }))}
                  />
                </label>
                <label>
                  <span className="text-xs text-gray-500">Recovery pace offset</span>
                  <input
                    className="w-full rounded border border-gray-300 px-2 py-1.5"
                    value={form.recoveryPaceOffsetSecPerMile}
                    onChange={(e) => setForm((f) => ({ ...f, recoveryPaceOffsetSecPerMile: e.target.value }))}
                  />
                </label>
              </div>
            </div>
          </>
        ) : (
          <IntervalBlockEditor
            segs={form.intervalBlockSegs}
            repeatCount={form.intervalBlockRepeatCount}
            recoverySec={form.intervalBlockRecoverySec}
            onSegsChange={(intervalBlockSegs) => setForm((f) => ({ ...f, intervalBlockSegs }))}
            onRepeatChange={(intervalBlockRepeatCount) =>
              setForm((f) => ({ ...f, intervalBlockRepeatCount }))
            }
            onRecoveryChange={(intervalBlockRecoverySec) =>
              setForm((f) => ({ ...f, intervalBlockRecoverySec }))
            }
          />
        )}
      </div>
      <CooldownCard form={form} setForm={setForm} />
    </div>
  );
}

function MilesSegEditor({
  rows,
  onChange,
}: {
  rows: MilesSeg[];
  onChange: (rows: MilesSeg[]) => void;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <label>
            <span className="text-xs text-gray-500">Miles</span>
            <input
              className="block w-24 rounded border border-gray-300 px-2 py-1"
              value={row.miles}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, miles: e.target.value };
                onChange(next);
              }}
            />
          </label>
          <label>
            <span className="text-xs text-gray-500">Offset (sec/mi)</span>
            <input
              className="block w-28 rounded border border-gray-300 px-2 py-1"
              value={row.pace}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, pace: e.target.value };
                onChange(next);
              }}
            />
          </label>
          <button
            type="button"
            className="text-xs text-red-600"
            onClick={() => {
              const next = rows.filter((_, j) => j !== i);
              onChange(next.length ? next : [{ miles: "", paceKey: "", pace: "" }]);
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm font-semibold text-orange-700"
        onClick={() => onChange([...rows, { miles: "", paceKey: "", pace: "" }])}
      >
        + Add segment
      </button>
    </div>
  );
}

function BlockRepeatEditor({
  segs,
  repeatCount,
  recoverySec,
  onSegsChange,
  onRepeatChange,
  onRecoveryChange,
}: {
  segs: MilesSeg[];
  repeatCount: string;
  recoverySec: string;
  onSegsChange: (segs: MilesSeg[]) => void;
  onRepeatChange: (v: string) => void;
  onRecoveryChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <MilesSegEditor rows={segs} onChange={onSegsChange} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label>
          <span className="text-xs text-gray-500">Repeat count</span>
          <input
            className="w-full rounded border border-gray-300 px-2 py-1.5"
            value={repeatCount}
            onChange={(e) => onRepeatChange(e.target.value)}
          />
        </label>
        <label>
          <span className="text-xs text-gray-500">Recovery between cycles (sec)</span>
          <input
            className="w-full rounded border border-gray-300 px-2 py-1.5"
            value={recoverySec}
            onChange={(e) => onRecoveryChange(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

function IntSegEditor({
  rows,
  onChange,
}: {
  rows: IntSeg[];
  onChange: (rows: IntSeg[]) => void;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <label>
            <span className="text-xs text-gray-500">Distance (m)</span>
            <input
              className="block w-28 rounded border border-gray-300 px-2 py-1"
              value={row.distanceMeters}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, distanceMeters: e.target.value };
                onChange(next);
              }}
            />
          </label>
          <label>
            <span className="text-xs text-gray-500">Offset (sec/mi)</span>
            <input
              className="block w-24 rounded border border-gray-300 px-2 py-1"
              value={row.pace}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, pace: e.target.value };
                onChange(next);
              }}
            />
          </label>
          <label>
            <span className="text-xs text-gray-500">Reps</span>
            <input
              className="block w-16 rounded border border-gray-300 px-2 py-1"
              value={row.reps}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, reps: e.target.value };
                onChange(next);
              }}
            />
          </label>
          <button
            type="button"
            className="text-xs text-red-600"
            onClick={() => {
              const next = rows.filter((_, j) => j !== i);
              onChange(
                next.length ? next : [{ distanceMeters: "", paceKey: "", pace: "", reps: "1" }]
              );
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm font-semibold text-orange-700"
        onClick={() =>
          onChange([...rows, { distanceMeters: "", paceKey: "", pace: "", reps: "1" }])
        }
      >
        + Add rep group
      </button>
    </div>
  );
}

function IntervalBlockEditor({
  segs,
  repeatCount,
  recoverySec,
  onSegsChange,
  onRepeatChange,
  onRecoveryChange,
}: {
  segs: IntBlockSeg[];
  repeatCount: string;
  recoverySec: string;
  onSegsChange: (segs: IntBlockSeg[]) => void;
  onRepeatChange: (v: string) => void;
  onRecoveryChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      {segs.map((row, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <label>
            <span className="text-xs text-gray-500">Distance (m)</span>
            <input
              className="block w-28 rounded border border-gray-300 px-2 py-1"
              value={row.distanceMeters}
              onChange={(e) => {
                const next = [...segs];
                next[i] = { ...row, distanceMeters: e.target.value };
                onSegsChange(next);
              }}
            />
          </label>
          <label>
            <span className="text-xs text-gray-500">Offset (sec/mi)</span>
            <input
              className="block w-28 rounded border border-gray-300 px-2 py-1"
              value={row.pace}
              onChange={(e) => {
                const next = [...segs];
                next[i] = { ...row, pace: e.target.value };
                onSegsChange(next);
              }}
            />
          </label>
          <button
            type="button"
            className="text-xs text-red-600"
            onClick={() => {
              const next = segs.filter((_, j) => j !== i);
              onSegsChange(
                next.length ? next : [{ distanceMeters: "", paceKey: "", pace: "" }]
              );
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm font-semibold text-orange-700"
        onClick={() => onSegsChange([...segs, { distanceMeters: "", paceKey: "", pace: "" }])}
      >
        + Add segment
      </button>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label>
          <span className="text-xs text-gray-500">Repeat count</span>
          <input
            className="w-full rounded border border-gray-300 px-2 py-1.5"
            value={repeatCount}
            onChange={(e) => onRepeatChange(e.target.value)}
          />
        </label>
        <label>
          <span className="text-xs text-gray-500">Recovery between cycles (sec)</span>
          <input
            className="w-full rounded border border-gray-300 px-2 py-1.5"
            value={recoverySec}
            onChange={(e) => onRecoveryChange(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
