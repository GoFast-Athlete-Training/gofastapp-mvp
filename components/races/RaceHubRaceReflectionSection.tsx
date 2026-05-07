"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, ImagePlus, Loader2, PenLine, X } from "lucide-react";
import api from "@/lib/api";
import { uploadRacePhotoFile } from "@/lib/race-result-upload";

type Props = {
  raceName: string;
  resultId: string;
  reflection: string | null;
  racePhotoUrls: string[];
  onUpdated: () => void | Promise<void>;
};

export default function RaceHubRaceReflectionSection({
  raceName,
  resultId,
  reflection,
  racePhotoUrls,
  onUpdated,
}: Props) {
  const photoRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draftReflection, setDraftReflection] = useState(reflection ?? "");
  const [draftPhotos, setDraftPhotos] = useState<string[]>(racePhotoUrls);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDraftReflection(reflection ?? "");
    setDraftPhotos(racePhotoUrls);
  }, [reflection, racePhotoUrls, resultId]);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setPhotoBusy(true);
    setErr(null);
    try {
      const next: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!f.type.startsWith("image/")) continue;
        next.push(await uploadRacePhotoFile(f));
      }
      if (next.length) setDraftPhotos((prev) => [...prev, ...next]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPhotoBusy(false);
      e.target.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.put(`/race-results/${resultId}`, {
        reflection: draftReflection.trim() || null,
        racePhotoUrls: draftPhotos,
      });
      setEditing(false);
      await onUpdated();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (e instanceof Error ? e.message : "Save failed");
      setErr(String(msg));
    } finally {
      setBusy(false);
    }
  }

  function cancelEdit() {
    setEditing(false);
    setDraftReflection(reflection ?? "");
    setDraftPhotos(racePhotoUrls);
    setErr(null);
  }

  const hasReflection = Boolean(reflection?.trim());
  const hasPhotos = racePhotoUrls.length > 0;
  const hasContent = hasReflection || hasPhotos;

  return (
    <section
      id="reflection"
      className="bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 scroll-mt-20"
      aria-labelledby="reflection-heading"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 id="reflection-heading" className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600 shrink-0" />
            Reflection & race photos
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Your recap for <span className="font-medium text-gray-800">{raceName}</span>. Only visible to you —
            not posted to chatter.
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          >
            <PenLine className="w-3.5 h-3.5" />
            Edit
          </button>
        ) : null}
      </div>

      {err ? (
        <p className="text-sm text-red-600 mb-3" role="alert">
          {err}
        </p>
      ) : null}

      {!editing ? (
        <>
          {!hasContent ? (
            <p className="text-sm text-gray-700">
              Add a short reflection and photos while the day is fresh. Open <span className="font-medium">Edit</span>{" "}
              above to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {hasReflection ? (
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{reflection}</p>
              ) : null}
              {hasPhotos ? (
                <ul className="flex flex-wrap gap-2">
                  {racePhotoUrls.map((url, idx) => (
                    <li key={`${url}-${idx}`} className="w-24 h-24 sm:w-28 sm:h-28">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="w-full h-full object-cover rounded-xl border border-gray-200"
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div>
            <label htmlFor="hub-reflection-body" className="text-xs font-medium text-gray-500 block">
              Reflection
            </label>
            <textarea
              id="hub-reflection-body"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 min-h-[100px]"
              value={draftReflection}
              onChange={(e) => setDraftReflection(e.target.value)}
            />
          </div>
          <div>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => void handlePick(e)}
            />
            {draftPhotos.length > 0 ? (
              <ul className="flex flex-wrap gap-2 mb-2">
                {draftPhotos.map((url, idx) => (
                  <li key={`${url}-${idx}`} className="relative w-16 h-16 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => setDraftPhotos((p) => p.filter((_, i) => i !== idx))}
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
              onClick={() => photoRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {photoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              {photoBusy ? "Uploading…" : "Add photos"}
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancelEdit}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
