"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Sparkles, FileText, Zap } from "lucide-react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import api from "@/lib/api";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { HR_ZONE_RANGES } from "@/lib/hr-zones";

const WORKOUT_TYPES = ["Easy", "Tempo", "LongRun", "Intervals"] as const;

interface WorkoutSegment {
  id: string;
  title: string;
  miles: number;
  pace?: string;
  hrMin?: number;
  hrMax?: number;
  repeatCount?: number;
}

/** Convert seconds per km (from API target) to "M:SS" (no suffix) */
function secondsPerKmToPacePart(secondsPerKm: number): string {
  const secPerMile = secondsPerKm / 1.60934;
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Convert seconds per km to "M:SS/mile" for display */
function secondsPerKmToPaceString(secondsPerKm: number): string {
  return `${secondsPerKmToPacePart(secondsPerKm)}/mile`;
}

/** Format sec/mile as "M:SS/mile" (for clarification-built segments) */
function formatSecPerMileToPaceString(secPerMile: number): string {
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${s.toString().padStart(2, "0")}/mile`;
}

type ApiSegment = {
  stepOrder: number;
  title: string;
  durationType: string;
  durationValue: number;
  targets?: Array<{ type: string; valueLow?: number; valueHigh?: number }>;
  repeatCount?: number;
};

function apiSegmentsToForm(segments: ApiSegment[]): WorkoutSegment[] {
  return segments.map((seg, i) => {
    let pace: string | undefined;
    const paceTarget = seg.targets?.find((t) => t.type === "PACE");
    if (paceTarget?.valueLow != null) {
      const high = paceTarget.valueHigh ?? paceTarget.valueLow;
      if (paceTarget.valueLow !== high) {
        pace = `${secondsPerKmToPacePart(paceTarget.valueLow)}-${secondsPerKmToPacePart(high)}/mile`;
      } else {
        pace = secondsPerKmToPaceString(paceTarget.valueLow);
      }
    }
    const hrTarget = seg.targets?.find((t) => t.type === "HEART_RATE");
    return {
      id: `seg_${i}_${Date.now()}`,
      title: seg.title,
      miles: seg.durationValue,
      pace,
      hrMin: hrTarget?.valueLow,
      hrMax: hrTarget?.valueHigh,
      repeatCount: seg.repeatCount ?? undefined,
    };
  });
}

export default function CreateWorkoutPage() {
  const router = useRouter();
  const [workoutType, setWorkoutType] = useState<string>("Easy");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stravaUrl, setStravaUrl] = useState("");
  const [segments, setSegments] = useState<WorkoutSegment[]>([]);

  // Paste path
  const [sourceText, setSourceText] = useState("");
  const [deriving, setDeriving] = useState(false);
  const [deriveError, setDeriveError] = useState<string | null>(null);

  // GoFast path
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [needsPace, setNeedsPace] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  // Clarification panel (when AI returns a single generic segment)
  const [showClarificationPanel, setShowClarificationPanel] = useState(false);
  const [clarificationTotalMiles, setClarificationTotalMiles] = useState(0);
  const [clarificationWarmup, setClarificationWarmup] = useState(true);
  const [clarificationCooldown, setClarificationCooldown] = useState(true);
  const [clarificationPace, setClarificationPace] = useState("");
  const [clarificationHrZone, setClarificationHrZone] = useState<number | "">("");

  const addSegment = () => {
    setSegments([
      ...segments,
      { id: Date.now().toString(), title: "", miles: 0 },
    ]);
  };

  const removeSegment = (id: string) => {
    setSegments(segments.filter((s) => s.id !== id));
  };

  const updateSegment = (id: string, updates: Partial<WorkoutSegment>) => {
    setSegments(segments.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  function buildSegmentsFromClarification(): WorkoutSegment[] {
    const total = Math.max(0, clarificationTotalMiles);
    if (total === 0) return [];
    const round = (n: number) => Math.round(n * 100) / 100;
    let pace: string | undefined;
    try {
      if (clarificationPace.trim()) {
        const secPerMile = parsePaceToSecondsPerMile(clarificationPace.trim());
        pace = formatSecPerMileToPaceString(secPerMile);
      }
    } catch {
      // leave pace undefined
    }
    const hrRange =
      clarificationHrZone !== "" && clarificationHrZone >= 1 && clarificationHrZone <= 5
        ? HR_ZONE_RANGES[clarificationHrZone as number]
        : null;
    const hrMin = hrRange?.min;
    const hrMax = hrRange?.max;
    const base = { pace, hrMin, hrMax };
    const ts = Date.now();
    if (clarificationWarmup && clarificationCooldown) {
      const warmupMiles = round(total * 0.1);
      const cooldownMiles = round(total * 0.1);
      const mainMiles = round(total - warmupMiles - cooldownMiles);
      return [
        { id: `seg_0_${ts}`, title: "Warmup", miles: warmupMiles, ...base },
        { id: `seg_1_${ts}`, title: "Main", miles: mainMiles, ...base },
        { id: `seg_2_${ts}`, title: "Cooldown", miles: cooldownMiles, ...base },
      ];
    }
    if (clarificationWarmup) {
      const warmupMiles = round(total * 0.1);
      const mainMiles = round(total - warmupMiles);
      return [
        { id: `seg_0_${ts}`, title: "Warmup", miles: warmupMiles, ...base },
        { id: `seg_1_${ts}`, title: "Main", miles: mainMiles, ...base },
      ];
    }
    if (clarificationCooldown) {
      const mainMiles = round(total * 0.9);
      const cooldownMiles = round(total - mainMiles);
      return [
        { id: `seg_0_${ts}`, title: "Main", miles: mainMiles, ...base },
        { id: `seg_1_${ts}`, title: "Cooldown", miles: cooldownMiles, ...base },
      ];
    }
    return [{ id: `seg_0_${ts}`, title: "Main", miles: total, ...base }];
  }

  const handleApplyClarification = () => {
    const next = buildSegmentsFromClarification();
    if (next.length > 0) {
      setSegments(next);
      setShowClarificationPanel(false);
    }
  };

  const handleDerive = async () => {
    const text = sourceText.trim();
    if (!text) {
      setDeriveError("Paste a workout description first.");
      return;
    }
    setDeriveError(null);
    setNeedsPace(null);
    setDeriving(true);
    try {
      const { data } = await api.post<{
        segments: ApiSegment[];
        suggestedTitle: string;
        suggestedDescription: string;
      }>("workouts/ai-generate", {
        workoutType,
        sourceText: text,
      });
      const formSegments = apiSegmentsToForm(data.segments);
      setSegments(formSegments);
      setName(data.suggestedTitle);
      setDescription(data.suggestedDescription);
      const isWeakParse =
        data.segments.length === 1 &&
        !/warmup|cooldown|interval|tempo/i.test(data.segments[0].title ?? "");
      if (isWeakParse && data.segments[0]) {
        setShowClarificationPanel(true);
        setClarificationTotalMiles(data.segments[0].durationValue ?? 0);
        setClarificationWarmup(true);
        setClarificationCooldown(true);
        setClarificationPace("");
        setClarificationHrZone("");
      } else {
        setShowClarificationPanel(false);
      }
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

  const handleGetFromGoFast = async () => {
    setGenerateError(null);
    setNeedsPace(null);
    setGenerating(true);
    try {
      const { data } = await api.post<
        | { segments: ApiSegment[]; suggestedTitle: string; suggestedDescription: string }
        | { needsPace: true; message: string }
      >("workouts/gofast-generate", { workoutType });
      if ("needsPace" in data && data.needsPace) {
        setNeedsPace(data.message ?? "Set a goal race or 5k pace in settings.");
        return;
      }
      if ("segments" in data && Array.isArray(data.segments)) {
        setSegments(apiSegmentsToForm(data.segments));
        setName(data.suggestedTitle ?? "");
        setDescription(data.suggestedDescription ?? "");
        setShowClarificationPanel(false);
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setGenerateError(msg || "Failed to generate workout");
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (segments.length === 0) {
      alert("Add at least one segment (derive from paste, get from GoFast, or add manually).");
      return;
    }
    setSaving(true);
    try {
      const buildTargets = (pace?: string, hrMin?: number, hrMax?: number) => {
        const targets: Array<{ type: string; valueLow?: number; valueHigh?: number }> = [];
        if (pace) {
          const rangeMatch = pace.match(/(\d+):(\d+)-(\d+):(\d+)/);
          if (rangeMatch) {
            const toSecKm = (m: number, s: number) =>
              Math.round((m * 60 + s) * 1.60934);
            const secKmLow = toSecKm(
              parseInt(rangeMatch[1], 10),
              parseInt(rangeMatch[2], 10)
            );
            const secKmHigh = toSecKm(
              parseInt(rangeMatch[3], 10),
              parseInt(rangeMatch[4], 10)
            );
            targets.push({
              type: "PACE",
              valueLow: Math.min(secKmLow, secKmHigh),
              valueHigh: Math.max(secKmLow, secKmHigh),
            });
          } else {
            const singleMatch = pace.match(/(\d+):(\d+)/);
            if (singleMatch) {
              const minutes = parseInt(singleMatch[1], 10);
              const seconds = parseInt(singleMatch[2], 10);
              const secondsPerKm = Math.round((minutes * 60 + seconds) * 1.60934);
              targets.push({
                type: "PACE",
                valueLow: secondsPerKm - 10,
                valueHigh: secondsPerKm + 10,
              });
            }
          }
        }
        if (hrMin !== undefined && hrMax !== undefined) {
          targets.push({ type: "HEART_RATE", valueLow: hrMin, valueHigh: hrMax });
        }
        return targets.length > 0 ? targets : undefined;
      };

      const workoutData = {
        title: name,
        description,
        stravaUrl: stravaUrl || undefined,
        workoutType: workoutType || "Easy",
        segments: segments.map((seg, index) => ({
          stepOrder: index + 1,
          title: seg.title,
          durationType: "DISTANCE",
          durationValue: seg.miles,
          targets: buildTargets(seg.pace, seg.hrMin, seg.hrMax),
          repeatCount: seg.repeatCount,
        })),
      };

      const response = await api.post("workouts", workoutData);
      const { workout } = response.data;
      router.push(`/workouts/${workout.id}`);
    } catch (error) {
      console.error("Error creating workout:", error);
      alert("Failed to create workout");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
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

          {/* Step 1: Workout type (single source of truth) */}
          <div className="mb-8">
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

          {/* Step 2: Two choices — Paste (derive) or Get from GoFast */}
          <div className="mb-8 space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Get your workout</h2>

            {/* Add from coach / Runna / Strava */}
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50/50">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-500" />
                Add from coach, Runna, or Strava
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Paste a workout description and we’ll turn it into segments.
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
                className="mt-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {deriving ? "Deriving…" : "Derive workout"}
              </button>
            </div>

            {/* Clarification panel when AI returned a single generic segment */}
            {showClarificationPanel && (
              <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50">
                <h3 className="font-medium text-gray-900 mb-2">Add a bit more detail</h3>
                <p className="text-sm text-gray-600 mb-4">
                  We got one block from your paste. Add warmup/cooldown and optional pace or HR zone to build segments.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total miles</label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={clarificationTotalMiles || ""}
                      onChange={(e) =>
                        setClarificationTotalMiles(parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="block text-sm font-medium text-gray-700">Include</label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={clarificationWarmup}
                        onChange={(e) => setClarificationWarmup(e.target.checked)}
                        className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      Warmup
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={clarificationCooldown}
                        onChange={(e) => setClarificationCooldown(e.target.checked)}
                        className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      Cooldown
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pace (e.g. 8:30/mile)</label>
                    <input
                      type="text"
                      value={clarificationPace}
                      onChange={(e) => setClarificationPace(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="8:30 or 8:15-8:45"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Heart rate zone</label>
                    <select
                      value={clarificationHrZone === "" ? "" : String(clarificationHrZone)}
                      onChange={(e) =>
                        setClarificationHrZone(
                          e.target.value === "" ? "" : (parseInt(e.target.value, 10) as number)
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">None</option>
                      {[1, 2, 3, 4, 5].map((z) => (
                        <option key={z} value={z}>
                          Zone {z}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleApplyClarification}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium"
                >
                  Apply
                </button>
              </div>
            )}

            {/* Get a workout from GoFast */}
            <div className="p-4 rounded-lg border border-gray-200 bg-orange-50/30">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-500" />
                Get a workout from GoFast
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                We’ll generate a {workoutType} workout based on your goal race or 5k pace.
              </p>
              {needsPace && (
                <p className="text-sm text-amber-800 mb-2">
                  {needsPace}{" "}
                  <Link href="/settings/race-goal" className="underline font-medium">
                    Set race goal
                  </Link>
                  {" or "}
                  <Link href="/athlete-edit-profile" className="underline font-medium">
                    edit profile
                  </Link>
                  .
                </p>
              )}
              {generateError && <p className="text-sm text-red-600 mt-1">{generateError}</p>}
              <button
                type="button"
                onClick={handleGetFromGoFast}
                disabled={generating}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {generating ? "Generating…" : "Generate for me"}
              </button>
            </div>
          </div>

          {/* Name & description */}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Strava route URL</label>
            <input
              type="url"
              value={stravaUrl}
              onChange={(e) => setStravaUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Segments (always segment-based) */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Segments</h2>
              <button
                type="button"
                onClick={addSegment}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Add segment
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              Derive or generate above, or add segments manually. Then edit and save.
            </p>

            <div className="space-y-4">
              {segments.map((segment, index) => {
                const role = segment.title && /warmup|warm-up|warm up/i.test(segment.title)
                  ? "Warmup"
                  : segment.title && /cooldown|cool-down|cool down/i.test(segment.title)
                    ? "Cooldown"
                    : null;
                return (
                <div key={segment.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      Segment {index + 1}
                      {role && (
                        <span className="text-xs font-normal px-2 py-0.5 rounded bg-gray-200 text-gray-600">
                          {role}
                        </span>
                      )}
                    </h3>
                    <button
                      type="button"
                      onClick={() => removeSegment(segment.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                      <input
                        type="text"
                        value={segment.title}
                        onChange={(e) => updateSegment(segment.id, { title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Miles</label>
                      <input
                        type="number"
                        step="0.1"
                        value={segment.miles || ""}
                        onChange={(e) =>
                          updateSegment(segment.id, { miles: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Repeat</label>
                      <input
                        type="number"
                        min={1}
                        value={segment.repeatCount ?? ""}
                        onChange={(e) =>
                          updateSegment(segment.id, {
                            repeatCount: parseInt(e.target.value, 10) || undefined,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pace (e.g. 8:00/mile)</label>
                      <input
                        type="text"
                        value={segment.pace ?? ""}
                        onChange={(e) => updateSegment(segment.id, { pace: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Heart rate (min – max)</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={segment.hrMin ?? ""}
                          onChange={(e) =>
                            updateSegment(segment.id, {
                              hrMin: parseInt(e.target.value, 10) || undefined,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        />
                        <input
                          type="number"
                          value={segment.hrMax ?? ""}
                          onChange={(e) =>
                            updateSegment(segment.id, {
                              hrMax: parseInt(e.target.value, 10) || undefined,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          </div>

          <div className="flex gap-4 justify-end pt-6 border-t border-gray-200">
            <Link href="/workouts" className="px-4 py-2 text-gray-700 hover:text-gray-900">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || !name || segments.length === 0}
              className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Create workout"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
