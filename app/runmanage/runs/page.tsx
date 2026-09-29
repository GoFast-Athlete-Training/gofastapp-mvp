"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, CheckCircle, Edit, Eye, MapPin, Users } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";

interface RunClub {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
}

interface Run {
  id: string;
  title: string;
  citySlug: string;
  meetUpPoint: string;
  meetUpCity: string | null;
  meetUpState: string | null;
  date: string;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  workflowStatus?: string;
  dayOfWeek: string | null;
  runClubId: string | null;
  runClub: RunClub | null;
  rsvpCount?: number;
  totalMiles?: number | null;
  stravaMapUrl?: string | null;
  staffNotes?: string | null;
}

function getRunCompletion(run: Run): { complete: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!run.title?.trim()) missing.push("Title");
  if (!run.date) missing.push("Date");
  if (run.startTimeHour == null || run.startTimeMinute == null) missing.push("Time");
  if (!run.meetUpPoint?.trim()) missing.push("Location");
  if (run.totalMiles == null || run.totalMiles === 0) missing.push("Miles");
  if (!run.stravaMapUrl?.trim()) missing.push("Strava URL");
  return { complete: missing.length === 0, missing };
}

export default function RunManageRunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "develop" | "pending" | "submitted" | "approved">(
    "all"
  );

  useEffect(() => {
    void fetchRuns();
  }, [filter]);

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== "all") params.append("workflowStatus", filter.toUpperCase());
      const response = await runmanageApi.get(`/api/runs/manage?${params.toString()}`);
      if (response.data.success) {
        setRuns(response.data.runs || []);
      }
    } catch (error) {
      console.error("Error fetching runs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (runId: string) => {
    if (!confirm("Approve this run? It will be marked approved in the editorial workflow.")) {
      return;
    }
    try {
      const response = await runmanageApi.post(`/api/runs/manage/${runId}/approve`, {});
      if (response.data.success) {
        void fetchRuns();
      }
    } catch {
      alert("Failed to approve run. Please try again.");
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const formatTime = (
    hour: number | null,
    minute: number | null,
    period: string | null
  ) => {
    if (hour === null || minute === null) return "";
    const minStr = minute.toString().padStart(2, "0");
    return `${hour}:${minStr} ${period || "AM"}`;
  };

  const getWorkflowBadge = (workflowStatus: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      DEVELOP: { label: "Develop", color: "bg-gray-100 text-gray-700 border-gray-200" },
      PENDING: { label: "Pending", color: "bg-yellow-50 text-yellow-800 border-yellow-200" },
      SUBMITTED: { label: "Submitted", color: "bg-blue-50 text-blue-800 border-blue-200" },
      APPROVED: { label: "Approved", color: "bg-green-50 text-green-800 border-green-200" },
    };
    return badges[workflowStatus] || badges.DEVELOP;
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upcoming runs</h1>
          <p className="text-sm text-gray-600">Prod city runs — edit and approve on this host.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "develop", "pending", "submitted", "approved"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-sm capitalize ${
                filter === f
                  ? "bg-sky-600 text-white"
                  : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading runs…</p>
      ) : runs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
          No runs match this filter.
        </p>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const completion = getRunCompletion(run);
            const badge = getWorkflowBadge(run.workflowStatus || "DEVELOP");
            return (
              <div
                key={run.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-gray-900">{run.title}</h2>
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${badge.color}`}>
                        {badge.label}
                      </span>
                      {!completion.complete ? (
                        <span className="text-xs text-amber-700">Missing: {completion.missing.join(", ")}</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(run.date)} · {formatTime(run.startTimeHour, run.startTimeMinute, run.startTimePeriod)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {run.meetUpPoint}
                        {run.meetUpCity ? `, ${run.meetUpCity}` : ""}
                      </span>
                      {run.runClub ? (
                        <span>{run.runClub.name}</span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {run.rsvpCount ?? 0} RSVPs
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/runmanage/runs/${run.id}?mode=view`}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                    >
                      <Eye className="h-4 w-4" /> View
                    </Link>
                    <Link
                      href={`/runmanage/runs/${run.id}?mode=edit`}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                    >
                      <Edit className="h-4 w-4" /> Edit
                    </Link>
                    {run.workflowStatus !== "APPROVED" ? (
                      <button
                        type="button"
                        onClick={() => void handleApprove(run.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4" /> Approve
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
