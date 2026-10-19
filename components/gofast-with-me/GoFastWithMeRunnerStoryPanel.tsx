'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { runnerPublicLandingUrl } from '@/lib/gofast-with-me/runner-public-url';
import TipMediaPicker from '@/components/gofast-with-me/TipMediaPicker';
import type { AthleteTipMediaType } from '@/lib/gofast-with-me/athlete-tips';
import { STUDIO_RUNNER_STORY_LABEL } from '@/components/gofast-with-me/studio-sections';

export type RunnerStoryEditorValues = {
  runnerStory: string | null;
  runnerStoryTitle: string | null;
  runnerStoryPhotoUrl: string | null;
};

type Props = {
  publicSlug: string;
  initialRunnerStory: string | null;
  initialRunnerStoryTitle?: string | null;
  initialRunnerStoryPhotoUrl?: string | null;
  onSaved: (values: RunnerStoryEditorValues) => void;
};

export default function GoFastWithMeRunnerStoryPanel({
  publicSlug,
  initialRunnerStory,
  initialRunnerStoryTitle = null,
  initialRunnerStoryPhotoUrl = null,
  onSaved,
}: Props) {
  const [title, setTitle] = useState(initialRunnerStoryTitle ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialRunnerStoryPhotoUrl);
  const [photoType, setPhotoType] = useState<AthleteTipMediaType | null>(
    initialRunnerStoryPhotoUrl ? 'image' : null
  );
  const [body, setBody] = useState(initialRunnerStory ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTitle(initialRunnerStoryTitle ?? '');
    setPhotoUrl(initialRunnerStoryPhotoUrl ?? null);
    setPhotoType(initialRunnerStoryPhotoUrl ? 'image' : null);
    setBody(initialRunnerStory ?? '');
  }, [initialRunnerStory, initialRunnerStoryTitle, initialRunnerStoryPhotoUrl]);

  const storyUrl = `${runnerPublicLandingUrl(publicSlug).replace(/\/$/, '')}/story`;
  const hasPublishedContent = Boolean(title.trim() || photoUrl?.trim() || body.trim());

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const payload = {
      runnerStory: body.trim() || null,
      runnerStoryTitle: title.trim() || null,
      runnerStoryPhotoUrl: photoUrl?.trim() || null,
    };
    try {
      const res = await api.patch('/me/gofast-with-me', payload);
      const gwm = res.data?.gofastWithMe as RunnerStoryEditorValues | undefined;
      const next: RunnerStoryEditorValues = {
        runnerStory: gwm?.runnerStory ?? payload.runnerStory,
        runnerStoryTitle: gwm?.runnerStoryTitle ?? payload.runnerStoryTitle,
        runnerStoryPhotoUrl: gwm?.runnerStoryPhotoUrl ?? payload.runnerStoryPhotoUrl,
      };
      onSaved(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not save run story');
    } finally {
      setSaving(false);
    }
  }, [body, title, photoUrl, onSaved]);

  return (
    <section className="space-y-6 pb-8 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{STUDIO_RUNNER_STORY_LABEL}</h2>
        <p className="text-sm text-gray-600 mt-1">
          One blog-style post at{' '}
          <span className="font-medium text-gray-800">your handle/story</span> — photo, title, and
          body. Your Public Welcome landing stays at your GoFast handle root.
        </p>
        {hasPublishedContent ? (
          <Link
            href={storyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex mt-2 text-sm font-semibold text-orange-700 hover:text-orange-800"
          >
            Preview public story page →
          </Link>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {saved ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Run story saved.
        </div>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="runner-story-title" className="text-xs font-semibold text-gray-700">
          Title
        </label>
        <input
          id="runner-story-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          placeholder="How I came back to running"
        />
        <p className="text-xs text-gray-500">Leave blank to show “My run story” on the public page.</p>
      </div>

      <TipMediaPicker
        mediaUrl={photoUrl}
        mediaType={photoType}
        onChange={(next) => {
          setPhotoUrl(next.mediaUrl);
          setPhotoType(next.mediaType);
        }}
        disabled={saving}
      />

      <div className="space-y-2">
        <label htmlFor="runner-story-body" className="text-xs font-semibold text-gray-700">
          Body
        </label>
        <textarea
          id="runner-story-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={16}
          className="w-full rounded-xl border border-gray-300 p-4 text-sm leading-relaxed focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          placeholder="I started running when I was 3, gave it up, came back…"
        />
      </div>

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save run story'}
      </button>
    </section>
  );
}
