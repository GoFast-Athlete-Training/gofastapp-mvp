"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Pencil } from "lucide-react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import api from "@/lib/api";
import { PaceMiSplitEditor } from "@/components/workout/PaceMiSplitEditor";
import { parseSplitPaceToSecPerMile, secPerMileToSplitStrings } from "@/lib/workout/pace-mi-split";
import {
  formatStoredPaceAsMinPerMile,
  secondsPerMileToSecondsPerKm,
  storedPaceSecondsKmToSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";

const WORKOUT_TYPES = ["Easy", "Tempo", "LongRun", "Intervals"] as const;

/** Stored PACE targets are sec/km, encoding v2 (same as workout detail / Garmin). */
const PACE_SLOT_ENC = 2 as const;

export interface SlotData {
  miles: number;
  /** PACE API valueLow (sec/km, v2) — faster bound; same as detail editor “Pace low”. */
  paceValueLow?: number;
  /** PACE API valueHigh (sec/km, v2) — slower bound; “Pace high”. */
  paceValueHigh?: number;
  hrMin?: number;
  hrMax?: number;
  repeatCount?: number;
}

type ApiSegment = {
  stepOrder: number;
  title: string;
  durationType: string;
  durationValue: number;
  targets?: Array<{
    type: string;
    valueLow?: number;
    valueHigh?: number;
    /** Some generators send a single PACE scalar (sec/km, v2). */
    value?: number;
  }>;
  repeatCount?: number;
};

/** Sec/km (stored API value, encoding v2) to "M:SS" per mile — shared with workout detail */
function secPerKmToPaceDisplay(value: number): string {
  return formatStoredPaceAsMinPerMile(value, 2);
}

/** Pace band from a target object (sec/km, encoding v2). Case-insensitive type; supports single `value`. */
function paceBandSecKmFromTarget(t: { type?: string; valueLow?: number; valueHigh?: number; value?: number }): {
  low?: number;
  high?: number;
} {
  if (String(t.type ?? "").toUpperCase() !== "PACE") return {};
  const vl = typeof t.valueLow === "number" && Number.isFinite(t.valueLow) ? t.valueLow : undefined;
  const vh = typeof t.valueHigh === "number" && Number.isFinite(t.valueHigh) ? t.valueHigh : undefined;
  const v = typeof t.value === "number" && Number.isFinite(t.value) ? t.value : undefined;
  if (vl != null && vh != null) {
    return { low: Math.min(vl, vh), high: Math.max(vl, vh) };
  }
  if (v != null) return { low: v, high: v };
  if (vl != null) return { low: vl, high: vl };
  if (vh != null) return { low: vh, high: vh };
  return {};
}

function hrBandFromTarget(t: { type?: string; valueLow?: number; valueHigh?: number }): {
  min?: number;
  max?: number;
} {
  if (String(t.type ?? "").toUpperCase() !== "HEART_RATE") return {};
  const lo = typeof t.valueLow === "number" && Number.isFinite(t.valueLow) ? t.valueLow : undefined;
  const hi = typeof t.valueHigh === "number" && Number.isFinite(t.valueHigh) ? t.valueHigh : undefined;
  if (lo == null || hi == null) return {};
  return { min: Math.min(lo, hi), max: Math.max(lo, hi) };
}

/** Map AI-derived segments into fixed warmup / mainWork / cooldown slots */
function apiSegmentsToSlots(
  segments: ApiSegment[]
): { warmup: SlotData | null; mainWork: SlotData | null; cooldown: SlotData | null } {
  let warmup: SlotData | null = null;
  let mainWork: SlotData | null = null;
  let cooldown: SlotData | null = null;

  for (const seg of segments) {
    const title = (seg.title ?? "").toLowerCase();
    const miles = typeof seg.durationValue === "number" && seg.durationValue > 0 ? seg.durationValue : 0;
    let paceValueLow: number | undefined;
    let paceValueHigh: number | undefined;
    for (const raw of seg.targets ?? []) {
      const band = paceBandSecKmFromTarget(raw);
      if (band.low != null) {
        paceValueLow = band.low;
        paceValueHigh = band.high ?? band.low;
        break;
      }
    }
    let hrMin: number | undefined;
    let hrMax: number | undefined;
    for (const raw of seg.targets ?? []) {
      const hr = hrBandFromTarget(raw);
      if (hr.min != null && hr.max != null) {
        hrMin = hr.min;
        hrMax = hr.max;
        break;
      }
    }
    const slot: SlotData = {
      miles,
      paceValueLow,
      paceValueHigh,
      hrMin,
      hrMax,
      repeatCount: seg.repeatCount ?? undefined,
    };

    if (/warmup|warm.up|warm up/.test(title)) {
      warmup = slot;
    } else if (/cooldown|cool.down|cool down/.test(title)) {
      cooldown = slot;
    } else {
      if (mainWork) {
        mainWork = {
          miles: mainWork.miles + miles,
          paceValueLow: mainWork.paceValueLow ?? slot.paceValueLow,
          paceValueHigh: mainWork.paceValueHigh ?? slot.paceValueHigh,
          hrMin: mainWork.hrMin ?? slot.hrMin,
          hrMax: mainWork.hrMax ?? slot.hrMax,
          repeatCount: mainWork.repeatCount ?? slot.repeatCount,
        };
      } else {
        mainWork = slot;
      }
    }
  }

  return { warmup, mainWork, cooldown };
}

function slotOneLine(slot: SlotData): string {
  const mi = slot.miles ? `${slot.miles} mi` : "";
  const low = slot.paceValueLow != null ? secPerKmToPaceDisplay(slot.paceValueLow) : "";
  const high = slot.paceValueHigh != null ? secPerKmToPaceDisplay(slot.paceValueHigh) : "";
  const pace = low && high ? (low === high ? `${low}/mi` : `${low}-${high}/mi`) : "";
  return [mi, pace].filter(Boolean).join(" — ") || "—";
}

function slotToPaceSplitState(slot: SlotData | null): {
  lowMin: string;
  lowSec: string;
  highMin: string;
  highSec: string;
} {
  let lowMin = "";
  let lowSec = "";
  let highMin = "";
  let highSec = "";
  if (slot?.paceValueLow != null) {
    const secMi = Math.round(
      storedPaceSecondsKmToSecondsPerMile(slot.paceValueLow, PACE_SLOT_ENC)
    );
    const lo = secPerMileToSplitStrings(secMi);
    lowMin = lo.min;
    lowSec = lo.sec;
  }
  if (slot?.paceValueHigh != null) {
    const secMi = Math.round(
      storedPaceSecondsKmToSecondsPerMile(slot.paceValueHigh, PACE_SLOT_ENC)
    );
    const hi = secPerMileToSplitStrings(secMi);
    highMin = hi.min;
    highSec = hi.sec;
  }
  return { lowMin, lowSec, highMin, highSec };
}

export default function CreateWorkoutPage() {
  const router = useRouter();
  const [workoutType, setWorkoutType] = useState<string>("Easy");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [warmup, setWarmup] = useState<SlotData | null>(null);
  const [mainWork, setMainWork] = useState<SlotData | null>(null);
  const [cooldown, setCooldown] = useState<SlotData | null>(null);

  const [sourceText, setSourceText] = useState("");
  const [deriving, setDeriving] = useState(false);
  const [deriveError, setDeriveError] = useState<string | null>(null);
  const [goFastGenerating, setGoFastGenerating] = useState(false);
  /** Server message when POST gofast-generate returns needsPace */
  const [needsPaceHint, setNeedsPaceHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** YYYY-MM-DD from date input; optional, shown on home & workout cards */
  const [scheduledDate, setScheduledDate] = useState("");
  const [editingSlot, setEditingSlot] = useState<"warmup" | "mainWork" | "cooldown" | null>(null);
  /** Pace low / high split fields while a slot editor is open (matches /workouts/[id]). */
  const [editingPaceLowMin, setEditingPaceLowMin] = useState("");
  const [editingPaceLowSec, setEditingPaceLowSec] = useState("");
  const [editingPaceHighMin, setEditingPaceHighMin] = useState("");
  const [editingPaceHighSec, setEditingPaceHighSec] = useState("");

  const hasSlots = warmup !== null || mainWork !== null || cooldown !== null;

  const getSlot = (key: "warmup" | "mainWork" | "cooldown") =>
    key === "warmup" ? warmup : key === "mainWork" ? mainWork : cooldown;
  const setSlot = (key: "warmup" | "mainWork" | "cooldown", value: SlotData | null) => {
    if (key === "warmup") setWarmup(value);
    else if (key === "mainWork") setMainWork(value);
    else setCooldown(value);
  };

  useEffect(() => {
    if (!editingSlot) return;
    const label =
      editingSlot === "warmup"
        ? "Warmup"
        : editingSlot === "mainWork"
          ? "Main Work"
          : "Cooldown";
    const ctx = `${label} segment`;
    const base = getSlot(editingSlot) ?? { miles: 0 };

    let paceValueLow: number | undefined;
    if (!editingPaceLowMin.trim() && !editingPaceLowSec.trim()) {
      paceValueLow = undefined;
    } else {
      try {
        const secMi = parseSplitPaceToSecPerMile(
          editingPaceLowMin,
          editingPaceLowSec,
          ctx,
          "low"
        );
        paceValueLow = Number.isFinite(secMi)
          ? secondsPerMileToSecondsPerKm(secMi)
          : base.paceValueLow;
      } catch {
        paceValueLow = base.paceValueLow;
      }
    }

    let paceValueHigh: number | undefined;
    if (!editingPaceHighMin.trim() && !editingPaceHighSec.trim()) {
      paceValueHigh = undefined;
    } else {
      try {
        const secMi = parseSplitPaceToSecPerMile(
          editingPaceHighMin,
          editingPaceHighSec,
          ctx,
          "high"
        );
        paceValueHigh = Number.isFinite(secMi)
          ? secondsPerMileToSecondsPerKm(secMi)
          : base.paceValueHigh;
      } catch {
        paceValueHigh = base.paceValueHigh;
      }
    }

    if (paceValueLow === base.paceValueLow && paceValueHigh === base.paceValueHigh) return;

    setSlot(editingSlot, {
      ...base,
      paceValueLow,
      paceValueHigh,
    });
  }, [
    editingSlot,
    editingPaceLowMin,
    editingPaceLowSec,
    editingPaceHighMin,
    editingPaceHighSec,
    warmup,
    mainWork,
    cooldown,
  ]);

  const clearSegmentsUsePasteInstead = () => {
    setWarmup(null);
    setMainWork(null);
    setCooldown(null);
    setEditingSlot(null);
    setEditingPaceLowMin("");
    setEditingPaceLowSec("");
    setEditingPaceHighMin("");
    setEditingPaceHighSec("");
    setDeriveError(null);
  };

  const handleDerive = async () => {
    const text = sourceText.trim();
    if (!text) {
      setDeriveError("Paste a workout description first.");
      return;
    }
    setDeriveError(null);
    setNeedsPaceHint(null);
    setDeriving(true);
    try {
      const { data } = await api.post<{
        segments: ApiSegment[];
        suggestedTitle: string;
        suggestedDescription: string;
      }>("workouts/ai-generate", { workoutType, sourceText: text });
      const slots = apiSegmentsToSlots(data.segments);
      setWarmup(slots.warmup);
      setMainWork(slots.mainWork);
      setCooldown(slots.cooldown);
      setName(data.suggestedTitle);
      setDescription(data.suggestedDescription);
    } catch (err: unknown) {
      let display = "Failed to derive workout";
      if (err && typeof err === "object" && "response" in err) {
        const res = (err as { response?: { status?: number; data?: unknown } }).response;
        const status = res?.status;
        const data = res?.data;
        const serverMessage =
          typeof data === "object" && data !== null && "error" in data && typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : typeof data === "string"
              ? data.slice(0, 200) + (data.length > 200 ? "…" : "")
              : null;
        if (status != null || serverMessage) {
          display = [status != null ? `Status: ${status}` : null, serverMessage || "No details from server"].filter(Boolean).join(" — ");
        }
      }
      setDeriveError(display);
    } finally {
      setDeriving(false);
    }
  };

  const handleGoFastGenerate = async () => {
    setDeriveError(null);
    setNeedsPaceHint(null);
    setGoFastGenerating(true);
    try {
      const { data } = await api.post<
        | { needsPace: true; message: string }
        | { segments: ApiSegment[]; suggestedTitle: string; suggestedDescription: string }
      >("workouts/gofast-generate", { workoutType });

      if (data && typeof data === "object" && "needsPace" in data && data.needsPace) {
        setNeedsPaceHint(data.message ?? "");
        return;
      }

      if (
        !data ||
        typeof data !== "object" ||
        !("segments" in data) ||
        !Array.isArray((data as { segments?: unknown }).segments)
      ) {
        setDeriveError("Unexpected response from workout builder.");
        return;
      }

      const built = data as {
        segments: ApiSegment[];
        suggestedTitle: string;
        suggestedDescription: string;
      };
      const slots = apiSegmentsToSlots(built.segments);
      setWarmup(slots.warmup);
      setMainWork(slots.mainWork);
      setCooldown(slots.cooldown);
      setName(built.suggestedTitle);
      setDescription(built.suggestedDescription);
    } catch (err: unknown) {
      let display = "Failed to build workout";
      if (err && typeof err === "object" && "response" in err) {
        const res = (err as { response?: { status?: number; data?: unknown } }).response;
        const status = res?.status;
        const resData = res?.data;
        const serverMessage =
          typeof resData === "object" && resData !== null && "error" in resData && typeof (resData as { error?: unknown }).error === "string"
            ? (resData as { error: string }).error
            : typeof resData === "string"
              ? resData.slice(0, 200) + (resData.length > 200 ? "…" : "")
              : null;
        if (status != null || serverMessage) {
          display = [status != null ? `Status: ${status}` : null, serverMessage || "No details from server"].filter(Boolean).join(" — ");
        }
      }
      setDeriveError(display);
    } finally {
      setGoFastGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainWork && !warmup && !cooldown) {
      alert("Derive a workout first, or add at least one segment.");
      return;
    }
    setSaving(true);
    try {
      const buildTargets = (slot: SlotData) => {
        const targets: Array<{ type: string; valueLow?: number; valueHigh?: number }> = [];
        if (slot.paceValueLow != null || slot.paceValueHigh != null) {
          const low = slot.paceValueLow ?? slot.paceValueHigh ?? 0;
          const high = slot.paceValueHigh ?? slot.paceValueLow ?? low;
          if (low || high) targets.push({ type: "PACE", valueLow: low, valueHigh: high });
        }
        if (slot.hrMin != null && slot.hrMax != null) {
          targets.push({ type: "HEART_RATE", valueLow: slot.hrMin, valueHigh: slot.hrMax });
        }
        return targets.length ? targets : undefined;
      };

      const segmentTitles: Record<string, string> = {
        warmup: "Warmup",
        mainWork: "Main Work",
        cooldown: "Cooldown",
      };
      const order: ("warmup" | "mainWork" | "cooldown")[] = ["warmup", "mainWork", "cooldown"];
      const segments = order
        .filter((k) => {
          const s = getSlot(k);
          return s != null && s.miles > 0;
        })
        .map((k, i) => {
          const slot = getSlot(k)!;
          return {
            stepOrder: i + 1,
            title: segmentTitles[k],
            durationType: "DISTANCE",
            durationValue: slot.miles,
            targets: buildTargets(slot),
            repeatCount: slot.repeatCount,
          };
        });

      const workoutData = {
        title: name,
        description,
        workoutType: workoutType || "Easy",
        segments,
        ...(scheduledDate.trim() ? { date: scheduledDate.trim() } : {}),
      };

      const response = await api.post("workouts", workoutData);
      const { workout } = response.data;
      router.push(`/workouts/${workout.id}?created=1`);
    } catch (error) {
      console.error("Error creating workout:", error);
      alert("Failed to create workout");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/workouts"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Workouts
        </Link>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Workout</h1>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="workout-schedule-date">
              Schedule (optional)
            </label>
            <input
              id="workout-schedule-date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Leave blank to use today&apos;s date (UTC calendar day). Otherwise this day is stored like plan
              workouts and used when you push to Garmin.
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Workout type</label>
            <select
              value={workoutType}
              onChange={(e) => setWorkoutType(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              {WORKOUT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="mb-8 rounded-lg border border-orange-100 bg-orange-50/50 p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Or build from your pacing</h2>
            <p className="text-sm text-gray-600 mb-3">
              Uses your active goal&apos;s finish-time pace first, then your profile 5K pace. Format:{" "}
              <span className="font-mono text-gray-800">7:30</span> or{" "}
              <span className="font-mono text-gray-800">7:30/mile</span> (same as the pace calculator).
            </p>
            <button
              type="button"
              onClick={handleGoFastGenerate}
              disabled={goFastGenerating}
              className="px-4 py-2 bg-white border-2 border-orange-300 text-orange-800 rounded-lg font-medium hover:bg-orange-50 disabled:opacity-50"
            >
              {goFastGenerating ? "Building…" : "Build template from goal / 5K pace"}
            </button>
            {needsPaceHint != null && (
              <div className="mt-4 rounded-lg border border-orange-200 bg-white p-4 shadow-sm" role="status">
                <p className="text-sm font-medium text-gray-900 mb-1">We need a pace first</p>
                <p className="text-sm text-gray-600 mb-4">{needsPaceHint}</p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/goals"
                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
                  >
                    Set goal →
                  </Link>
                  <Link
                    href="/athlete-edit-profile"
                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg border-2 border-orange-200 text-orange-800 text-sm font-semibold hover:bg-orange-50 transition-colors"
                  >
                    Set 5K baseline (profile) →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {!hasSlots && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Paste your workout</h2>
              <p className="text-sm text-gray-600 mb-3">
                Paste a description from a coach, Runna, or Strava and we’ll turn it into segments.
              </p>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="e.g. 15 miles today — 2 mile warmup, 10 at marathon pace, 3 mile cooldown"
              />
              {deriveError && <p className="text-sm text-red-600 mt-1">{deriveError}</p>}
              <button
                type="button"
                onClick={handleDerive}
                disabled={deriving}
                className="mt-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                {deriving ? "Deriving…" : "Derive workout"}
              </button>
            </div>
          )}

          {hasSlots && (
            <>
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={clearSegmentsUsePasteInstead}
                  className="text-sm text-orange-700 hover:text-orange-900 underline underline-offset-2"
                >
                  Clear segments and paste a workout instead
                </button>
              </div>

              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Segments</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Warmup, main work, and cooldown. Add or edit each slot.
                </p>

                {(
                  [
                    { key: "warmup" as const, label: "Warmup" },
                    { key: "mainWork" as const, label: "Main Work" },
                    { key: "cooldown" as const, label: "Cooldown" },
                  ] as const
                ).map(({ key, label }) => {
                  const slot = getSlot(key);
                  const isEditing = editingSlot === key;

                  return (
                    <div key={key} className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{label}</span>
                        <span className="text-sm text-gray-600">
                          {slot ? slotOneLine(slot) : "None"}
                        </span>
                        <div className="flex gap-2">
                          {!slot ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSlot(key, { miles: 0 });
                                setEditingSlot(key);
                                setEditingPaceLowMin("");
                                setEditingPaceLowSec("");
                                setEditingPaceHighMin("");
                                setEditingPaceHighSec("");
                              }}
                              className="text-sm px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                            >
                              Add
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isEditing) {
                                    setEditingSlot(null);
                                  } else {
                                    setEditingSlot(key);
                                    const sp = slotToPaceSplitState(getSlot(key));
                                    setEditingPaceLowMin(sp.lowMin);
                                    setEditingPaceLowSec(sp.lowSec);
                                    setEditingPaceHighMin(sp.highMin);
                                    setEditingPaceHighSec(sp.highSec);
                                  }
                                }}
                                className="text-sm px-3 py-1.5 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 inline-flex items-center gap-1"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {isEditing && (
                        <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Miles</label>
                            <input
                              type="number"
                              step="0.1"
                              min={0}
                              value={slot?.miles ?? ""}
                              onChange={(e) =>
                                setSlot(key, {
                                  ...(getSlot(key) ?? { miles: 0 }),
                                  miles: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <span className="text-xs font-semibold uppercase text-gray-500 block mb-1">
                                Pace low
                              </span>
                              <PaceMiSplitEditor
                                minValue={editingPaceLowMin}
                                secValue={editingPaceLowSec}
                                onMinChange={setEditingPaceLowMin}
                                onSecChange={setEditingPaceLowSec}
                              />
                            </div>
                            <div>
                              <span className="text-xs font-semibold uppercase text-gray-500 block mb-1">
                                Pace high
                              </span>
                              <PaceMiSplitEditor
                                minValue={editingPaceHighMin}
                                secValue={editingPaceHighSec}
                                onMinChange={setEditingPaceHighMin}
                                onSecChange={setEditingPaceHighSec}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">HR min</label>
                            <input
                              type="number"
                              value={slot?.hrMin ?? ""}
                              onChange={(e) =>
                                setSlot(key, {
                                  ...(getSlot(key) ?? { miles: 0 }),
                                  hrMin: parseInt(e.target.value, 10) || undefined,
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">HR max</label>
                            <input
                              type="number"
                              value={slot?.hrMax ?? ""}
                              onChange={(e) =>
                                setSlot(key, {
                                  ...(getSlot(key) ?? { miles: 0 }),
                                  hrMax: parseInt(e.target.value, 10) || undefined,
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <button
                              type="button"
                              onClick={() => setEditingSlot(null)}
                              className="text-sm px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                            >
                              Done
                            </button>
                            {slot && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSlot(key, null);
                                  setEditingSlot(null);
                                  setEditingPaceLowMin("");
                                  setEditingPaceLowSec("");
                                  setEditingPaceHighMin("");
                                  setEditingPaceHighSec("");
                                }}
                                className="ml-2 text-sm px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-4 justify-end pt-6 border-t border-gray-200">
                <Link href="/workouts" className="px-4 py-2 text-gray-700 hover:text-gray-900">
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={
                    saving ||
                    !name ||
                    ![warmup, mainWork, cooldown].some((s) => s != null && s.miles > 0)
                  }
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving…" : "Create workout"}
                </button>
              </div>
            </>
          )}
        </form>
          </div>
        </main>
      </div>
    </div>
  );
}
