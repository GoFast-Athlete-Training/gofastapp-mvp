'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { runnerPublicLandingUrl } from '@/lib/gofast-with-me/runner-public-url';

type Props = {
  publicSlug: string;
  initialRunnerStory: string | null;
  onSaved: (runnerStory: string | null) => void;
};

export default function GoFastWithMeRunnerStoryPanel({
  publicSlug,
  initialRunnerStory,
  onSaved,
}: Props) {
  const [text, setText] = useState(initialRunnerStory ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setText(initialRunnerStory ?? '');
  }, [initialRunnerStory]);

  const storyUrl = `${runnerPublicLandingUrl(publicSlug).replace(/\/$/, '')}/story`;

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api.patch('/me/gofast-with-me', {
        runnerStory: text.trim() || null,
      });
      const next = res.data?.gofastWithMe?.runnerStory ?? (text.trim() || null);
      onSaved(typeof next === 'string' ? next : text.trim() || null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not save runner story');
    } finally {
      setSaving(false);
    }
  }, [text, onSaved]);

  return (
    <section className="space-y-6 pb-8 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Runner story</h2>
        <p className="text-sm text-gray-600 mt-1">
          Your full life story — linked from the short About me on your landing page.
        </p>
        {text.trim() ? (
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
          Runner story saved.
        </div>
      ) : null}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={16}
        className="w-full rounded-xl border border-gray-300 p-4 text-sm leading-relaxed focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        placeholder="I started running when I was 3, gave it up, came back…"
      />

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save runner story'}
      </button>
    </section>
  );
}
