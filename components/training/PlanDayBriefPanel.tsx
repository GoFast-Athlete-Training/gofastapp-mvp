"use client";

import { useCallback, useState } from "react";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import type {
  DayBriefResult,
  PlanIngestPreviewResult,
} from "@/lib/training/plan-ingest-contract";

type Props = {
  planId: string;
  dateKey: string;
  getToken: () => Promise<string | null>;
  onAccepted?: () => void;
};

const STANCE_LABEL: Record<DayBriefResult["stance"], string> = {
  keep: "Keep the plan",
  shorten: "Shorten today",
  swap: "Swap session",
  rest: "Rest day",
};

export default function PlanDayBriefPanel({ planId, dateKey, getToken, onAccepted }: Props) {
  const [note, setNote] = useState("");
  const [brief, setBrief] = useState<DayBriefResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runBrief = useCallback(async () => {
    setError(null);
    setBrief(null);
    const token = await getToken();
    if (!token) {
      setError("Sign in to continue");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/training/plan/day-brief", {
        method: "POST",
        headers: {
          ...athleteBearerFetchHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId, dateKey, note: note.trim() || undefined }),
      });
      const data = (await res.json()) as { error?: string; brief?: DayBriefResult };
      if (!res.ok) {
        setError(data.error ?? "Could not build brief");
        return;
      }
      if (data.brief) setBrief(data.brief);
    } catch {
      setError("Could not build brief");
    } finally {
      setLoading(false);
    }
  }, [getToken, planId, dateKey, note]);

  const acceptProposal = useCallback(async () => {
    const preview = brief?.proposedIngest;
    if (!preview) return;
    const token = await getToken();
    if (!token) return;
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch("/api/training/plan/day-brief", {
        method: "PATCH",
        headers: {
          ...athleteBearerFetchHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId, preview }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not apply");
        return;
      }
      setBrief(null);
      onAccepted?.();
    } catch {
      setError("Could not apply");
    } finally {
      setAccepting(false);
    }
  }, [brief, getToken, planId, onAccepted]);

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-900">
        What does today call for?
      </p>
      <p className="mt-1 text-violet-950/90">
        Rain, lifting, yesterday&apos;s miles, taper — we&apos;ll suggest a call. You confirm before
        anything changes.
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="e.g. Raining, heavy legs from Thursday squats, ran 9 yesterday faster than planned, in taper"
        className="mt-3 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400"
      />
      <button
        type="button"
        disabled={loading}
        onClick={() => void runBrief()}
        className="mt-2 rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
      >
        {loading ? "Thinking…" : "Get today’s call"}
      </button>

      {brief ? (
        <div className="mt-3 space-y-2 rounded-lg border border-violet-100 bg-white px-3 py-3">
          <p className="font-semibold text-gray-900">{STANCE_LABEL[brief.stance]}</p>
          <ul className="list-disc space-y-1 pl-5 text-gray-700">
            {brief.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {brief.proposedIngest ? (
            <div className="border-t border-gray-100 pt-2">
              <p className="text-gray-800">
                {(brief.proposedIngest as PlanIngestPreviewResult).summary}
              </p>
              <button
                type="button"
                disabled={accepting}
                onClick={() => void acceptProposal()}
                className="mt-2 rounded-lg border border-violet-600 px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-50"
              >
                {accepting ? "Applying…" : "Accept suggestion"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="mt-2 text-red-700">{error}</p> : null}
    </div>
  );
}
