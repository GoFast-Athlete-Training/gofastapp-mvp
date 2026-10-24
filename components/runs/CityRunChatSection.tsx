'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import type { CityRunMessage } from '@/components/runs/city-run-types';
import { athleteProfileHref } from '@/lib/gofast-with-me/athlete-community-routes';

function Avatar({
  athlete,
  sizeClass = 'w-8 h-8',
}: {
  athlete?: { firstName: string; lastName: string; photoURL?: string | null } | null;
  sizeClass?: string;
}) {
  if (!athlete) return null;
  if (athlete.photoURL) {
    return (
      <img
        src={athlete.photoURL}
        alt={athlete.firstName}
        className={`${sizeClass} rounded-full object-cover shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-semibold shrink-0 text-xs`}
    >
      {(athlete.firstName?.[0] || '?').toUpperCase()}
    </div>
  );
}

const CHAT_HINT =
  "Let others know you're coming, or use this for questions.";

export type CityRunChatLock = 'sign-in' | 'rsvp' | null;

type CityRunChatSectionProps = {
  runId: string;
  variant?: 'default' | 'mobile-hub' | 'sidebar-square' | 'sidebar-panel';
  showHeading?: boolean;
  chatLock?: CityRunChatLock;
  joinRunHref?: string;
  onJoinRun?: () => void;
  joinLoading?: boolean;
};

export default function CityRunChatSection({
  runId,
  variant = 'default',
  showHeading = true,
  chatLock = null,
  joinRunHref,
  onJoinRun,
  joinLoading = false,
}: CityRunChatSectionProps) {
  const athleteId = LocalStorageAPI.getAthleteId();
  const [messages, setMessages] = useState<CityRunMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isMobileHub = variant === 'mobile-hub';
  const isSidebarSquare = variant === 'sidebar-square';
  const isSidebarPanel = variant === 'sidebar-panel';
  const chatLive = chatLock == null;

  useEffect(() => {
    if (!chatLive) {
      setMessages([]);
      return;
    }
    void fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when run or access changes
  }, [runId, chatLive]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/runs/${runId}/messages`);
      if (res.data.success) setMessages(res.data.messages || []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!chatLive || !newMessage.trim() || sendingMessage) return;
    setSendingMessage(true);
    try {
      const res = await api.post(`/runs/${runId}/messages`, {
        content: newMessage.trim(),
        topic: 'general',
      });
      if (res.data.success) {
        setMessages((prev) => [...prev, res.data.message]);
        setNewMessage('');
      }
    } catch (err) {
      console.error('Message error:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const formatMessageTime = (d: string) =>
    new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const listClassName = isMobileHub
    ? 'min-h-[min(18rem,42dvh)] max-h-[min(32rem,calc(100dvh-18rem))]'
    : isSidebarPanel
      ? 'min-h-[12rem] max-h-[min(28rem,calc(100dvh-14rem))] flex-1'
      : isSidebarSquare
        ? 'min-h-0 flex-1'
        : 'min-h-[200px] max-h-[400px]';

  const shellClass = isMobileHub
    ? 'flex min-h-0 flex-1 flex-col min-w-0'
    : isSidebarPanel
      ? 'bg-white rounded-xl shadow-sm flex flex-col min-h-[20rem] w-full min-w-0'
      : isSidebarSquare
        ? 'bg-white rounded-xl shadow-sm flex flex-col aspect-square w-full max-w-md'
        : 'bg-white rounded-xl shadow-sm flex flex-col';

  const lockMessage =
    chatLock === 'sign-in'
      ? 'Sign in to read and post run chatter.'
      : chatLock === 'rsvp'
        ? 'RSVP to this run to join the conversation.'
        : null;

  return (
    <section className={shellClass}>
      {showHeading ? (
        <div
          className={
            isMobileHub
              ? 'mb-3 px-0.5'
              : isSidebarSquare || isSidebarPanel
                ? 'px-4 py-3 border-b border-gray-100'
                : 'px-6 py-4 border-b border-gray-100'
          }
        >
          <h2 className="font-semibold text-gray-900 text-sm">Messages</h2>
          <p className="text-xs text-gray-500 mt-1 leading-snug">{CHAT_HINT}</p>
        </div>
      ) : null}

      <div
        className={`flex-1 overflow-y-auto space-y-3 ${listClassName} ${
          isMobileHub
            ? 'border border-gray-200 rounded-lg bg-gray-50 p-4'
            : isSidebarSquare || isSidebarPanel
              ? 'px-3 py-3'
              : 'px-6 py-4'
        } ${isMobileHub || isSidebarSquare || isSidebarPanel ? 'min-h-0' : ''}`}
      >
        {chatLock ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-3">
            <p className="text-sm text-gray-600">{lockMessage}</p>
            {chatLock === 'sign-in' && joinRunHref ? (
              <Link
                href={joinRunHref}
                className="inline-flex rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Sign in to join
              </Link>
            ) : null}
            {chatLock === 'rsvp' && onJoinRun ? (
              <button
                type="button"
                onClick={onJoinRun}
                disabled={joinLoading}
                className="inline-flex rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {joinLoading ? 'Saving…' : 'Join this run'}
              </button>
            ) : null}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{CHAT_HINT}</p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.athleteId === athleteId;
            const authorHref = !isMe ? athleteProfileHref(msg.Athlete?.gofastHandle) : null;
            const authorName = [msg.Athlete?.firstName, msg.Athlete?.lastName]
              .filter(Boolean)
              .join(' ')
              .trim();
            const avatar = <Avatar athlete={msg.Athlete} sizeClass="w-7 h-7" />;
            return (
              <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                {authorHref ? (
                  <a href={authorHref} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    {avatar}
                  </a>
                ) : (
                  avatar
                )}
                <div className={`max-w-[85%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                  {!isMe ? (
                    authorHref ? (
                      <a
                        href={authorHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-gray-400 hover:text-orange-600 hover:underline"
                      >
                        {authorName}
                      </a>
                    ) : (
                      <span className="text-[10px] text-gray-400">{authorName}</span>
                    )
                  ) : null}
                  <div
                    className={`px-3 py-1.5 rounded-2xl text-xs ${
                      isMe
                        ? 'bg-orange-500 text-white rounded-tr-sm'
                        : 'bg-gray-100 text-gray-900 rounded-tl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-gray-300">{formatMessageTime(msg.createdAt)}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {chatLive ? (
        <div
          className={`flex gap-2 shrink-0 ${
            isMobileHub
              ? 'sticky bottom-20 z-30 mt-3 border-t border-gray-200 bg-gray-50 pt-3'
              : isSidebarSquare || isSidebarPanel
                ? 'px-3 py-3 border-t border-gray-100'
                : 'px-4 py-3 border-t border-gray-100'
          }`}
        >
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void handleSendMessage()}
            placeholder="Write a message…"
            className={`flex-1 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
              isMobileHub || isSidebarSquare || isSidebarPanel
                ? 'border border-gray-300 rounded-lg bg-white'
                : 'bg-gray-100 rounded-full'
            }`}
          />
          <button
            type="button"
            onClick={() => void handleSendMessage()}
            disabled={!newMessage.trim() || sendingMessage}
            className={`bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition shrink-0 ${
              isMobileHub || isSidebarSquare || isSidebarPanel
                ? 'px-3 py-2 rounded-lg text-sm font-semibold'
                : 'p-2 rounded-full'
            }`}
          >
            {isMobileHub || isSidebarSquare || isSidebarPanel ? (
              sendingMessage ? '…' : 'Send'
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      ) : null}
    </section>
  );
}
