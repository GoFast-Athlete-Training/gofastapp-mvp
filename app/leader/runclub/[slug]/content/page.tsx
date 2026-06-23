'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import RunClubLeaderShell from '@/components/runclub/leader/RunClubLeaderShell';

interface ClubForm {
  description: string;
  allRunsDescription: string;
  websiteUrl: string;
  instagramUrl: string;
  stravaUrl: string;
  logoUrl: string;
}

export default function RunClubLeaderContentPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [clubName, setClubName] = useState('');
  const [form, setForm] = useState<ClubForm>({
    description: '',
    allRunsDescription: '',
    websiteUrl: '',
    instagramUrl: '',
    stravaUrl: '',
    logoUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api.get(`/runclub/${slug}/leader`);
    if (res.data?.success && res.data.club) {
      const c = res.data.club;
      setClubName(c.name);
      setForm({
        description: c.description ?? '',
        allRunsDescription: c.allRunsDescription ?? '',
        websiteUrl: c.websiteUrl ?? '',
        instagramUrl: c.instagramUrl ?? '',
        stravaUrl: c.stravaUrl ?? '',
        logoUrl: c.logoUrl ?? '',
      });
    }
  }, [slug]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace(`/signup?redirect=/leader/runclub/${slug}/content`);
        return;
      }
      try {
        await load();
      } catch {
        router.replace('/leader');
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [slug, router, load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.patch(`/runclub/${slug}/leader/club`, form);
      setToast('Club content saved');
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <RunClubLeaderShell clubName={clubName} clubSlug={slug} active="content">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Fix your meta</h2>
        <p className="text-sm text-gray-500 mt-1">
          How your club appears to members — description, links, and logo.
        </p>
      </div>
      {toast && (
        <div className="fixed top-20 right-6 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg shadow z-50">
          {toast}
        </div>
      )}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <p className="text-sm text-gray-500">
          Update how your club appears to members. Slug, city, and brand settings are managed by GoFast
          staff.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Club description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">All runs description</label>
          <textarea
            value={form.allRunsDescription}
            onChange={(e) => setForm({ ...form, allRunsDescription: e.target.value })}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              type="url"
              value={form.websiteUrl}
              onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
            <input
              type="text"
              value={form.instagramUrl}
              onChange={(e) => setForm({ ...form, instagramUrl: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Strava club URL</label>
            <input
              type="url"
              value={form.stravaUrl}
              onChange={(e) => setForm({ ...form, stravaUrl: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
            <input
              type="url"
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white px-6 py-2 rounded-lg font-semibold text-sm"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </RunClubLeaderShell>
  );
}
