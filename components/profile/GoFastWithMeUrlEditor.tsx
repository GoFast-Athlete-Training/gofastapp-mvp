'use client';

import { useState } from 'react';
import api from '@/lib/api';

type Props = {
  gofastHandle: string;
  publicSlug: string;
  slugUsesHandle: boolean;
  publicUrl: string;
  onUpdated?: (slug: string, slugUsesHandle: boolean, publicUrl: string) => void;
};

export default function GoFastWithMeUrlEditor({
  gofastHandle,
  publicSlug,
  slugUsesHandle,
  publicUrl,
  onUpdated,
}: Props) {
  const [mode, setMode] = useState<'handle' | 'custom'>(slugUsesHandle ? 'handle' : 'custom');
  const [customSlug, setCustomSlug] = useState(slugUsesHandle ? '' : publicSlug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res =
        mode === 'handle'
          ? await api.patch('/me/gofast-with-me', { useGofastHandle: true })
          : await api.patch('/me/gofast-with-me', { customSlug });
      if (!res.data?.success) {
        throw new Error(res.data?.error || 'Save failed');
      }
      const gwm = res.data.gofastWithMe;
      onUpdated?.(
        gwm.gofastSlugSnapshot,
        gwm.slugUsesHandle,
        res.data.publicUrl || publicUrl
      );
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
      <h2 className="text-sm font-semibold text-gray-900">Your GoFast With Me link</h2>
      <p className="text-sm text-gray-600 mt-1">
        Use your GoFast handle by default, or set a custom GoFast With Me URL.
      </p>

      <div className="mt-3 space-y-2">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="radio"
            name="gwm-url-mode"
            checked={mode === 'handle'}
            onChange={() => setMode('handle')}
            className="mt-1"
          />
          <span className="text-sm text-gray-800">
            Use GoFast handle <code className="text-xs bg-white px-1 rounded">@{gofastHandle}</code>
          </span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="radio"
            name="gwm-url-mode"
            checked={mode === 'custom'}
            onChange={() => setMode('custom')}
            className="mt-1"
          />
          <span className="text-sm text-gray-800 w-full">
            Custom URL slug
            {mode === 'custom' ? (
              <input
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
                placeholder="your-custom-slug"
                className="mt-1.5 block w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
              />
            ) : null}
          </span>
        </label>
      </div>

      <code className="mt-3 block truncate rounded-lg border border-amber-200/80 bg-white px-3 py-2 text-xs text-gray-800">
        {publicUrl}
      </code>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving || (mode === 'custom' && !customSlug.trim())}
        className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Update link'}
      </button>
    </section>
  );
}
