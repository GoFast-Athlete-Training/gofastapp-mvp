"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trophy, X } from "lucide-react";
import api from "@/lib/api";
import { uploadRacePhotoFile } from "@/lib/race-result-upload";
import { FINISH_TIME_PATTERN } from "@/lib/race-result-helpers";

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

type Step = "congrats" | "form" | "analysis" | "reflect";

export default function RaceCompleteModal({ open, onClose, goalId, raceName, onComplete }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("congrats");
  const [finishTime, setFinishTime] = useState("");
  const [howFelt, setHowFelt] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<RaceCompleteAnalysis | null>(null);
  const [savedResultId, setSavedResultId] = useState<string | null>(null);
  const [reflectionDraft, setReflectionDraft] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [reflectError, setReflectError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [reflectionSaving, setReflectionSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const reset = () => {
    setStep("congrats");
    setFinishTime("");
    setHowFelt(null);
    setAnalysis(null);
    setSavedResultId(null);
    setReflectionDraft("");
    setPhotoUrls([]);
    setReflectError(null);
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
    if (!FINISH_TIME_PATTERN.test(t)) {
      setError("Use a clock time like 3:45:30 or 45:20 (include colons).");
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
      const rid = res.data?.result?.id;
      setAnalysis(a ?? null);
      setSavedResultId(typeof rid === "string" ? rid : null);
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

  const goToReflect = () => {
    setReflectError(null);
    setStep("reflect");
  };

  const handleReflectPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setReflectError(null);
    setUploadBusy(true);
    try {
      const next: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!f.type.startsWith("image/")) continue;
        next.push(await uploadRacePhotoFile(f));
      }
      if (next.length) setPhotoUrls((prev) => [...prev, ...next]);
    } catch (err: unknown) {
      setReflectError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadBusy(false);
      e.target.value = "";
    }
  };

  const removePhotoAt = (idx: number) => {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveReflection = async () => {
    if (!savedResultId) {
      handleDone();
      return;
    }
    setReflectError(null);
    setReflectionSaving(true);
    try {
      await api.put(`/race-results/${savedResultId}`, {
        reflection: reflectionDraft.trim() || null,
        racePhotoUrls: photoUrls,
      });
      handleDone();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : "Save failed");
      setReflectError(String(msg));
    } finally {
      setReflectionSaving(false);
    }
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
          {step === "reflect" ? (
            <h2 className="text-lg font-semibold text-gray-900">Race memories</h2>
          ) : step === "analysis" ? (
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
              onClick={goToReflect}
              className="w-full mt-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Save a reflection & photos
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Finish without
            </button>
          </div>
        ) : null}

        {step === "analysis" && !analysis ? (
          <div className="px-5 py-6 space-y-3">
            <p className="text-sm text-gray-700">Your result is saved. Head to the home card to review.</p>
            <button
              type="button"
              onClick={goToReflect}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Add reflection & photos
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Done
            </button>
          </div>
        ) : null}

        {step === "reflect" ? (
          <div className="px-5 py-4 space-y-4">
            <p className="text-sm text-gray-600">
              Optional — capture how <span className="font-medium text-gray-900">{raceName}</span> felt while
              it&apos;s fresh.
            </p>
            {reflectError ? (
              <p className="text-sm text-red-600" role="alert">
                {reflectError}
              </p>
            ) : null}
            <div>
              <label htmlFor="rcm-reflect" className="text-xs font-medium text-gray-500 block">
                Reflection
              </label>
              <textarea
                id="rcm-reflect"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 min-h-[100px]"
                value={reflectionDraft}
                onChange={(e) => setReflectionDraft(e.target.value)}
              />
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => void handleReflectPhotos(e)}
              />
              {photoUrls.length > 0 ? (
                <ul className="flex flex-wrap gap-2 mb-2">
                  {photoUrls.map((url, idx) => (
                    <li key={`${url}-${idx}`} className="relative w-16 h-16 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element -- blob URLs */}
                      <img src={url} alt="" className="w-full h-full object-cover rounded-lg border border-gray-200" />
                      <button
                        type="button"
                        aria-label="Remove photo"
                        onClick={() => removePhotoAt(idx)}
                        className="absolute -top-1 -right-1 rounded-full bg-gray-900 text-white p-0.5 hover:bg-black"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                disabled={uploadBusy || !savedResultId}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                {uploadBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                {uploadBusy ? "Uploading…" : "Add race photos"}
              </button>
              {!savedResultId ? (
                <p className="mt-1 text-xs text-amber-700">Missing result id — close and reopen from home.</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                disabled={reflectionSaving || !savedResultId}
                onClick={() => void handleSaveReflection()}
                className="w-full rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {reflectionSaving ? "Saving…" : "Save & finish"}
              </button>
              <button
                type="button"
                onClick={handleDone}
                disabled={reflectionSaving}
                className="w-full rounded-xl py-2.5 text-sm font-medium text-gray-500 hover:text-gray-900"
              >
                Skip for now
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
