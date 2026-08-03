'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import ClubManagerShell from '@/components/runclub/manager/ClubManagerShell';
import { clubManagerClubPath, clubManagerHubPath } from '@/lib/club-manager-paths';

interface ClubEvent {
  id: string;
  title: string;
  description: string | null;
  eventType: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  visibility: string;
}

export default function ClubManagerEventsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [clubName, setClubName] = useState('');
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const [dash, ev] = await Promise.all([
      api.get(`/runclub/${slug}/leader`),
      api.get(`/runclub/${slug}/leader/events`),
    ]);
    if (dash.data?.club) setClubName(dash.data.club.name);
    if (ev.data?.success) setEvents(ev.data.events ?? []);
  }, [slug]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace(
          `/signup?mode=club-manager&redirect=${encodeURIComponent(clubManagerClubPath(slug, 'events'))}`
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
    if (!title.trim() || !startsAt) return;
    try {
      setPosting(true);
      await api.post(`/runclub/${slug}/leader/events`, {
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        startsAt: new Date(startsAt).toISOString(),
        visibility: 'members',
      });
      setTitle('');
      setDescription('');
      setLocation('');
      setStartsAt('');
      await load();
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    await api.delete(`/runclub/${slug}/leader/events/${id}`);
    await load();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <ClubManagerShell clubName={clubName} clubSlug={slug} active="events">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Events</h2>
        <p className="text-sm text-gray-500 mt-1">
          Non-run club hangouts — socials, races, meetups. Members see these on the club hub.
        </p>
      </div>

      <form
        onSubmit={handlePost}
        className="bg-white rounded-xl border border-sky-200 p-6 mb-6 space-y-4"
      >
        <h3 className="text-lg font-bold text-gray-900">Add event</h3>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (optional)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Details (optional)"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={posting || !title.trim() || !startsAt}
            className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {posting ? 'Saving…' : 'Add event'}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {events.length === 0 ? (
          <p className="text-sm text-gray-500">No events yet.</p>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{event.title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(event.startsAt).toLocaleString()}
                  {event.location ? ` · ${event.location}` : ''}
                </p>
                {event.description ? (
                  <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{event.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void handleDelete(event.id)}
                className="shrink-0 text-xs font-semibold text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </ClubManagerShell>
  );
}
