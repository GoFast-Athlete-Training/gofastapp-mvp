'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

type RunClubMessage = {
  id: string;
  content: string;
  createdAt: string;
  linkedRunId: string | null;
  Athlete: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    photoURL: string | null;
  };
};

type ClubChatterSectionProps = {
  clubSlug: string;
  isMember: boolean;
  onJoinRequired?: () => void;
};

function authorName(athlete: RunClubMessage['Athlete']): string {
  const full = `${athlete.firstName ?? ''} ${athlete.lastName ?? ''}`.trim();
  return full || 'Runner';
}

export default function ClubChatterSection({
  clubSlug,
  isMember,
  onJoinRequired,
}: ClubChatterSectionProps) {
  const [messages, setMessages] = useState<RunClubMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const athleteId = LocalStorageAPI.getAthleteId();

  const loadMessages = useCallback(async () => {
    if (!isMember) {
      setMessages([]);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/runclub/${clubSlug}/messages`);
      setMessages(res.data?.messages ?? []);
      setError(null);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setError('Join the club to see run meetup chatter.');
      } else {
        setError('Could not load chatter.');
      }
    } finally {
      setLoading(false);
    }
  }, [clubSlug, isMember]);

  useEffect(() => {
    void loadMessages();
    const timer = setInterval(() => void loadMessages(), 20_000);
    return () => clearInterval(timer);
  }, [loadMessages]);

  const handlePost = async () => {
    const content = draft.trim();
    if (!content || posting) return;
    if (!isMember) {
      onJoinRequired?.();
      return;
    }
    setPosting(true);
    try {
      const res = await api.post(`/runclub/${clubSlug}/messages`, { content });
      if (res.data?.message) {
        setMessages((prev) => [...prev, res.data.message]);
        setDraft('');
      }
    } catch {
      setError('Could not post message.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/80 overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-orange-500" aria-hidden />
          <h2 className="text-base font-bold text-gray-900">Run meetup chatter</h2>
        </div>
        <p className="mt-1 text-sm text-gray-500">Club thread for upcoming runs — not tied to one date.</p>
      </div>

      <div className="max-h-80 overflow-y-auto px-5 py-4 space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : !isMember ? (
          <p className="text-sm text-gray-600">Join the club to chat with runners before meetup day.</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-500">No messages yet. Say hi before the next run.</p>
        ) : (
          messages.map((msg) => {
            const mine = athleteId && msg.Athlete.id === athleteId;
            return (
              <div key={msg.id} className={`flex gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
                {msg.Athlete.photoURL ? (
                  <img
                    src={msg.Athlete.photoURL}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700">
                    {authorName(msg.Athlete)[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
                <div className={`min-w-0 max-w-[85%] ${mine ? 'text-right' : ''}`}>
                  <p className="text-xs font-medium text-gray-500">{authorName(msg.Athlete)}</p>
                  <p
                    className={`mt-1 inline-block rounded-2xl px-3 py-2 text-sm ${
                      mine ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {msg.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="border-t border-gray-100 px-4 py-3 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handlePost();
          }}
          placeholder={isMember ? 'Message the club…' : 'Join to chat'}
          disabled={!isMember || posting}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 disabled:bg-gray-50"
        />
        <button
          type="button"
          onClick={() => void handlePost()}
          disabled={!isMember || posting || !draft.trim()}
          className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-white hover:bg-orange-600 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
