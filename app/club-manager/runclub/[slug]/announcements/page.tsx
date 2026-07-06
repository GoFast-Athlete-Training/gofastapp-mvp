'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import ClubManagerShell from '@/components/runclub/manager/ClubManagerShell';
import { clubManagerClubPath, clubManagerHubPath } from '@/lib/club-manager-paths';

interface Announcement {
  id: string;
  title: string | null;
  body: string;
  visibility: string;
  publishedAt: string;
}

export default function ClubManagerAnnouncementsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [clubName, setClubName] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const [dash, ann] = await Promise.all([
      api.get(`/runclub/${slug}/leader`),
      api.get(`/runclub/${slug}/leader/announcements`),
    ]);
    if (dash.data?.club) setClubName(dash.data.club.name);
    if (ann.data?.success) setAnnouncements(ann.data.announcements ?? []);
  }, [slug]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace(
          `/signup?mode=club-manager&redirect=${encodeURIComponent(clubManagerClubPath(slug, 'announcements'))}`
        );
        return;
      }
      try {
        await load();
      } catch {
        router.replace(clubManagerHubPath());
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [slug, router, load]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      setPosting(true);
      await api.post(`/runclub/${slug}/leader/announcements`, {
        title: title.trim() || undefined,
        body: body.trim(),
        visibility: 'members',
      });
      setTitle('');
      setBody('');
      await load();
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    await api.delete(`/runclub/${slug}/leader/announcements/${id}`);
    await load();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <ClubManagerShell clubName={clubName} clubSlug={slug} active="announcements">
      <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Secondary</p>
        <p className="text-sm text-gray-600 mt-1">
          Announcements help after your club profile and runs are set. Members see these in the club
          experience.
        </p>
      </div>
      <form
        onSubmit={handlePost}
        className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-4"
      >
        <h2 className="text-lg font-bold text-gray-900">Post announcement</h2>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What's new with the club?"
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          required
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={posting || !body.trim()}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-semibold"
          >
            {posting ? 'Posting…' : 'Post to members'}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Recent announcements</h2>
        {announcements.length === 0 ? (
          <p className="text-sm text-gray-500">No announcements yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {announcements.map((a) => (
              <li key={a.id} className="py-4 flex justify-between gap-4">
                <div>
                  {a.title && <p className="font-medium text-gray-900">{a.title}</p>}
                  <p className="text-sm text-gray-600 whitespace-pre-line mt-1">{a.body}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(a.publishedAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  className="text-red-600 text-sm font-medium shrink-0 hover:underline"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ClubManagerShell>
  );
}
