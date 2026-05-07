"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import api from "@/lib/api";
import { FINISH_TIME_PATTERN } from "@/lib/race-result-helpers";
import { uploadRacePhotoFile } from "@/lib/race-result-upload";

export { FINISH_TIME_PATTERN } from "@/lib/race-result-helpers";

export type LogRaceResultSheetProps = {
  open: boolean;
  onClose: () => void;
  /** `race_registry.id` */
  raceRegistryId: string;
  raceName: string;
  /** ISO or Y-m-d (display context only) */
  raceDateYmd: string;
  goalId?: string | null;
  signupId?: string | null;
  onSaved?: () => void;
};

type ResultRow = {
  id: string;
  officialFinishTime: string | null;
  chipTime: string | null;
  gunTime: string | null;
  source: string;
  reflection?: string | null;
  racePhotoUrls?: string[] | null;
};

export default function LogRaceResultSheet({
  open,
  onClose,
  raceRegistryId,
  raceName,
  goalId,
  signupId,
  onSaved,
}: LogRaceResultSheetProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<ResultRow | null>(null);

  const [finishTime, setFinishTime] = useState("");
  const [reflection, setReflection] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);

  const resetEmpty = () => {
    setExisting(null);
    setFinishTime("");
    setReflection("");
    setPhotoUrls([]);
  };

  const loadExisting = useCallback(async () => {
    const res = await api.get("/race-results", { params: { raceRegistryId } });
    const list = res.data?.results;
    if (Array.isArray(list) && list[0]) {
      const r = list[0] as ResultRow;
      setExisting(r);
      setFinishTime(r.officialFinishTime ?? r.chipTime ?? r.gunTime ?? "");
      setReflection(r.reflection ?? "");
      setPhotoUrls(Array.isArray(r.racePhotoUrls) ? r.racePhotoUrls : []);
    } else {
      resetEmpty();
    }
  }, [raceRegistryId]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    void loadExisting();
  }, [open, loadExisting]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const added: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!f.type.startsWith("image/")) continue;
        added.push(await uploadRacePhotoFile(f));
      }
      if (added.length) setPhotoUrls((prev) => [...prev, ...added]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setPhotoBusy(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = finishTime.trim();
    if (!trimmed) {
      setError("Enter your finish time.");
      return;
    }
    if (!FINISH_TIME_PATTERN.test(trimmed)) {
      setError("Use a clock time like 3:45:30 or 45:20 (include colons).");
      return;
    }

    setLoading(true);
    try {
      await api.post("/race-results", {
        raceRegistryId,
        goalId: goalId ?? null,
        signupId: signupId ?? null,
        officialFinishTime: trimmed,
        chipTime: null,
        gunTime: null,
        reflection: reflection.trim() || null,
        racePhotoUrls: photoUrls,
      });
      onSaved?.();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : "Save failed");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-race-result-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 shrink-0">
          <h2 id="log-race-result-title" className="text-lg font-semibold text-gray-900 pr-2">
            {existing ? "Update race result" : "Log your result"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{raceName}</span>
          </p>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div>
            <label htmlFor="lr-finish" className="text-xs font-medium text-gray-500 block">
              Finish time
            </label>
            <input
              id="lr-finish"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
              value={finishTime}
              onChange={(e) => setFinishTime(e.target.value)}
              inputMode="text"
              autoComplete="off"
            />
            <p className="mt-0.5 text-xs text-gray-500">e.g. 3:45:30 or 45:20</p>
          </div>

          <div>
            <label htmlFor="lr-reflection" className="text-xs font-medium text-gray-500 block">
              Race reflection
            </label>
            <textarea
              id="lr-reflection"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[80px] text-gray-900"
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
            />
          </div>

          <div>
            <span className="text-xs font-medium text-gray-500 block">Race photos</span>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => void handlePhotoPick(e)}
            />
            {photoUrls.length > 0 ? (
              <ul className="flex flex-wrap gap-2 mt-2 mb-2">
                {photoUrls.map((url, idx) => (
                  <li key={`${url}-${idx}`} className="relative w-16 h-16 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element -- external blob URLs */}
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => setPhotoUrls((prev) => prev.filter((_, i) => i !== idx))}
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
              disabled={photoBusy}
              onClick={() => photoInputRef.current?.click()}
              className="mt-1 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {photoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              {photoBusy ? "Uploading…" : "Add photos"}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2 pb-1">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "Saving…" : existing ? "Update" : "Save result"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
