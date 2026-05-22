'use client';

import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import type { CityRunMessage } from '@/components/runs/city-run-types';

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

type CityRunChatSectionProps = {
  runId: string;
  variant?: 'default' | 'mobile-hub';
  showHeading?: boolean;
};

export default function CityRunChatSection({
  runId,
  variant = 'default',
  showHeading = true,
}: CityRunChatSectionProps) {
  const athleteId = LocalStorageAPI.getAthleteId();
  const [messages, setMessages] = useState<CityRunMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isMobileHub = variant === 'mobile-hub';

  useEffect(() => {
    void fetchMessages();
  }, [runId]);

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
    if (!newMessage.trim() || sendingMessage) return;
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
    : 'min-h-[200px] max-h-[400px]';

  return (
    <section
      className={
        isMobileHub
          ? 'flex min-h-0 flex-1 flex-col min-w-0'
          : 'bg-white rounded-xl shadow-sm flex flex-col'
      }
    >
      {showHeading ? (
        <div className={`${isMobileHub ? 'mb-3 px-0.5' : 'px-6 py-4 border-b border-gray-100'}`}>
          <h2 className="font-semibold text-gray-900">Run chat</h2>
          <p className="text-xs text-gray-400 mt-0.5">Only people going can see this</p>
        </div>
      ) : null}

      <div
        className={`flex-1 overflow-y-auto space-y-4 ${listClassName} ${
          isMobileHub ? 'border border-gray-200 rounded-lg bg-gray-50 p-4' : 'px-6 py-4'
        } ${isMobileHub ? 'min-h-0' : ''}`}
      >
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No messages yet. Say something!</p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.athleteId === athleteId;
            return (
              <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                <Avatar athlete={msg.Athlete} />
                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {!isMe ? (
                    <span className="text-xs text-gray-400">
                      {msg.Athlete?.firstName} {msg.Athlete?.lastName}
                    </span>
                  ) : null}
                  <div
                    className={`px-4 py-2 rounded-2xl text-sm ${
                      isMe
                        ? 'bg-orange-500 text-white rounded-tr-sm'
                        : 'bg-gray-100 text-gray-900 rounded-tl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-xs text-gray-300">{formatMessageTime(msg.createdAt)}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div
        className={`flex gap-2 ${
          isMobileHub
            ? 'sticky bottom-20 z-30 mt-3 border-t border-gray-200 bg-gray-50 pt-3'
            : 'px-4 py-3 border-t border-gray-100'
        }`}
      >
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void handleSendMessage()}
          placeholder="Message the crew..."
          className={`flex-1 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
            isMobileHub ? 'border border-gray-300 rounded-lg bg-white' : 'bg-gray-100 rounded-full'
          }`}
        />
        <button
          type="button"
          onClick={() => void handleSendMessage()}
          disabled={!newMessage.trim() || sendingMessage}
          className={`bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition shrink-0 ${
            isMobileHub ? 'px-4 py-2 rounded-lg text-sm font-semibold' : 'p-2 rounded-full'
          }`}
        >
          {isMobileHub ? (sendingMessage ? 'Sending…' : 'Send') : <Send className="h-4 w-4" />}
        </button>
      </div>
    </section>
  );
}
