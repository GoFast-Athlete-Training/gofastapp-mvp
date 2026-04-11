'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import CoachTopNav from '@/components/coach/CoachTopNav';

type CoachRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  bio: string | null;
  specialty: string | null;
  city: string | null;
  state: string | null;
  photoURL: string | null;
};

export default function CoachProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CoachRow | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/coach-signup');
        return;
      }
      try {
        const token = await user.getIdToken();
        localStorage.setItem('firebaseToken', token);
        const res = await api.get('/coach/me');
        if (!res.data?.success || !res.data?.coach) {
          router.replace('/coach-signup');
          return;
        }
        LocalStorageAPI.setCoachId(res.data.coachId);
        setForm(res.data.coach as CoachRow);
      } catch {
        router.replace('/coach-signup');
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setMessage('');
    try {
      await api.patch('/coach/me', {
        firstName: form.firstName,
        lastName: form.lastName,
        bio: form.bio,
        specialty: form.specialty,
        city: form.city,
        state: form.state,
        photoURL: form.photoURL,
      });
      setMessage('Saved.');
    } catch {
      setMessage('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-500 to-orange-700">
      <CoachTopNav />
      <div className="max-w-xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-white mb-2">Coach profile</h1>
        <p className="text-white/85 mb-8">This is your public-facing coach information.</p>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-lg p-6 md:p-8 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">First name</span>
              <input
                type="text"
                value={form.firstName || ''}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Last name</span>
              <input
                type="text"
                value={form.lastName || ''}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Email</span>
            <input
              type="email"
              value={form.email || ''}
              readOnly
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Specialty</span>
            <input
              type="text"
              value={form.specialty || ''}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Bio</span>
            <textarea
              rows={4}
              value={form.bio || ''}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">City</span>
              <input
                type="text"
                value={form.city || ''}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">State</span>
              <input
                type="text"
                value={form.state || ''}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Photo URL</span>
            <input
              type="url"
              value={form.photoURL || ''}
              onChange={(e) => setForm({ ...form, photoURL: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </label>

          {message && <p className="text-sm text-gray-700">{message}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-lg font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
