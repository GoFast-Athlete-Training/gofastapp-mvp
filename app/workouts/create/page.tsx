"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Repeat } from "lucide-react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
// Garmin conversion handled server-side by garmin-training-service.ts

interface WorkoutSegment {
  id: string;
  title: string;
  miles: number;
  pace?: string;
  hrMin?: number;
  hrMax?: number;
  repeatCount?: number; // For intervals: repeat this segment N times
}

export default function CreateWorkoutPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Build workout data
      const workoutData = {
        title: name,
        description,
        workoutType: "Easy", // Default, could be selectable
        segments: useSegments
          ? segments.map((seg, index) => ({
              stepOrder: index + 1,
              title: seg.title,
              durationType: "DISTANCE", // Could be TIME if needed
              durationValue: seg.miles,
              paceTarget: seg.pace,
              hrMin: seg.hrMin,
              hrMax: seg.hrMax,
              repeatCount: seg.repeatCount,
            }))
          : [
              {
                stepOrder: 1,
                title: "Main Set",
                durationType: "DISTANCE",
                durationValue: overallMiles,
                paceTarget: overallPace || undefined,
                hrMin: overallHrMin,
                hrMax: overallHrMax,
              },
            ],
      };

      // TODO: Save to API
      const response = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workoutData),
      });

      if (!response.ok) throw new Error("Failed to create workout");

      const workout = await response.json();
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
