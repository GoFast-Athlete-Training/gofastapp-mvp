'use client';

import { useState } from 'react';
import api from '@/lib/api';

export type GoFastWithMeIntroValues = {
  welcome: string | null;
  gofastWithMeBio: string | null;
  whatYoullSeeHere: string | null;
  sportFocus: string | null;
  modelFocus: string | null;
  myAchievements: string | null;
};

type Props = {
  initial: GoFastWithMeIntroValues;
  profileBio?: string | null;
  onSaved?: (values: GoFastWithMeIntroValues) => void;
};

export default function GoFastWithMeIntroEditor({ initial, profileBio, onSaved }: Props) {
  const [values, setValues] = useState({
    welcome: initial.welcome ?? '',
    gofastWithMeBio: initial.gofastWithMeBio ?? '',
    whatYoullSeeHere: initial.whatYoullSeeHere ?? '',
    sportFocus: initial.sportFocus ?? '',
    modelFocus: initial.modelFocus ?? '',
    myAchievements: initial.myAchievements ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload = {
        welcome: values.welcome.trim() || null,
        gofastWithMeBio: values.gofastWithMeBio.trim() || null,
        whatYoullSeeHere: values.whatYoullSeeHere.trim() || null,
        sportFocus: values.sportFocus.trim() || null,
        modelFocus: values.modelFocus.trim() || null,
        myAchievements: values.myAchievements.trim() || null,
      };
      const res = await api.patch('/me/gofast-with-me', payload);
      if (!res.data?.success) {
        throw new Error(res.data?.error || 'Save failed');
      }
      setSuccess(true);
      onSaved?.(payload);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const seedBioFromProfile = () => {
    if (profileBio?.trim()) {
      setValues((prev) => ({ ...prev, gofastWithMeBio: profileBio.trim() }));
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-1">
        GoFast With Me intro
      </h2>
      <p className="text-xs text-gray-600 mb-4">
        Your profile bio is your human identity. GoFast With Me is how visitors understand who you
        are as a GoFast athlete and what they can do with you.
      </p>

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-gray-900">Welcome</span>
          <span className="block text-xs text-gray-500 mt-0.5">
            Invite opener — &ldquo;Hey, welcome — here is what you can do with me.&rdquo;
          </span>
          <textarea
            value={values.welcome}
            onChange={(e) => setValues((v) => ({ ...v, welcome: e.target.value }))}
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gray-900">GoFast With Me bio</span>
          <span className="block text-xs text-gray-500 mt-0.5">
            Public-athlete identity — separate from your profile bio.
          </span>
          <textarea
            value={values.gofastWithMeBio}
            onChange={(e) => setValues((v) => ({ ...v, gofastWithMeBio: e.target.value }))}
            rows={4}
            className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          {profileBio?.trim() && !values.gofastWithMeBio.trim() ? (
            <button
              type="button"
              onClick={seedBioFromProfile}
              className="mt-1 text-xs font-medium text-orange-600 hover:text-orange-700"
            >
              Start from profile bio
            </button>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gray-900">What you&apos;ll see here</span>
          <span className="block text-xs text-gray-500 mt-0.5">
            Set expectations — runs, training, community, and more.
          </span>
          <textarea
            value={values.whatYoullSeeHere}
            onChange={(e) => setValues((v) => ({ ...v, whatYoullSeeHere: e.target.value }))}
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-gray-900">Sport focus</span>
            <span className="block text-xs text-gray-500 mt-0.5">Run, trail, tri, strength…</span>
            <input
              value={values.sportFocus}
              onChange={(e) => setValues((v) => ({ ...v, sportFocus: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-gray-900">Model focus</span>
            <span className="block text-xs text-gray-500 mt-0.5">
              Marathon, 5K, comeback, first race…
            </span>
            <input
              value={values.modelFocus}
              onChange={(e) => setValues((v) => ({ ...v, modelFocus: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-gray-900">My achievements</span>
          <span className="block text-xs text-gray-500 mt-0.5">
            Credibility and lived experience — warmer than a stats dump.
          </span>
          <textarea
            value={values.myAchievements}
            onChange={(e) => setValues((v) => ({ ...v, myAchievements: e.target.value }))}
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-green-700">Saved.</p> : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="mt-4 w-full rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save GoFast With Me intro'}
      </button>
    </section>
  );
}
