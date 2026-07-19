'use client';

import { useState } from 'react';
import { Footprints, Sparkles, Users } from 'lucide-react';
import api from '@/lib/api';
import type { GoFastWithMeCreatorType } from '@/lib/gofast-with-me/gofast-with-me-service';

type Props = {
  onComplete: (values: {
    creatorType: GoFastWithMeCreatorType;
    coachSpecialty: string | null;
  }) => void;
};

export default function GoFastWithMeHubOnboarding({ onComplete }: Props) {
  const [selected, setSelected] = useState<GoFastWithMeCreatorType | null>(null);
  const [coachSpecialty, setCoachSpecialty] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!selected) {
      setError('Choose how you want to show up on GoFastWithMe.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        creatorType: selected,
        coachSpecialty:
          selected === 'coach' ? coachSpecialty.trim() || null : null,
      };
      const res = await api.patch('/me/gofast-with-me', payload);
      if (!res.data?.success) {
        throw new Error(res.data?.error || 'Could not save your choice.');
      }
      onComplete({
        creatorType: selected,
        coachSpecialty: payload.coachSpecialty,
      });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not save your choice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
          GoFast with Others
        </p>
        <h1 className="text-3xl font-bold text-gray-900 leading-tight">
          Set up your GoFast with Others public profile
        </h1>
        <p className="text-gray-600 text-sm leading-relaxed max-w-xl">
          This is how others see you beyond a simple in-app profile. Think of it as your landing
          page — express yourself, share how you train, and build the audience that joins your
          runs and plans. It&apos;s your creator studio: earn from advertiser attention as people
          follow your hub and join what you publish.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-900">Who is this page for?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setSelected('person')}
            className={`rounded-xl border p-4 text-left transition-colors ${
              selected === 'person'
                ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-200'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <Footprints className="w-5 h-5 text-orange-600 mb-2" />
            <p className="font-semibold text-gray-900">I&apos;m an athlete</p>
            <p className="text-xs text-gray-600 mt-1">
              I want others to run, train, and join me.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelected('coach')}
            className={`rounded-xl border p-4 text-left transition-colors ${
              selected === 'coach'
                ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <Users className="w-5 h-5 text-violet-600 mb-2" />
            <p className="font-semibold text-gray-900">I&apos;m a coach</p>
            <p className="text-xs text-gray-600 mt-1">
              Build an audience, get surfaced, and earn advertiser revenue — your public front door
              before paid athlete management.
            </p>
          </button>
        </div>
      </div>

      {selected === 'coach' ? (
        <label className="block rounded-xl border border-violet-100 bg-violet-50/50 p-4">
          <span className="text-sm font-semibold text-gray-900">Your coaching specialty</span>
          <span className="block text-xs text-gray-500 mt-0.5 mb-2">
            e.g. marathon coaching, beginner 5K, nutrition for runners
          </span>
          <input
            value={coachSpecialty}
            onChange={(e) => setCoachSpecialty(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
            placeholder="What do you help athletes with?"
          />
          <p className="text-xs text-gray-500 mt-2">
            MVP1: build your public coaching landing here. Charging athletes subscriptions comes
            later.
          </p>
        </label>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={() => void handleContinue()}
        disabled={!selected || saving}
        className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
      >
        <Sparkles className="w-4 h-4" />
        {saving ? 'Saving…' : 'Ready to get started'}
      </button>
    </div>
  );
}
