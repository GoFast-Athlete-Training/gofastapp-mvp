'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Users } from 'lucide-react';
import api from '@/lib/api';
import { HOW_FELT_LABELS } from '@/lib/gofast-with-me/how-felt-labels';
import type { WorkoutStoryOwnerPayload } from '@/lib/gofast-with-me/workout-stories';

type Props = {
  workoutId: string;
  plannedTitle: string;
  /** Show when session is done (matched, skipped, or past scheduled day). */
  visible: boolean;
};

export default function WorkoutCommunityStoryCard({ workoutId, plannedTitle, visible }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [story, setStory] = useState<WorkoutStoryOwnerPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [containerEnabled, setContainerEnabled] = useState<boolean | null>(null);
  const [publicTitle, setPublicTitle] = useState('');
  const [howFelt, setHowFelt] = useState<number | null>(null);
  const [reflection, setReflection] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadStory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ success?: boolean; story?: WorkoutStoryOwnerPayload; error?: string }>(
        `/workouts/${encodeURIComponent(workoutId)}/community`
      );
      if (res.status === 403) {
        setContainerEnabled(false);
        return;
      }
      if (!res.data?.success || !res.data.story) {
        throw new Error(res.data?.error || 'Could not load community story');
      }
      setContainerEnabled(true);
      const s = res.data.story;
      setStory(s);
      setPublicTitle(s.publicTitle ?? '');
      setHowFelt(s.howFeltRating);
      setReflection(s.reflection ?? '');
      setPhotoUrl(s.workoutPhotoUrl);
    } catch (e) {
      setContainerEnabled(false);
      setError(e instanceof Error ? e.message : 'Could not load community story');
    } finally {
      setLoading(false);
    }
  }, [workoutId]);

  useEffect(() => {
    if (!visible) return;
    void loadStory();
  }, [visible, loadStory]);

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
    setSuccess(null);
    try {
      const res = await api.patch<{ success?: boolean; story?: WorkoutStoryOwnerPayload; error?: string }>(
        `/workouts/${encodeURIComponent(workoutId)}/community`,
        {
          publicTitle: publicTitle.trim() || null,
          howFeltRating: howFelt,
          reflection: reflection.trim() || null,
          workoutPhotoUrl: photoUrl,
          publish: true,
        }
      );
      if (!res.data?.success || !res.data.story) {
        throw new Error(res.data?.error || 'Could not publish');
      }
      setStory(res.data.story);
      setSuccess('Shared with your followers.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || (e instanceof Error ? e.message : 'Could not publish'));
    } finally {
      setPosting(false);
    }
  }, [workoutId, publicTitle, howFelt, reflection, photoUrl]);

  const handleUnpublish = useCallback(async () => {
    setPosting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.patch<{ success?: boolean; story?: WorkoutStoryOwnerPayload; error?: string }>(
        `/workouts/${encodeURIComponent(workoutId)}/community`,
        { unpublish: true }
      );
      if (!res.data?.success || !res.data.story) {
        throw new Error(res.data?.error || 'Could not remove from community');
      }
      setStory(res.data.story);
      setSuccess('Removed from your member feed.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || (e instanceof Error ? e.message : 'Could not unpublish'));
    } finally {
      setPosting(false);
    }
  }, [workoutId]);

  if (!visible || containerEnabled === false) return null;
  if (loading && containerEnabled === null) {
    return (
      <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50/40 p-5 text-sm text-gray-600">
        Loading community share…
      </div>
    );
  }
  if (containerEnabled !== true) return null;

  const canPublish = Boolean(publicTitle.trim() || reflection.trim() || photoUrl);

  return (
    <section className="mb-6 rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50/80 to-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <Users className="h-5 w-5 text-orange-700 mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-800">
              Tell your people
            </p>
            <h2 className="mt-1 text-lg font-bold text-gray-900">
              This is the build — not a recap
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              What do you want followers to know about this session? Honest beats highlight-reel.
            </p>
            {story?.isPublished ? (
              <p className="mt-2 text-xs font-semibold text-emerald-800">
                On your member feed — followers can see this story.
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {success}
            </p>
          ) : null}

          <div>
            <label htmlFor="community-public-title" className="text-xs font-semibold text-gray-700">
              Public title
            </label>
            <input
              id="community-public-title"
              type="text"
              value={publicTitle}
              onChange={(e) => setPublicTitle(e.target.value)}
              maxLength={120}
              placeholder={`e.g. Legs were junk but I finished the ${plannedTitle}`}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700">How did it feel?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setHowFelt(howFelt === n ? null : n)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    howFelt === n
                      ? 'border-orange-500 bg-orange-100 text-orange-900'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {HOW_FELT_LABELS[n]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="community-reflection" className="text-xs font-semibold text-gray-700">
              Reflection
            </label>
            <textarea
              id="community-reflection"
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="Tell your followers how it felt — what you overcame, what sucked, what you're proud of."
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm"
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
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white py-8 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
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

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={posting || uploading || !canPublish}
              onClick={() => void handlePublish()}
              className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {posting ? 'Sharing…' : story?.isPublished ? 'Update on feed' : 'Share with followers'}
            </button>
            {story?.isPublished ? (
              <button
                type="button"
                disabled={posting}
                onClick={() => void handleUnpublish()}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Remove from feed
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
