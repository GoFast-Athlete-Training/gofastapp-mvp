"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import { PaceMiSplitEditor } from "@/components/workout/PaceMiSplitEditor";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { parseSplitPaceToSecPerMile, secPerMileToSplitStrings } from "@/lib/workout/pace-mi-split";
import {
  EMPTY_RACE_PLAN,
  formatBlockMileRange,
  formatBlockPaceBand,
  type RacePlanBlock,
  type RacePlanDocument,
} from "@/lib/races/race-plan-types";

type RacePlanContext = {
  athleteRaceId: string;
  raceDate: string;
  planId?: string | null;
  title?: string;
};

type Props = {
  racePlanContext: RacePlanContext;
  raceTitle: string;
  /** Hide top chrome when nested in My Race plan fork. */
  embedded?: boolean;
};

function newBlock(index: number, prevEnd = 0): RacePlanBlock {
  return {
    mileStart: prevEnd,
    mileEnd: prevEnd + 3,
    paceLow: "",
    paceHigh: "",
    effort: "",
    instruction: "",
    cue: `Block ${index + 1}`,
  };
}

function blockPaceSplitState(block: RacePlanBlock) {
  let lowMin = "";
  let lowSec = "";
  let highMin = "";
  let highSec = "";
  if (block.paceLow) {
    try {
      const sec = parsePaceToSecondsPerMile(block.paceLow);
      const lo = secPerMileToSplitStrings(sec);
      lowMin = lo.min;
      lowSec = lo.sec;
    } catch {
      /* keep */
    }
  }
  if (block.paceHigh) {
    try {
      const sec = parsePaceToSecondsPerMile(block.paceHigh);
      const hi = secPerMileToSplitStrings(sec);
      highMin = hi.min;
      highSec = hi.sec;
    } catch {
      /* keep */
    }
  }
  return { lowMin, lowSec, highMin, highSec };
}

function defaultRacePlanTitle(context: RacePlanContext, raceTitle: string): string {
  return context.title?.trim() || raceTitle.trim() || "Race plan";
}

function formatRaceDayLabel(raw: string): string {
  const s = raw.trim();
  if (!s) return "Race day";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return s;
}

function applyPaceEdits(block: RacePlanBlock, lowMin: string, lowSec: string, highMin: string, highSec: string): RacePlanBlock {
  const ctx = block.cue.trim() || "Race block";
  let paceLow = block.paceLow;
  let paceHigh = block.paceHigh;
  if (!lowMin.trim() && !lowSec.trim()) {
    paceLow = "";
  } else {
    try {
      const sec = parseSplitPaceToSecPerMile(lowMin, lowSec, ctx, "low");
      const parts = secPerMileToSplitStrings(sec);
      paceLow = `${parts.min}:${parts.sec.padStart(2, "0")}`;
    } catch {
      /* keep */
    }
  }
  if (!highMin.trim() && !highSec.trim()) {
    paceHigh = "";
  } else {
    try {
      const sec = parseSplitPaceToSecPerMile(highMin, highSec, ctx, "high");
      const parts = secPerMileToSplitStrings(sec);
      paceHigh = `${parts.min}:${parts.sec.padStart(2, "0")}`;
    } catch {
      /* keep */
    }
  }
  return { ...block, paceLow, paceHigh };
}

export function RacePaceTargetsSection({ racePlanContext, raceTitle, embedded }: Props) {
  const [plan, setPlan] = useState<RacePlanDocument>({ ...EMPTY_RACE_PLAN });
  const [racePlanId, setRacePlanId] = useState<string | null>(null);
  const [workoutTitle, setWorkoutTitle] = useState("");
  const [garminPushedAt, setGarminPushedAt] = useState<string | null>(null);
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

  const hasBlocks = plan.blocks.some((b) => b.mileEnd > b.mileStart);

  const defaultPlanTitle = useMemo(
    () => defaultRacePlanTitle(racePlanContext, raceTitle),
    [racePlanContext, raceTitle]
  );

  const garminWorkoutTitle = useMemo(
    () => workoutTitle.trim() || defaultPlanTitle,
    [workoutTitle, defaultPlanTitle]
  );

  const garminCalendarDayLabel = useMemo(
    () => formatRaceDayLabel(racePlanContext.raceDate),
    [racePlanContext.raceDate]
  );

  const loadRacePlan = useCallback(async () => {
    setLoadingState(true);
    try {
      const { data } = await api.get<{
        racePlanId?: string | null;
        title?: string | null;
        planJson?: RacePlanDocument;
        pushedAt?: string | null;
      }>(
        `/races/race-plan?athleteRaceId=${encodeURIComponent(racePlanContext.athleteRaceId)}`
      );
      setRacePlanId(data.racePlanId?.trim() || null);
      setWorkoutTitle(data.title?.trim() || defaultRacePlanTitle(racePlanContext, raceTitle));
      setGarminPushedAt(data.pushedAt?.trim() || null);
      if (data.planJson?.blocks?.length) {
        setPlan(data.planJson);
      }
    } catch {
      /* optional preload */
    } finally {
      setLoadingState(false);
    }
  }, [racePlanContext, raceTitle]);

  useEffect(() => {
    void loadRacePlan();
  }, [loadRacePlan]);

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
    const block = plan.blocks[editingIndex];
    if (!block) return;
    const sp = blockPaceSplitState(block);
    setEditingPaceLowMin(sp.lowMin);
    setEditingPaceLowSec(sp.lowSec);
    setEditingPaceHighMin(sp.highMin);
    setEditingPaceHighSec(sp.highSec);
  }, [editingIndex, plan.blocks]);

  useEffect(() => {
    if (editingIndex == null) return;
    setPlan((prev) => {
      const block = prev.blocks[editingIndex];
      if (!block) return prev;
      const nextBlock = applyPaceEdits(
        block,
        editingPaceLowMin,
        editingPaceLowSec,
        editingPaceHighMin,
        editingPaceHighSec
      );
      if (nextBlock === block) return prev;
      const copy = [...prev.blocks];
      copy[editingIndex] = nextBlock;
      return { ...prev, blocks: copy };
    });
  }, [editingIndex, editingPaceLowMin, editingPaceLowSec, editingPaceHighMin, editingPaceHighSec]);

  const handleDerive = async () => {
    const text = sourceText.trim();
    if (!text) {
      setDeriveError("Paste your race plan first.");
      return;
    }
    setDeriveError(null);
    setDeriving(true);
    try {
      const { data } = await api.post<{ planJson: RacePlanDocument }>("races/race-plan/parse", {
        sourceText: text,
      });
      setPlan(data.planJson);
      setRacePlanId(null);
      setWorkoutTitle(defaultPlanTitle);
      setGarminPushedAt(null);
      setSaveMessage(null);
      setSaveError(null);
      setGarminMessage(null);
      setGarminError(null);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setDeriveError(ax.response?.data?.error ?? "Could not parse race plan.");
    } finally {
      setDeriving(false);
    }
  };

  const persistRacePlan = async (): Promise<string | null> => {
    const title = workoutTitle.trim() || defaultPlanTitle;
    const { data } = await api.post<{ racePlanId?: string }>("races/race-plan", {
      athleteRaceId: racePlanContext.athleteRaceId,
      planId: racePlanContext.planId ?? null,
      title,
      raceDate: racePlanContext.raceDate,
      planJson: plan,
    });
    const id = data.racePlanId?.trim() || null;
    setRacePlanId(id);
    setWorkoutTitle(title);
    return id;
  };

  const handleSave = async () => {
    if (!hasBlocks) {
      setSaveError("Add at least one block with a mile range.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    setGarminMessage(null);
    try {
      const id = await persistRacePlan();
      if (!id) {
        setSaveError("Could not save race plan.");
        return;
      }
      setSaveMessage(
        "Race plan saved to this race. You can send it to Garmin below whenever you're ready."
      );
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setSaveError(ax.response?.data?.error ?? "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const handlePushGarmin = async () => {
    setPushingGarmin(true);
    setGarminError(null);
    setGarminMessage(null);
    try {
      const id = await persistRacePlan();
      if (!id) {
        setGarminError("Could not save your race plan before sending to Garmin.");
        return;
      }
      const { data: pushData } = await api.post<{ scheduledDate?: string }>(
        `races/race-plan/${encodeURIComponent(id)}/push-to-garmin`
      );
      const scheduled =
        pushData.scheduledDate?.trim() ?
          formatRaceDayLabel(pushData.scheduledDate)
        : garminCalendarDayLabel;
      setGarminPushedAt(new Date().toISOString());
      setGarminMessage(
        `Sent to Garmin as “${garminWorkoutTitle}” on ${scheduled}. Sync your watch to load the workout.`
      );
      setSaveMessage("Race plan saved and sent to Garmin.");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setGarminError(ax.response?.data?.error ?? "Could not send to Garmin.");
    } finally {
      setPushingGarmin(false);
    }
  };

  const showGarminButton = useMemo(() => Boolean(hasBlocks), [hasBlocks]);

  return (
    <div className="space-y-4">
      {embedded ? null : (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-violet-900">
            Create Race Pace Targets
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Paste a coach BLOCK plan or mile CSV (mile_start, mile_end, pace_min, pace_max, focus).
            Each row or block becomes a Garmin work step on race day.
          </p>
        </div>
      )}

      {!hasBlocks ? (
        <div className="rounded-lg border border-gray-200 bg-white/80 p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Paste race plan</h4>
          <p className="mb-2 text-xs text-gray-600">
            CSV: mile_start,mile_end,target_pace,pace_min,pace_max,focus — or BLOCK headers with Target
            Pace lines.
          </p>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 font-mono"
            placeholder={
              "mile_start,mile_end,pace_min,pace_max,focus\n0,1,6:53,7:03,\"Opening mile\"\n\n— or —\n\nBLOCK 1 — Miles 0.0 to 3.0\nTarget Pace: 7:03-7:07/mi"
            }
          />
          {deriveError ? <p className="mt-1 text-sm text-red-600">{deriveError}</p> : null}
          <button
            type="button"
            onClick={() => void handleDerive()}
            disabled={deriving}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            {deriving ? "Parsing…" : "Parse race plan"}
          </button>
        </div>
      ) : null}

      {plan.goal ? (
        <div className="rounded-lg border border-violet-100 bg-violet-50/40 px-4 py-3">
          <p className="text-xs font-semibold uppercase text-violet-800">Goal</p>
          <p className="text-sm text-gray-800 mt-1">{plan.goal}</p>
        </div>
      ) : null}

      <div className="space-y-3">
        {plan.blocks.map((block, index) => {
          const isEditing = editingIndex === index;
          return (
            <div
              key={`${block.cue}-${index}`}
              className="rounded-lg border border-violet-100 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-violet-900">{block.cue || `Block ${index + 1}`}</p>
                  <p className="text-sm text-gray-700 mt-0.5">
                    Miles {formatBlockMileRange(block)}
                    {block.paceLow && block.paceHigh ? ` · ${formatBlockPaceBand(block)}` : ""}
                  </p>
                  {block.effort ? (
                    <p className="text-xs text-gray-600 mt-1">
                      <span className="font-semibold">Effort:</span> {block.effort}
                    </p>
                  ) : null}
                  {block.instruction ? (
                    <p className="text-sm text-gray-800 mt-2">{block.instruction}</p>
                  ) : null}
                </div>
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
                      setPlan((prev) => ({
                        ...prev,
                        blocks: prev.blocks.filter((_, i) => i !== index),
                      }));
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
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cue</label>
                    <input
                      type="text"
                      value={block.cue}
                      onChange={(e) => {
                        const cue = e.target.value;
                        setPlan((prev) => {
                          const copy = [...prev.blocks];
                          copy[index] = { ...copy[index]!, cue };
                          return { ...prev, blocks: copy };
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Mile start</label>
                    <input
                      type="number"
                      step="0.1"
                      value={block.mileStart}
                      onChange={(e) => {
                        const mileStart = parseFloat(e.target.value) || 0;
                        setPlan((prev) => {
                          const copy = [...prev.blocks];
                          copy[index] = { ...copy[index]!, mileStart };
                          return { ...prev, blocks: copy };
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Mile end</label>
                    <input
                      type="number"
                      step="0.1"
                      value={block.mileEnd}
                      onChange={(e) => {
                        const mileEnd = parseFloat(e.target.value) || 0;
                        setPlan((prev) => {
                          const copy = [...prev.blocks];
                          copy[index] = { ...copy[index]!, mileEnd };
                          return { ...prev, blocks: copy };
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Effort</label>
                    <input
                      type="text"
                      value={block.effort}
                      onChange={(e) => {
                        const effort = e.target.value;
                        setPlan((prev) => {
                          const copy = [...prev.blocks];
                          copy[index] = { ...copy[index]!, effort };
                          return { ...prev, blocks: copy };
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Instruction</label>
                    <textarea
                      rows={2}
                      value={block.instruction}
                      onChange={(e) => {
                        const instruction = e.target.value;
                        setPlan((prev) => {
                          const copy = [...prev.blocks];
                          copy[index] = { ...copy[index]!, instruction };
                          return { ...prev, blocks: copy };
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

      {plan.primaryRule ? (
        <div className="rounded-lg border border-amber-100 bg-amber-50/50 px-4 py-3">
          <p className="text-xs font-semibold uppercase text-amber-900">Primary rule</p>
          <p className="text-sm text-gray-800 mt-1">{plan.primaryRule}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          const prevEnd = plan.blocks.length ? plan.blocks[plan.blocks.length - 1]!.mileEnd : 0;
          setPlan((prev) => ({
            ...prev,
            blocks: [...prev.blocks, newBlock(prev.blocks.length, prevEnd)],
          }));
          setEditingIndex(plan.blocks.length);
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
            setPlan({ ...EMPTY_RACE_PLAN });
            setEditingIndex(null);
            setSourceText("");
            setWorkoutTitle(defaultPlanTitle);
            setRacePlanId(null);
            setGarminPushedAt(null);
          }}
          className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2"
        >
          Clear and paste again
        </button>
      ) : null}

      {hasBlocks ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-3 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Save and send</p>
            <p className="mt-1 text-xs text-gray-600">
              <strong>Parse</strong> only loads a preview in this browser.{" "}
              <strong>Save race plan</strong> stores it on your {raceTitle} signup so it reloads
              next time. <strong>Send to Garmin</strong> saves the latest blocks and creates watch
              workout steps (connect Garmin in Settings if the button is disabled).
            </p>
          </div>
          <div>
            <label htmlFor="race-plan-workout-title" className="block text-sm font-semibold text-gray-900">
              Garmin workout name
            </label>
            <p className="mt-0.5 text-xs text-gray-600 mb-1.5">
              Saved with your plan and used as the workout title in Garmin Connect (e.g.{" "}
              {defaultPlanTitle} — 3:02).
            </p>
            <input
              id="race-plan-workout-title"
              type="text"
              value={workoutTitle}
              onChange={(e) => setWorkoutTitle(e.target.value)}
              maxLength={120}
              placeholder={defaultPlanTitle}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50/60 px-3 py-2.5 text-xs text-gray-800 space-y-1">
            <p className="font-semibold text-orange-950">What Garmin will show</p>
            <p>
              <span className="text-gray-600">Workout name</span>{" "}
              <span className="font-medium text-gray-900">{garminWorkoutTitle}</span>
            </p>
            <p>
              <span className="text-gray-600">Calendar day</span>{" "}
              <span className="font-medium text-gray-900">{garminCalendarDayLabel}</span>
              <span className="text-gray-500"> — your race date on the plan</span>
            </p>
            <p className="text-gray-600">
              Each mile block becomes one work step; the block title (cue/focus) is the step label on
              your watch.
              {plan.goal?.trim() ?
                " Your pasted Goal becomes the workout description in Garmin."
              : null}
            </p>
            {garminPushedAt ? (
              <p className="text-gray-600 pt-0.5">
                Last sent to Garmin:{" "}
                {new Date(garminPushedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving || loadingState || !hasBlocks}
              onClick={() => void handleSave()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save race plan"}
            </button>

            {showGarminButton ? (
              <button
                type="button"
                disabled={pushingGarmin || saving || garminConnected === false}
                onClick={() => void handlePushGarmin()}
                className="rounded-lg border border-orange-300 bg-white px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-50 disabled:opacity-50"
              >
                {pushingGarmin ? "Sending…" : "Send to Garmin"}
              </button>
            ) : null}
          </div>

          {saveMessage ? (
            <p className="text-sm font-medium text-emerald-900 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              {saveMessage}
            </p>
          ) : null}
          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
        </div>
      ) : null}
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
