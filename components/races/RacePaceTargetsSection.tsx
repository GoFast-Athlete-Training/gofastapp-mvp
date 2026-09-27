"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import { PaceMiSplitEditor } from "@/components/workout/PaceMiSplitEditor";
import { formatSegmentDistance } from "@/lib/training/segment-summary";
import {
  formatStoredPaceAsMinPerMile,
  secondsPerMileToSecondsPerKm,
  storedPaceSecondsKmToSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";
import { parseSplitPaceToSecPerMile, secPerMileToSplitStrings } from "@/lib/workout/pace-mi-split";
import {
  apiSegmentsToFlatWorkBlocks,
  raceDaySegmentsToWorkBlocks,
  racePaceWorkBlocksToRaceDaySegments,
  tryParseTabularRacePacePaste,
  type RacePaceWorkBlock,
} from "@/lib/races/race-pace-target-paste";

const PACE_SLOT_ENC = 2 as const;

type RaceDayApply = {
  planId: string;
  dateKey: string;
  title?: string;
};

type Props = {
  raceDayApply?: RaceDayApply;
  raceTitle: string;
};

function secPerKmToPaceDisplay(value: number): string {
  return formatStoredPaceAsMinPerMile(value, PACE_SLOT_ENC);
}

function blockOneLine(block: RacePaceWorkBlock): string {
  const dist = block.miles > 0 ? formatSegmentDistance(block.miles) : "";
  const low = block.paceValueLow != null ? secPerKmToPaceDisplay(block.paceValueLow) : "";
  const high = block.paceValueHigh != null ? secPerKmToPaceDisplay(block.paceValueHigh) : "";
  const pace = low && high ? (low === high ? `${low}/mi` : `${low}-${high}/mi`) : "";
  return [block.name, dist, pace].filter(Boolean).join(" · ") || "—";
}

function blockToPaceSplitState(block: RacePaceWorkBlock | null) {
  let lowMin = "";
  let lowSec = "";
  let highMin = "";
  let highSec = "";
  if (block?.paceValueLow != null) {
    const secMi = Math.round(
      storedPaceSecondsKmToSecondsPerMile(block.paceValueLow, PACE_SLOT_ENC)
    );
    const lo = secPerMileToSplitStrings(secMi);
    lowMin = lo.min;
    lowSec = lo.sec;
  }
  if (block?.paceValueHigh != null) {
    const secMi = Math.round(
      storedPaceSecondsKmToSecondsPerMile(block.paceValueHigh, PACE_SLOT_ENC)
    );
    const hi = secPerMileToSplitStrings(secMi);
    highMin = hi.min;
    highSec = hi.sec;
  }
  return { lowMin, lowSec, highMin, highSec };
}

function applyPaceEditsToBlock(
  block: RacePaceWorkBlock,
  lowMin: string,
  lowSec: string,
  highMin: string,
  highSec: string
): RacePaceWorkBlock {
  const ctx = block.name.trim() || "Race block";
  let paceValueLow = block.paceValueLow;
  let paceValueHigh = block.paceValueHigh;
  if (!lowMin.trim() && !lowSec.trim()) {
    paceValueLow = undefined;
  } else {
    try {
      const secMiLow = parseSplitPaceToSecPerMile(lowMin, lowSec, ctx, "low");
      if (Number.isFinite(secMiLow)) {
        paceValueLow = secondsPerMileToSecondsPerKm(secMiLow);
      }
    } catch {
      /* keep */
    }
  }
  if (!highMin.trim() && !highSec.trim()) {
    paceValueHigh = undefined;
  } else {
    try {
      const secMiHigh = parseSplitPaceToSecPerMile(highMin, highSec, ctx, "high");
      if (Number.isFinite(secMiHigh)) {
        paceValueHigh = secondsPerMileToSecondsPerKm(secMiHigh);
      }
    } catch {
      /* keep */
    }
  }
  return { ...block, paceValueLow, paceValueHigh };
}

export function RacePaceTargetsSection({ raceDayApply, raceTitle }: Props) {
  const [blocks, setBlocks] = useState<RacePaceWorkBlock[]>([]);
  const [plannedWorkoutId, setPlannedWorkoutId] = useState<string | null>(null);
  const [workoutPushed, setWorkoutPushed] = useState(false);
  const [loadingState, setLoadingState] = useState(false);

  const [sourceText, setSourceText] = useState("");
  const [deriveError, setDeriveError] = useState<string | null>(null);
  const [deriving, setDeriving] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [garminConnected, setGarminConnected] = useState<boolean | null>(null);
  const [pushingGarmin, setPushingGarmin] = useState(false);
  const [garminMessage, setGarminMessage] = useState<string | null>(null);
  const [garminError, setGarminError] = useState<string | null>(null);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingPaceLowMin, setEditingPaceLowMin] = useState("");
  const [editingPaceLowSec, setEditingPaceLowSec] = useState("");
  const [editingPaceHighMin, setEditingPaceHighMin] = useState("");
  const [editingPaceHighSec, setEditingPaceHighSec] = useState("");

  const hasBlocks = blocks.some((b) => b.miles > 0);

  const loadRaceDayState = useCallback(async () => {
    if (!raceDayApply) return;
    setLoadingState(true);
    try {
      const { data } = await api.get<{
        plannedWorkoutId?: string | null;
        segments?: Array<{
          title: string;
          durationType: string;
          durationValue: number;
          targets?: Array<{ type: string; valueLow?: number; valueHigh?: number }>;
        }>;
      }>(
        `training/race-day?planId=${encodeURIComponent(raceDayApply.planId)}&date=${encodeURIComponent(raceDayApply.dateKey)}`
      );
      const wid = data.plannedWorkoutId?.trim() || null;
      setPlannedWorkoutId(wid);
      const segs = data.segments ?? [];
      if (segs.length > 0) {
        setBlocks(raceDaySegmentsToWorkBlocks(segs));
      }
      if (wid) {
        const wRes = await api.get<{ workout?: { workoutPushed?: boolean } }>(
          `/training/workout/${encodeURIComponent(wid)}`
        );
        setWorkoutPushed(wRes.data?.workout?.workoutPushed === true);
      } else {
        setWorkoutPushed(false);
      }
    } catch {
      /* optional preload */
    } finally {
      setLoadingState(false);
    }
  }, [raceDayApply]);

  useEffect(() => {
    void loadRaceDayState();
  }, [loadRaceDayState]);

  useEffect(() => {
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId) {
      setGarminConnected(false);
      return;
    }
    let cancelled = false;
    api
      .get<{ athlete?: { garmin_connected?: boolean } }>(`/athlete/${athleteId}`)
      .then((res) => {
        if (cancelled) return;
        const c = res.data?.athlete?.garmin_connected;
        setGarminConnected(typeof c === "boolean" ? c : false);
      })
      .catch(() => {
        if (!cancelled) setGarminConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (editingIndex == null) return;
    const block = blocks[editingIndex];
    if (!block) return;
    const sp = blockToPaceSplitState(block);
    setEditingPaceLowMin(sp.lowMin);
    setEditingPaceLowSec(sp.lowSec);
    setEditingPaceHighMin(sp.highMin);
    setEditingPaceHighSec(sp.highSec);
  }, [editingIndex, blocks]);

  useEffect(() => {
    if (editingIndex == null) return;
    setBlocks((prev) => {
      const block = prev[editingIndex];
      if (!block) return prev;
      const next = applyPaceEditsToBlock(
        block,
        editingPaceLowMin,
        editingPaceLowSec,
        editingPaceHighMin,
        editingPaceHighSec
      );
      if (
        next.paceValueLow === block.paceValueLow &&
        next.paceValueHigh === block.paceValueHigh
      ) {
        return prev;
      }
      const copy = [...prev];
      copy[editingIndex] = next;
      return copy;
    });
  }, [
    editingIndex,
    editingPaceLowMin,
    editingPaceLowSec,
    editingPaceHighMin,
    editingPaceHighSec,
  ]);

  const handleDerive = async () => {
    const text = sourceText.trim();
    if (!text) {
      setDeriveError("Paste pacing notes or split lines first.");
      return;
    }
    setDeriveError(null);
    setDeriving(true);
    try {
      const tabular = tryParseTabularRacePacePaste(text);
      if (tabular) {
        setBlocks(apiSegmentsToFlatWorkBlocks(tabular));
        return;
      }

      const { data } = await api.post<{
        segments: Array<{
          stepOrder: number;
          title: string;
          durationType: string;
          durationValue: number;
          targets?: Array<{ type: string; valueLow?: number; valueHigh?: number }>;
        }>;
      }>("workouts/ai-generate", { workoutType: "Race", sourceText: text });
      setBlocks(apiSegmentsToFlatWorkBlocks(data.segments ?? []));
    } catch (err: unknown) {
      setDeriveError(err instanceof Error ? err.message : "Could not parse paste.");
    } finally {
      setDeriving(false);
    }
  };

  const handleSave = async () => {
    if (!raceDayApply) return;
    const segments = racePaceWorkBlocksToRaceDaySegments(blocks);
    if (segments.length === 0) {
      setSaveError("Add at least one block with miles.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const { data } = await api.post<{ plannedWorkoutId?: string; workoutId?: string }>(
        "training/race-day",
        {
          planId: raceDayApply.planId,
          date: raceDayApply.dateKey,
          title: raceDayApply.title?.trim() || raceTitle,
          segments,
        }
      );
      const wid = data.plannedWorkoutId ?? data.workoutId ?? null;
      setPlannedWorkoutId(wid);
      setWorkoutPushed(false);
      setSaveMessage("Race pace targets saved on your race-day plan.");
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const handlePushGarmin = async () => {
    if (!plannedWorkoutId) return;
    setPushingGarmin(true);
    setGarminError(null);
    setGarminMessage(null);
    try {
      await api.post(`workouts/${encodeURIComponent(plannedWorkoutId)}/push-to-garmin`);
      setWorkoutPushed(true);
      setGarminMessage("On Garmin Connect calendar — sync your watch.");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setGarminError(ax.response?.data?.error ?? "Could not add to Garmin calendar.");
    } finally {
      setPushingGarmin(false);
    }
  };

  const showGarminButton = useMemo(
    () => Boolean(plannedWorkoutId && hasBlocks && raceDayApply),
    [plannedWorkoutId, hasBlocks, raceDayApply]
  );

  if (!raceDayApply) {
    return (
      <p className="text-sm text-gray-600">
        Link a training plan to save race pace targets and send them to Garmin.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-violet-900">
          Create Race Pace Targets
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Name each stretch of the course (all work — no warmup/cooldown slots). Paste coach notes or
          one line per block:{" "}
          <span className="font-mono text-gray-800">label | miles pace pace</span>.
        </p>
      </div>

      {!hasBlocks ? (
        <div className="rounded-lg border border-gray-200 bg-white/80 p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Paste pacing blocks</h4>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
            placeholder={"e.g. start out strong | 2 7:30 7:45\nOpen space for 5 | 5 7:00 7:15"}
          />
          {deriveError ? <p className="mt-1 text-sm text-red-600">{deriveError}</p> : null}
          <button
            type="button"
            onClick={() => void handleDerive()}
            disabled={deriving}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            {deriving ? "Parsing…" : "Parse paste"}
          </button>
        </div>
      ) : null}

      <div className="space-y-3">
        {blocks.map((block, index) => {
          const isEditing = editingIndex === index;
          return (
            <div
              key={`${block.name}-${index}`}
              className="rounded-lg border border-violet-100 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">{blockOneLine(block)}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingIndex(isEditing ? null : index)}
                    className="text-sm px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 inline-flex items-center gap-1"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {isEditing ? "Done" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBlocks((prev) => prev.filter((_, i) => i !== index));
                      if (editingIndex === index) setEditingIndex(null);
                    }}
                    className="text-sm px-2 py-1 rounded-lg text-red-700 hover:bg-red-50 inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              </div>
              {isEditing ? (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Block name</label>
                    <input
                      type="text"
                      value={block.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setBlocks((prev) => {
                          const copy = [...prev];
                          copy[index] = { ...copy[index], name };
                          return copy;
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Miles</label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={block.miles || ""}
                      onChange={(e) => {
                        const miles = parseFloat(e.target.value) || 0;
                        setBlocks((prev) => {
                          const copy = [...prev];
                          copy[index] = { ...copy[index], miles };
                          return copy;
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs font-semibold uppercase text-gray-500">Pace low</span>
                      <PaceMiSplitEditor
                        minValue={editingPaceLowMin}
                        secValue={editingPaceLowSec}
                        onMinChange={setEditingPaceLowMin}
                        onSecChange={setEditingPaceLowSec}
                      />
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase text-gray-500">Pace high</span>
                      <PaceMiSplitEditor
                        minValue={editingPaceHighMin}
                        secValue={editingPaceHighSec}
                        onMinChange={setEditingPaceHighMin}
                        onSecChange={setEditingPaceHighSec}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          setBlocks((prev) => [
            ...prev,
            { name: `Block ${prev.length + 1}`, miles: 0 },
          ]);
          setEditingIndex(blocks.length);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-violet-300 px-3 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-50"
      >
        <Plus className="w-4 h-4" />
        Add block
      </button>

      {hasBlocks ? (
        <button
          type="button"
          onClick={() => {
            setBlocks([]);
            setEditingIndex(null);
            setSourceText("");
          }}
          className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2"
        >
          Clear and paste again
        </button>
      ) : null}

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          disabled={saving || loadingState || !hasBlocks}
          onClick={() => void handleSave()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save race pace targets"}
        </button>

        {showGarminButton ? (
          <button
            type="button"
            disabled={pushingGarmin || garminConnected === false}
            onClick={() => void handlePushGarmin()}
            className="rounded-lg border border-orange-300 bg-white px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-50 disabled:opacity-50"
          >
            {pushingGarmin
              ? "Adding to calendar…"
              : workoutPushed
                ? "Re-send to Garmin calendar"
                : "Add to Garmin calendar"}
          </button>
        ) : null}
      </div>

      {saveMessage ? <p className="text-sm text-emerald-800">{saveMessage}</p> : null}
      {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
      {garminMessage ? (
        <p className="text-sm font-medium text-emerald-900 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          {garminMessage}
        </p>
      ) : null}
      {garminError ? <p className="text-sm text-red-600">{garminError}</p> : null}
      {garminConnected === false ? (
        <p className="text-sm text-gray-600">
          <Link href="/settings/garmin" className="font-semibold text-orange-600 hover:underline">
            Connect Garmin
          </Link>{" "}
          to send this race plan to your watch.
        </p>
      ) : null}
    </div>
  );
}
