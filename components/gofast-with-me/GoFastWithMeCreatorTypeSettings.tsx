'use client';

import { useState } from 'react';
import { Footprints, Users } from 'lucide-react';
import api from '@/lib/api';
import type { GoFastWithMeCreatorType } from '@/lib/gofast-with-me/gofast-with-me-service';

type Props = {
  initialCreatorType: GoFastWithMeCreatorType | null;
  initialCoachSpecialty: string | null;
  onSaved?: (values: {
    creatorType: GoFastWithMeCreatorType;
    coachSpecialty: string | null;
  }) => void;
};

export default function GoFastWithMeCreatorTypeSettings({
  initialCreatorType,
  initialCoachSpecialty,
  onSaved,
}: Props) {
  const [selected, setSelected] = useState<GoFastWithMeCreatorType | null>(initialCreatorType);
  const [coachSpecialty, setCoachSpecialty] = useState(initialCoachSpecialty ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!selected) {
      setError('Choose how you show up on GoFast With Me.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload = {
        creatorType: selected,
        coachSpecialty: selected === 'coach' ? coachSpecialty.trim() || null : null,
      };
      const res = await api.patch('/me/gofast-with-me', payload);
      if (!res.data?.success) {
        throw new Error(res.data?.error || 'Could not save your choice.');
      }
      onSaved?.({
        creatorType: selected,
        coachSpecialty: payload.coachSpecialty,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not save your choice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        How you show up on your public GoFast With Me landing — athlete or coach.
      </p>

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
          <p className="text-xs text-gray-600 mt-1">I want others to run, train, and join me.</p>
        </button>

        <button
          type="button"
          onClick={() => setSelected('coach')}
          className={`rounded-xl border p-4 text-left transition-colors ${
            selected === 'coach'
              ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-200'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <Users className="w-5 h-5 text-orange-600 mb-2" />
          <p className="font-semibold text-gray-900">I&apos;m a coach</p>
          <p className="text-xs text-gray-600 mt-1">I guide athletes through training builds.</p>
        </button>
      </div>

      {selected === 'coach' ? (
        <div>
          <label htmlFor="coach-specialty" className="block text-sm font-medium text-gray-700 mb-1">
            Coach specialty
          </label>
          <input
            id="coach-specialty"
            type="text"
            value={coachSpecialty}
            onChange={(e) => setCoachSpecialty(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="e.g. Marathon coaching, trail ultras"
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving || !selected}
        className="inline-flex rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? 'Saved' : 'Save creator type'}
      </button>
    </div>
  );
}
