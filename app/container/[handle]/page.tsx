'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import AthleteAppShell from '@/components/athlete/AthleteAppShell';

type PublicPayload = {
  success: boolean;
  error?: string;
  isGoFastContainer?: boolean;
  hostAthleteId?: string;
  athlete?: { gofastHandle: string | null; firstName: string | null; lastName: string | null } | null;
  upcomingRuns?: {
    id: string;
    title: string;
    date: string;
    gofastCity: string;
    meetUpPoint: string;
    gorunPath: string;
  }[];
};

type ContainerMessage = {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    photoURL: string | null;
    gofastHandle: string | null;
  };
};

type MemberRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  photoURL: string | null;
  gofastHandle: string | null;
  joinedAt: string;
};

export default function ContainerHubPage() {
  const router = useRouter();
  const params = useParams();
  const handle = (params?.handle as string)?.trim() || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pub, setPub] = useState<PublicPayload | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [messages, setMessages] = useState<ContainerMessage[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [composer, setComposer] = useState('');
  const [posting, setPosting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const myId = LocalStorageAPI.getAthleteId();

  const loadFeed = useCallback(async (hid: string) => {
    const [msgRes, memRes] = await Promise.all([
      api.get(`/athlete/${hid}/container/messages?limit=40`),
      api.get(`/athlete/${hid}/container/members`),
    ]);
    if (msgRes.data?.messages) setMessages(msgRes.data.messages);
    if (memRes.data?.members) setMembers(memRes.data.members);
    if (typeof memRes.data?.count === 'number') setMemberCount(memRes.data.count);
  }, []);

  useEffect(() => {
    if (!handle) {
      setError('Missing handle');
      setLoading(false);
      return;
    }
    if (!myId) {
      router.replace('/welcome');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const pubRes = await fetch(`/api/athlete/public/${encodeURIComponent(handle)}`);
        const data = (await pubRes.json()) as PublicPayload;
        if (!pubRes.ok || !data.success || !data.athlete) {
          if (!cancelled) setError(data.error || 'Page not found');
          return;
        }
        if (!data.isGoFastContainer || !data.hostAthleteId) {
          if (!cancelled) setError('This athlete has not enabled a GoFast Container yet.');
          return;
        }
        if (!cancelled) {
          setPub(data);
          setHostId(data.hostAthleteId);
        }

        const st = await api.get(`/athlete/${data.hostAthleteId}/container/status`);
        if (!cancelled) {
          setIsHost(!!st.data?.isHost);
          setIsMember(!!st.data?.isMember);
        }

        if (st.data?.isHost || st.data?.isMember) {
          try {
            await loadFeed(data.hostAthleteId!);
          } catch {
            /* feed may 403 if race */
          }
        }
      } catch {
        if (!cancelled) setError('Something went wrong.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handle, myId, router, loadFeed]);

  const handleJoin = async () => {
    if (!hostId) return;
    setActionLoading(true);
    setError(null);
    try {
      await api.post(`/athlete/${hostId}/container/join`);
      setIsMember(true);
      await loadFeed(hostId);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; message?: string } } };
      setError(e.response?.data?.message || e.response?.data?.error || 'Could not join.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!hostId || isHost) return;
    setActionLoading(true);
    setError(null);
    try {
      await api.post(`/athlete/${hostId}/container/leave`);
      setIsMember(false);
      setMessages([]);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not leave.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostId || !composer.trim() || posting) return;
    setPosting(true);
    setError(null);
    try {
      await api.post(`/athlete/${hostId}/container/messages`, { body: composer.trim() });
      setComposer('');
      await loadFeed(hostId);
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { error?: string } } };
      setError(ex.response?.data?.error || 'Could not post.');
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!hostId || !isHost) return;
    if (!confirm('Delete this message?')) return;
    try {
      await api.delete(`/athlete/${hostId}/container/messages/${messageId}`);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch {
      setError('Could not delete message.');
    }
  };

  if (loading) {
    return (
      <AthleteAppShell>
        <div className="flex min-h-[40vh] items-center justify-center px-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
        </div>
      </AthleteAppShell>
    );
  }

  if (error || !pub || !hostId) {
    return (
      <AthleteAppShell>
        <div className="max-w-lg mx-auto px-4 py-10">
          <Link href="/athlete-home" className="text-sm font-medium text-orange-600 hover:text-orange-700">
            ← Home
          </Link>
          <p className="mt-6 text-gray-700">{error || 'Not available'}</p>
          <button
            type="button"
            onClick={() => router.push('/profile')}
            className="mt-4 text-orange-600 font-semibold"
          >
            Back to profile
          </button>
        </div>
      </AthleteAppShell>
    );
  }

  const displayName =
    [pub.athlete?.firstName, pub.athlete?.lastName].filter(Boolean).join(' ') || `@${handle}`;

  return (
    <AthleteAppShell>
      <div className="max-w-xl mx-auto px-4 py-6 pb-24">
        <Link href="/athlete-home" className="text-sm font-medium text-orange-600 hover:text-orange-700">
          ← Home
        </Link>

        <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">GoFast Container</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{displayName}</h1>
          <p className="text-sm text-gray-600 mt-1">@{handle}</p>
          <p className="text-sm text-gray-600 mt-2">{memberCount} members</p>

          {isHost ? (
            <p className="mt-2 text-sm font-semibold text-violet-800">You are the host</p>
          ) : isMember ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-sm text-green-800 font-medium">You&apos;re a member</span>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void handleLeave()}
                className="text-sm text-gray-600 underline disabled:opacity-50"
              >
                Leave
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => void handleJoin()}
              className="mt-3 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Join community
            </button>
          )}
        </div>

        {pub.upcomingRuns && pub.upcomingRuns.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">Upcoming runs</h2>
            <ul className="space-y-2">
              {pub.upcomingRuns.map((r) => (
                <li key={r.id}>
                  <Link
                    href={r.gorunPath.startsWith('/') ? r.gorunPath : `/${r.gorunPath}`}
                    className="block rounded-xl border border-gray-200 bg-white p-3 text-sm hover:border-orange-300"
                  >
                    <span className="font-medium text-gray-900">{r.title}</span>
                    <span className="block text-gray-500 mt-1">
                      {new Date(r.date).toLocaleString()} · {r.gofastCity}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {isHost || isMember ? (
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">Chatter</h2>
            <ul className="space-y-3 mb-4">
              {messages.map((m) => (
                <li key={m.id} className="rounded-lg border border-gray-100 bg-white p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-gray-900">
                      {[m.author.firstName, m.author.lastName].filter(Boolean).join(' ') ||
                        (m.author.gofastHandle ? `@${m.author.gofastHandle}` : 'Member')}
                    </span>
                    {isHost ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteMessage(m.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <p className="text-gray-700 mt-1 whitespace-pre-wrap">{m.body}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(m.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
            <form onSubmit={(e) => void handlePost(e)} className="space-y-2">
              <textarea
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm"
                placeholder="Say something to the group…"
              />
              <button
                type="submit"
                disabled={posting || !composer.trim()}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {posting ? 'Posting…' : 'Post'}
              </button>
            </form>
          </section>
        ) : (
          <p className="mt-8 text-sm text-gray-600">Join to read and post in the chatter feed.</p>
        )}

        {members.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">Members</h2>
            <ul className="flex flex-wrap gap-2">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-800"
                >
                  {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.gofastHandle || 'Member'}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </AthleteAppShell>
  );
}
