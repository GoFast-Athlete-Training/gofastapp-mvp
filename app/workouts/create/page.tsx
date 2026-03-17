"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Sparkles, FileText, Zap } from "lucide-react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import api from "@/lib/api";

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

/** Convert seconds per km (from API target) to "M:SS/mile" for display */
function secondsPerKmToPaceString(secondsPerKm: number): string {
  const secPerMile = secondsPerKm / 1.60934;
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
      const mid = (paceTarget.valueLow + (paceTarget.valueHigh ?? paceTarget.valueLow)) / 2;
      pace = secondsPerKmToPaceString(mid);
    }
    return {
      id: `seg_${i}_${Date.now()}`,
      title: seg.title,
      miles: seg.durationValue,
      pace,
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
      }>("/api/workouts/ai-generate", {
        workoutType,
        sourceText: text,
      });
      setSegments(apiSegmentsToForm(data.segments));
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

  const handleGetFromGoFast = async () => {
    setGenerateError(null);
    setNeedsPace(null);
    setGenerating(true);
    try {
      const { data } = await api.post<
        | { segments: ApiSegment[]; suggestedTitle: string; suggestedDescription: string }
        | { needsPace: true; message: string }
      >("/api/workouts/gofast-generate", { workoutType });
      if ("needsPace" in data && data.needsPace) {
        setNeedsPace(data.message ?? "Set a goal race or 5k pace in settings.");
        return;
      }
      if ("segments" in data && Array.isArray(data.segments)) {
        setSegments(apiSegmentsToForm(data.segments));
        setName(data.suggestedTitle ?? "");
        setDescription(data.suggestedDescription ?? "");
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
          const match = pace.match(/(\d+):(\d+)/);
          if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const totalSecondsPerMile = minutes * 60 + seconds;
            const secondsPerKm = Math.round(totalSecondsPerMile * 1.60934);
            targets.push({
              type: "PACE",
              valueLow: secondsPerKm - 10,
              valueHigh: secondsPerKm + 10,
            });
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

      const response = await api.post("/api/workouts", workoutData);
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
              {segments.map((segment, index) => (
                <div key={segment.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">Segment {index + 1}</h3>
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
              ))}
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
