'use client';

import { useCallback, useRef, useState } from 'react';
import { ImagePlus, Loader2, Share2, X } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { athleteBearerFetchHeaders } from '@/lib/athlete-bearer-fetch-headers';
import type { ActivityPostOwnerPayload } from '@/lib/gofast-with-me/activity-posts';

type Props = {
  athleteId: string;
  activityId: string;
  activityLabel: string;
  hasMatchedWorkout: boolean;
  existingPost?: ActivityPostOwnerPayload | null;
  onClose: () => void;
  onPublished?: (post: ActivityPostOwnerPayload) => void;
};

export default function ShareActivityToHubSheet({
  athleteId,
  activityId,
  activityLabel,
  hasMatchedWorkout,
  existingPost,
  onClose,
  onPublished,
}: Props) {
  const [caption, setCaption] = useState(existingPost?.caption ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(existingPost?.photoUrl ?? null);
  const [showMatchedWorkout, setShowMatchedWorkout] = useState(
    existingPost?.showMatchedWorkout ?? hasMatchedWorkout
  );
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoPick = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed');
      setPhotoUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const handlePublish = useCallback(async () => {
    setPosting(true);
    setError(null);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error('Sign in required');
      const token = await u.getIdToken();
      const res = await fetch(`/api/athlete/${encodeURIComponent(athleteId)}/activity-posts`, {
        method: 'POST',
        headers: {
          ...athleteBearerFetchHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activityId,
          caption: caption.trim() || null,
          photoUrl,
          showMatchedWorkout,
          publish: true,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        post?: ActivityPostOwnerPayload;
        error?: string;
      };
      if (!res.ok || !data.success || !data.post) {
        throw new Error(data.error || 'Could not share to hub');
      }
      onPublished?.(data.post);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not share to hub');
    } finally {
      setPosting(false);
    }
  }, [
    activityId,
    athleteId,
    caption,
    onClose,
    onPublished,
    photoUrl,
    showMatchedWorkout,
  ]);

  const handleUnpublish = useCallback(async () => {
    if (!existingPost?.id) return;
    setPosting(true);
    setError(null);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error('Sign in required');
      const token = await u.getIdToken();
      const res = await fetch(
        `/api/athlete/${encodeURIComponent(athleteId)}/activity-posts/${encodeURIComponent(existingPost.id)}`,
        {
          method: 'DELETE',
          headers: athleteBearerFetchHeaders(token),
        }
      );
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not remove from hub');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove from hub');
    } finally {
      setPosting(false);
    }
  }, [athleteId, existingPost?.id, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-orange-600" aria-hidden />
            <h2 className="text-base font-bold text-gray-900">Share to hub</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-sm text-gray-600">
            {activityLabel} — add a photo and describe it for your followers.
          </p>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <div>
            <label htmlFor="activity-caption" className="text-xs font-semibold text-gray-700">
              Caption
            </label>
            <textarea
              id="activity-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              maxLength={2000}
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm"
              placeholder="How did it feel? What stood out?"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700">Photo</p>
            {photoUrl ? (
              <div className="mt-2 relative">
                <img src={photoUrl} alt="" className="w-full max-h-48 rounded-xl object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white text-xs"
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
                e.target.value = '';
              }}
            />
          </div>

          {hasMatchedWorkout ? (
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showMatchedWorkout}
                onChange={(e) => setShowMatchedWorkout(e.target.checked)}
                className="mt-1"
              />
              <span>Show what the planned workout was (title + plan)</span>
            </label>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={posting || uploading || (!caption.trim() && !photoUrl)}
              onClick={() => void handlePublish()}
              className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {posting ? 'Sharing…' : existingPost?.isPublished ? 'Update on hub' : 'Share to hub'}
            </button>
            {existingPost?.isPublished ? (
              <button
                type="button"
                disabled={posting}
                onClick={() => void handleUnpublish()}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Remove from hub
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
