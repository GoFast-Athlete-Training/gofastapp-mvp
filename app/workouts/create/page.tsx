"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Sparkles } from "lucide-react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import api from "@/lib/api";
// Garmin conversion handled server-side by garmin-training-service.ts

const WORKOUT_TYPES = ["Easy", "Tempo", "LongRun", "Intervals", "Speed", "Strength"] as const;

interface WorkoutSegment {
  id: string;
  title: string;
  miles: number;
  pace?: string;
  hrMin?: number;
  hrMax?: number;
  repeatCount?: number; // For intervals: repeat this segment N times
}

/** Convert seconds per km (from API target) to "M:SS/mile" for display */
function secondsPerKmToPaceString(secondsPerKm: number): string {
  const secPerMile = secondsPerKm / 1.60934;
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${s.toString().padStart(2, "0")}/mile`;
}

export default function CreateWorkoutPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stravaUrl, setStravaUrl] = useState("");
  const [workoutType, setWorkoutType] = useState<string>("Easy");

  // AI generate panel — blob (Runna/coach/Strava paste) or structured
  const [sourceText, setSourceText] = useState("");
  const [aiWorkoutType, setAiWorkoutType] = useState<string>("Tempo");
  const [aiTotalMiles, setAiTotalMiles] = useState<string>("8");
  const [aiGoalPace, setAiGoalPace] = useState("");
  const [aiRaceTime, setAiRaceTime] = useState("");
  const [aiRaceDistance, setAiRaceDistance] = useState("marathon");
  const [aiFreeform, setAiFreeform] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Overall workout goals
  const [overallMiles, setOverallMiles] = useState<number>(0);
  const [overallPace, setOverallPace] = useState("");
  const [overallHrMin, setOverallHrMin] = useState<number>();
  const [overallHrMax, setOverallHrMax] = useState<number>();
  
  // Segments toggle
  const [useSegments, setUseSegments] = useState(false);
  const [segments, setSegments] = useState<WorkoutSegment[]>([]);
  
  const [saving, setSaving] = useState(false);

  const addSegment = () => {
    setSegments([
      ...segments,
      {
        id: Date.now().toString(),
        title: "",
        miles: 0,
      },
    ]);
  };

  const removeSegment = (id: string) => {
    setSegments(segments.filter((s) => s.id !== id));
  };

  const updateSegment = (id: string, updates: Partial<WorkoutSegment>) => {
    setSegments(segments.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleGenerate = async () => {
    setGenerateError(null);
    const hasPaste = sourceText.trim().length > 0;
    if (!hasPaste) {
      const totalMiles = parseFloat(aiTotalMiles);
      if (!totalMiles || totalMiles <= 0) {
        setGenerateError("Enter a valid total distance (miles) or paste a workout description.");
        return;
      }
      if (!aiGoalPace?.trim() && !aiRaceTime?.trim()) {
        setGenerateError("Enter goal pace (e.g. 7:30/mile) or race time (e.g. 3:30:00), or paste a workout.");
        return;
      }
    }
    setGenerating(true);
    try {
      const body: Record<string, unknown> = hasPaste
        ? { sourceText: sourceText.trim() }
        : {
            workoutType: aiWorkoutType,
            totalMiles: parseFloat(aiTotalMiles),
            freeformPrompt: aiFreeform.trim() || undefined,
          };
      if (!hasPaste) {
        if (aiGoalPace.trim()) (body as Record<string, unknown>).goalPace = aiGoalPace.trim();
        else {
          (body as Record<string, unknown>).raceTime = aiRaceTime.trim();
          (body as Record<string, unknown>).raceDistance = aiRaceDistance.trim() || "marathon";
        }
      }
      const { data } = await api.post<{
        segments: Array<{
          stepOrder: number;
          title: string;
          durationType: string;
          durationValue: number;
          targets?: Array<{ type: string; valueLow?: number; valueHigh?: number }>;
          repeatCount?: number;
        }>;
        suggestedTitle: string;
        suggestedDescription: string;
      }>("/api/workouts/ai-generate", body);
      const formSegments: WorkoutSegment[] = data.segments.map((seg, i) => {
        let pace: string | undefined;
        const paceTarget = seg.targets?.find((t) => t.type === "PACE");
        if (paceTarget?.valueLow != null) {
          const mid = (paceTarget.valueLow + (paceTarget.valueHigh ?? paceTarget.valueLow)) / 2;
          pace = secondsPerKmToPaceString(mid);
        }
        return {
          id: `ai_${i}_${Date.now()}`,
          title: seg.title,
          miles: seg.durationValue,
          pace,
          repeatCount: seg.repeatCount ?? undefined,
        };
      });
      setSegments(formSegments);
      setName(data.suggestedTitle);
      setDescription(data.suggestedDescription);
      if (!hasPaste) {
        setWorkoutType(aiWorkoutType);
        setOverallMiles(parseFloat(aiTotalMiles));
      } else {
        const totalFromSegments = data.segments.reduce(
          (sum, s) => sum + (s.durationType === "DISTANCE" ? s.durationValue * (s.repeatCount ?? 1) : 0),
          0
        );
        setOverallMiles(totalFromSegments);
      }
      setUseSegments(true);
    } catch (err: unknown) {
      const message = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : null;
      setGenerateError(message || "Failed to generate workout");
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Build targets array from pace/HR inputs
      const buildTargets = (pace?: string, hrMin?: number, hrMax?: number) => {
        const targets: Array<{
          type: string;
          valueLow?: number;
          valueHigh?: number;
        }> = [];

        // Add pace target if provided (convert to seconds/km)
        if (pace) {
          // Parse pace string like "8:00/mile" to seconds/km
          const match = pace.match(/(\d+):(\d+)/);
          if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const totalSecondsPerMile = minutes * 60 + seconds;
            const secondsPerKm = Math.round(totalSecondsPerMile * 1.60934);
            targets.push({
              type: "PACE",
              valueLow: secondsPerKm - 10, // ±10 seconds tolerance
              valueHigh: secondsPerKm + 10,
            });
          }
        }

        // Add HR target if provided
        if (hrMin !== undefined && hrMax !== undefined) {
          targets.push({
            type: "HEART_RATE",
            valueLow: hrMin,
            valueHigh: hrMax,
          });
        }

        return targets.length > 0 ? targets : undefined;
      };

      // Build workout data
      const workoutData = {
        title: name,
        description,
        stravaUrl: stravaUrl || undefined,
        workoutType: workoutType || "Easy",
        segments: useSegments
          ? segments.map((seg, index) => ({
              stepOrder: index + 1,
              title: seg.title,
              durationType: "DISTANCE", // Could be TIME if needed
              durationValue: seg.miles,
              targets: buildTargets(seg.pace, seg.hrMin, seg.hrMax),
              repeatCount: seg.repeatCount,
            }))
          : [
              {
                stepOrder: 1,
                title: "Main Set",
                durationType: "DISTANCE",
                durationValue: overallMiles,
                targets: buildTargets(overallPace, overallHrMin, overallHrMax),
              },
            ],
      };

      // Save to API
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
        {/* Back Button */}
        <Link
          href="/workouts"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Workouts
        </Link>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Workout</h1>

          {/* AI Generate */}
          <div className="mb-8 p-4 rounded-lg border border-orange-200 bg-orange-50/50">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              AI Generate Workout
            </h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Paste from Runna, coach, or Strava
              </label>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                rows={4}
                placeholder="e.g. You have 15 miles today — 2 mile warmup, 10 miles at marathon pace, 3 mile cooldown"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Paste your workout description and we’ll match it to our format (warmup, build, main set, cooldown).
              </p>
            </div>
            <p className="text-sm font-medium text-gray-700 mb-2">Or use structured inputs:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workout Type</label>
                <select
                  value={aiWorkoutType}
                  onChange={(e) => setAiWorkoutType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  {WORKOUT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Miles</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  value={aiTotalMiles}
                  onChange={(e) => setAiTotalMiles(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Goal Pace (e.g., 7:30/mile)</label>
                <input
                  type="text"
                  value={aiGoalPace}
                  onChange={(e) => setAiGoalPace(e.target.value)}
                  placeholder="7:30/mile"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Or Race Time (e.g., 3:30:00)</label>
                  <input
                    type="text"
                    value={aiRaceTime}
                    onChange={(e) => setAiRaceTime(e.target.value)}
                    placeholder="3:30:00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div className="w-28">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Distance</label>
                  <select
                    value={aiRaceDistance}
                    onChange={(e) => setAiRaceDistance(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="marathon">Marathon</option>
                    <option value="half">Half</option>
                    <option value="10k">10k</option>
                    <option value="5k">5k</option>
                    <option value="mile">Mile</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Optional: describe anything specific</label>
              <textarea
                value={aiFreeform}
                onChange={(e) => setAiFreeform(e.target.value)}
                rows={2}
                placeholder="e.g., more warmup, fewer intervals..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            {generateError && (
              <p className="text-sm text-red-600 mb-2">{generateError}</p>
            )}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? "Generating..." : "Generate Workout"}
            </button>
          </div>

          {/* Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="e.g., Track Tuesday"
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Optional description..."
            />
          </div>

          {/* Strava URL */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Strava Route URL
            </label>
            <input
              type="url"
              value={stravaUrl}
              onChange={(e) => setStravaUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="https://www.strava.com/routes/..."
            />
            <p className="mt-1 text-sm text-gray-500">
              Optional: Link to Strava route for this workout
            </p>
          </div>

          {/* Workout Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Workout Type</label>
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

          {/* Overall Goals */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Overall</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Miles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Miles
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={overallMiles || ""}
                  onChange={(e) => setOverallMiles(parseFloat(e.target.value) || 0)}
                  disabled={useSegments}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                />
              </div>

              {/* Pace */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pace (e.g., 8:00/mile)
                </label>
                <input
                  type="text"
                  value={overallPace}
                  onChange={(e) => setOverallPace(e.target.value)}
                  disabled={useSegments}
                  placeholder="8:00/mile"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                />
              </div>

              {/* HR */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Heart Rate (bpm)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={overallHrMin || ""}
                    onChange={(e) => setOverallHrMin(parseInt(e.target.value) || undefined)}
                    disabled={useSegments}
                    placeholder="Min"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                  />
                  <span className="self-center text-gray-500">-</span>
                  <input
                    type="number"
                    value={overallHrMax || ""}
                    onChange={(e) => setOverallHrMax(parseInt(e.target.value) || undefined)}
                    disabled={useSegments}
                    placeholder="Max"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Segments Toggle */}
          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useSegments}
                onChange={(e) => setUseSegments(e.target.checked)}
                className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Do you want specific segments?
              </span>
            </label>
          </div>

          {/* Segments */}
          {useSegments && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Segments</h2>
                <button
                  type="button"
                  onClick={addSegment}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Segment
                </button>
              </div>

              <div className="space-y-4">
                {segments.map((segment, index) => (
                  <div
                    key={segment.id}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-gray-900">
                        Segment {index + 1}
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
                      {/* Title */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Title (e.g., Warmup, Main Set, Cooldown)
                        </label>
                        <input
                          type="text"
                          value={segment.title}
                          onChange={(e) =>
                            updateSegment(segment.id, { title: e.target.value })
                          }
                          placeholder="e.g., Warmup"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>

                      {/* Miles */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Miles
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={segment.miles || ""}
                          onChange={(e) =>
                            updateSegment(segment.id, {
                              miles: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>

                      {/* Repeat Count */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Repeat (e.g., 3x)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={segment.repeatCount || ""}
                          onChange={(e) =>
                            updateSegment(segment.id, {
                              repeatCount: parseInt(e.target.value) || undefined,
                            })
                          }
                          placeholder="1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>

                      {/* Pace */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Pace (e.g., 8:00/mile)
                        </label>
                        <input
                          type="text"
                          value={segment.pace || ""}
                          onChange={(e) =>
                            updateSegment(segment.id, { pace: e.target.value })
                          }
                          placeholder="8:00/mile"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>

                      {/* HR */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Heart Rate (bpm)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={segment.hrMin || ""}
                            onChange={(e) =>
                              updateSegment(segment.id, {
                                hrMin: parseInt(e.target.value) || undefined,
                              })
                            }
                            placeholder="Min"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          />
                          <span className="self-center text-gray-500">-</span>
                          <input
                            type="number"
                            value={segment.hrMax || ""}
                            onChange={(e) =>
                              updateSegment(segment.id, {
                                hrMax: parseInt(e.target.value) || undefined,
                              })
                            }
                            placeholder="Max"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-4 justify-end pt-6 border-t border-gray-200">
            <Link
              href="/workouts"
              className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || !name}
              className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Create Workout"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Helper functions removed - now handled by garmin-training-service.ts
