"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import type { ActivityPostOwnerPayload } from "@/lib/gofast-with-me/activity-posts";

type Props = {
  athleteId: string;
  activityId: string;
  activityLabel: string;
  existingPost?: ActivityPostOwnerPayload | null;
  onPublished?: (post: ActivityPostOwnerPayload) => void;
};

export default function ActivityAddStuffPanel({
  athleteId,
  activityId,
  activityLabel,
  existingPost,
  onPublished,
}: Props) {
  const [caption, setCaption] = useState(existingPost?.caption ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(existingPost?.photoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(Boolean(existingPost?.isPublished));
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoPick = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
      setPhotoUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const handlePublish = useCallback(async () => {
    setPosting(true);
    setError(null);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Sign in required");
      const token = await u.getIdToken();
      const res = await fetch(`/api/athlete/${encodeURIComponent(athleteId)}/activity-posts`, {
        method: "POST",
        headers: {
          ...athleteBearerFetchHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          activityId,
          caption: caption.trim() || null,
          photoUrl,
          showMatchedWorkout: false,
          publish: true,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        post?: ActivityPostOwnerPayload;
        error?: string;
      };
      if (!res.ok || !data.success || !data.post) {
        throw new Error(data.error || "Could not save");
      }
      setPublished(true);
      onPublished?.(data.post);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setPosting(false);
    }
  }, [activityId, athleteId, caption, onPublished, photoUrl]);

  const handleUnpublish = useCallback(async () => {
    if (!existingPost?.id && !published) return;
    setPosting(true);
    setError(null);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Sign in required");
      const token = await u.getIdToken();
      const postId = existingPost?.id;
      if (!postId) {
        setPublished(false);
        return;
      }
      const res = await fetch(
        `/api/athlete/${encodeURIComponent(athleteId)}/activity-posts/${encodeURIComponent(postId)}`,
        {
          method: "DELETE",
          headers: athleteBearerFetchHeaders(token),
        }
      );
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error || "Could not remove");
      setPublished(false);
      setCaption("");
      setPhotoUrl(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove");
    } finally {
      setPosting(false);
    }
  }, [athleteId, existingPost?.id, published]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
      <h2 className="text-sm font-semibold text-gray-900">Add a note</h2>
      <p className="mt-1 text-sm text-gray-600">
        {activityLabel} — photo and a few words about how it felt.
      </p>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-4">
        <label htmlFor="activity-caption-inline" className="text-xs font-semibold text-gray-700">
          Note
        </label>
        <textarea
          id="activity-caption-inline"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          maxLength={2000}
          className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm"
          placeholder="How did it feel?"
        />
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-700">Photo</p>
        {photoUrl ? (
          <div className="mt-2 relative">
            <img src={photoUrl} alt="" className="w-full max-h-48 rounded-xl object-cover" />
            <button
              type="button"
              onClick={() => setPhotoUrl(null)}
              className="absolute top-2 right-2 rounded-full bg-black/50 px-2 py-1 text-xs text-white"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 py-8 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
            Add a photo
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handlePhotoPick(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={posting || uploading || (!caption.trim() && !photoUrl)}
          onClick={() => void handlePublish()}
          className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {posting ? "Saving…" : published ? "Update" : "Save"}
        </button>
        {published ? (
          <button
            type="button"
            disabled={posting}
            onClick={() => void handleUnpublish()}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </div>
    </section>
  );
}
