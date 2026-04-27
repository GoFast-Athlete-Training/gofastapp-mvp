"use client";

import { useState } from "react";
import { Trophy, X } from "lucide-react";
import api from "@/lib/api";

export type RaceCompleteAnalysis = {
  headline: string;
  subText: string;
  prFlag: boolean;
  goalBeatFlag: boolean;
  deltaDisplay: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  goalId: string;
  raceName: string;
  onComplete: (payload: { analysis: RaceCompleteAnalysis | null }) => void;
};

export function raceCongratsStorageKey(goalId: string) {
  return `raceCongratsDismissed-${goalId}`;
}

export function isRaceCongratsDismissed(goalId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(raceCongratsStorageKey(goalId)) === "1";
}

export function dismissRaceCongratsStorage(goalId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(raceCongratsStorageKey(goalId), "1");
  } catch {
    /* ignore */
  }
}

type Step = "congrats" | "form" | "analysis";

export default function RaceCompleteModal({ open, onClose, goalId, raceName, onComplete }: Props) {
  const [step, setStep] = useState<Step>("congrats");
  const [finishTime, setFinishTime] = useState("");
  const [howFelt, setHowFelt] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<RaceCompleteAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const reset = () => {
    setStep("congrats");
    setFinishTime("");
    setHowFelt(null);
    setAnalysis(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSkip = () => {
    dismissRaceCongratsStorage(goalId);
    handleClose();
  };

  const handleSubmitTime = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const t = finishTime.trim();
    if (!t) {
      setError("Add your finish time to continue");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/race-results", {
        goalId,
        officialFinishTime: t,
        howFeltRating: howFelt,
      });
      const a = res.data?.analysis as RaceCompleteAnalysis | undefined;
      setAnalysis(a ?? null);
      setStep("analysis");
      onComplete({ analysis: a ?? null });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : "Save failed");
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleDone = () => {
    dismissRaceCongratsStorage(goalId);
    reset();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleSkip();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          {step === "analysis" ? (
            <h2 className="text-lg font-semibold text-gray-900">How it went</h2>
          ) : step === "form" ? (
            <h2 className="text-lg font-semibold text-gray-900">Log your time</h2>
          ) : (
            <h2 className="text-lg font-semibold text-gray-900">You did it</h2>
          )}
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "congrats" ? (
          <div className="px-5 py-6 text-center">
            <Trophy className="h-16 w-16 mx-auto text-amber-500" aria-hidden />
            <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-emerald-800">
              Race in the books
            </p>
            <p className="mt-2 text-lg font-bold text-gray-900">{raceName}</p>
            <p className="mt-2 text-sm text-gray-600">
              Log your finish time and we&apos;ll stack it next to your goal and call out a PR.
            </p>
            <button
              type="button"
              onClick={() => setStep("form")}
              className="mt-6 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Log your finish time
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="mt-2 w-full py-2 text-sm font-medium text-gray-500 hover:text-gray-800"
            >
              Skip for now
            </button>
          </div>
        ) : null}

        {step === "form" ? (
          <form onSubmit={handleSubmitTime} className="px-5 py-4 space-y-4">
            <p className="text-sm text-gray-600">
              Net/chip time for <span className="font-medium text-gray-900">{raceName}</span>
            </p>
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <div>
              <label htmlFor="rcm-time" className="text-xs font-medium text-gray-500 block">
                Finish time
              </label>
              <input
                id="rcm-time"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                value={finishTime}
                onChange={(e) => setFinishTime(e.target.value)}
                inputMode="text"
                autoComplete="off"
                required
              />
              <p className="mt-0.5 text-xs text-gray-500">e.g. 3:15:00 or 42:30</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">How did it feel? (optional)</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setHowFelt(howFelt === n ? null : n)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                      howFelt === n
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save & see recap"}
            </button>
          </form>
        ) : null}

        {step === "analysis" && analysis ? (
          <div className="px-5 py-6 space-y-3">
            <p className="text-base font-bold text-gray-900">{analysis.headline}</p>
            <p className="text-sm text-gray-700 leading-relaxed">{analysis.subText}</p>
            <button
              type="button"
              onClick={handleDone}
              className="w-full mt-2 rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Done
            </button>
          </div>
        ) : null}

        {step === "analysis" && !analysis ? (
          <div className="px-5 py-6">
            <p className="text-sm text-gray-700">Your result is saved. Head to the home card to review.</p>
            <button
              type="button"
              onClick={handleDone}
              className="w-full mt-4 rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Done
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
