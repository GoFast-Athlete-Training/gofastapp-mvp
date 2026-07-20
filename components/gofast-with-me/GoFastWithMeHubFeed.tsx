'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  CONTAINER_TOPICS,
  type ContainerTopic,
  canMemberPostToTopic,
  containerTopicLabel,
} from '@/lib/gofast-with-me/container-topics';
import type { ContainerHubMessage } from '@/lib/gofast-with-me/container-hub-service';

type Props = {
  hostId: string;
  isHost: boolean;
  canAccessFeed: boolean;
  initialMessages?: ContainerHubMessage[];
};

function authorDisplayName(author: ContainerHubMessage['author']): string {
  const name = [author.firstName, author.lastName].filter(Boolean).join(' ');
  if (name) return name;
  return author.gofastHandle ? `@${author.gofastHandle}` : 'Member';
}

export default function GoFastWithMeHubFeed({
  hostId,
  isHost,
  canAccessFeed,
  initialMessages = [],
}: Props) {
  const [topic, setTopic] = useState<ContainerTopic>('updates');
  const [messages, setMessages] = useState<ContainerHubMessage[]>(initialMessages);
  const [composer, setComposer] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPostInTopic = isHost || canMemberPostToTopic(topic);

  const loadMessages = useCallback(async (activeTopic: ContainerTopic) => {
    if (!canAccessFeed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(
        `/athlete/${hostId}/container/messages?topic=${encodeURIComponent(activeTopic)}&limit=40`
      );
      if (res.data?.messages) {
        setMessages(res.data.messages);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not load feed.');
    } finally {
      setLoading(false);
    }
  }, [canAccessFeed, hostId]);

  useEffect(() => {
    void loadMessages(topic);
  }, [topic, loadMessages]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composer.trim() || posting || !canPostInTopic) return;
    setPosting(true);
    setError(null);
    try {
      await api.post(`/athlete/${hostId}/container/messages`, {
        body: composer.trim(),
        topic,
      });
      setComposer('');
      await loadMessages(topic);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not post.');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!isHost || !confirm('Delete this post?')) return;
    try {
      await api.delete(`/athlete/${hostId}/container/messages/${messageId}`);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch {
      setError('Could not delete post.');
    }
  };

  if (!canAccessFeed) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Feed</h2>
        <p className="mt-2 text-sm text-gray-600">
          Follow to read updates, tips, nutrition, routes, and chatter from this athlete.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Feed</h2>
        <p className="text-xs text-gray-500 mt-1">
          {isHost
            ? 'Post updates, tips, nutrition, and routes for your followers.'
            : 'Read host updates and join the chatter.'}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {CONTAINER_TOPICS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTopic(t)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              topic === t
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {containerTopicLabel(t)}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="max-h-96 overflow-y-auto space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
        {loading ? (
          <p className="text-sm text-gray-500 text-center py-6">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">
            No {containerTopicLabel(topic).toLowerCase()} yet.
          </p>
        ) : (
          messages.map((m) => (
            <article key={m.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium text-gray-900">{authorDisplayName(m.author)}</span>
                {isHost ? (
                  <button
                    type="button"
                    onClick={() => void handleDelete(m.id)}
                    className="text-xs text-red-600 hover:underline shrink-0"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <p className="text-gray-700 mt-1 whitespace-pre-wrap">{m.body}</p>
              {m.route ? (
                <p className="text-xs text-violet-700 mt-2 font-medium">
                  Route: {m.route.name}
                  {m.route.distanceMiles != null ? ` · ${m.route.distanceMiles} mi` : ''}
                  {m.route.citySlug ? ` · ${m.route.citySlug}` : ''}
                </p>
              ) : null}
              <p className="text-xs text-gray-400 mt-1">{new Date(m.createdAt).toLocaleString()}</p>
            </article>
          ))
        )}
      </div>

      {canPostInTopic ? (
        <form onSubmit={(e) => void handlePost(e)} className="space-y-2">
          <textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm"
            placeholder={
              topic === 'chatter'
                ? 'Say something to the group…'
                : `Share ${containerTopicLabel(topic).toLowerCase()}…`
            }
          />
          <button
            type="submit"
            disabled={posting || !composer.trim()}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {posting ? 'Posting…' : `Post to ${containerTopicLabel(topic)}`}
          </button>
        </form>
      ) : (
        <p className="text-xs text-gray-500">
          Only the host can post in {containerTopicLabel(topic).toLowerCase()}. Switch to Chatter to
          join the conversation.
        </p>
      )}
    </section>
  );
}
