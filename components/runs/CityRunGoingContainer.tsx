'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, Clock, Map, Users, Send, CheckCircle, Trophy } from 'lucide-react';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

interface RunClub {
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
}

interface Rsvp {
  id: string;
  status: string;
  athleteId: string;
  Athlete?: {
    id: string;
    firstName: string;
    lastName: string;
    photoURL: string | null;
  };
}

interface Message {
  id: string;
  content: string;
  topic: string;
  createdAt: string;
  athleteId: string;
  Athlete?: {
    id: string;
    firstName: string;
    lastName: string;
    photoURL: string | null;
  };
}

interface Run {
  id: string;
  title: string;
  dayOfWeek: string | null;
  date: string;
  startDate: string;
  citySlug: string;
  meetUpPoint: string;
  meetUpStreetAddress: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  meetUpLat: number | null;
  meetUpLng: number | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  timezone: string | null;
  totalMiles: number | null;
  pace: string | null;
  description: string | null;
  stravaMapUrl: string | null;
  runClub?: RunClub | null;
  rsvps?: Rsvp[];
}

interface Props {
  run: Run;
  onLeave: () => void; // called when RSVP changes or checkin is created — triggers parent re-fetch
}

function Avatar({ athlete, size = 10 }: { athlete?: { firstName: string; lastName: string; photoURL?: string | null } | null; size?: number }) {
  if (!athlete) return null;
  if (athlete.photoURL) {
    return <img src={athlete.photoURL} alt={athlete.firstName} className={`w-${size} h-${size} rounded-full object-cover border-2 border-white`} />;
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-semibold border-2 border-white`}>
      {(athlete.firstName?.[0] || '?').toUpperCase()}
    </div>
  );
}

export default function CityRunGoingContainer({ run, onLeave }: Props) {
  const athleteId = LocalStorageAPI.getAthleteId();
  const [rsvps, setRsvps] = useState<Rsvp[]>(run.rsvps || []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const runIsPast = new Date(run.date) < new Date();

  const going = rsvps.filter(r => r.status === 'going');
  const myRsvp = rsvps.find(r => r.athleteId === athleteId);

  useEffect(() => {
    fetchMessages();
  }, [run.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/runs/${run.id}/messages`);
      if (res.data.success) setMessages(res.data.messages || []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const handleRsvp = async (status: 'going' | 'not-going') => {
    setRsvpLoading(true);
    try {
      await api.post(`/runs/${run.id}/rsvp`, { status });
      if (status !== 'going') {
        onLeave(); // route back to pre-RSVP container
        return;
      }
      const res = await api.get(`/runs/${run.id}`);
      if (res.data.success) setRsvps(res.data.run.rsvps || []);
    } catch (err) {
      console.error('RSVP error:', err);
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleCheckin = async () => {
    setCheckingIn(true);
    try {
      await api.post(`/runs/${run.id}/checkin`, {});
      onLeave(); // parent re-fetches → myCheckin now set → routes to CityRunPostRunContainer
    } catch (err) {
      console.error('Checkin error:', err);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sendingMessage) return;
    setSendingMessage(true);
    try {
      const res = await api.post(`/runs/${run.id}/messages`, {
        content: newMessage.trim(),
        topic: 'general',
      });
      if (res.data.success) {
        setMessages(prev => [...prev, res.data.message]);
        setNewMessage('');
      }
    } catch (err) {
      console.error('Message error:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const formatTime = () => {
    if (run.startTimeHour === null || run.startTimeMinute === null) return null;
    const min = String(run.startTimeMinute).padStart(2, '0');
    return `${run.startTimeHour}:${min} ${run.startTimePeriod || 'AM'}`;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const formatMessageTime = (d: string) =>
    new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* You're going banner */}
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
          <span className="text-green-800 font-semibold">You're going</span>
          <button
            onClick={() => handleRsvp('not-going')}
            disabled={rsvpLoading}
            className="ml-auto text-sm text-gray-500 hover:text-red-500 transition disabled:opacity-50"
          >
            Can't make it
          </button>
        </div>

        {/* Post-run check-in CTA — only surfaces after run date */}
        {runIsPast && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-4 flex items-center gap-3">
            <Trophy className="h-5 w-5 text-orange-500 shrink-0" />
            <div>
              <div className="font-semibold text-orange-900 text-sm">You ran this</div>
              <div className="text-xs text-orange-700">Check in to share your shouts and see the crew's recap</div>
            </div>
            <button
              onClick={handleCheckin}
              disabled={checkingIn}
              className="ml-auto px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition shrink-0"
            >
              {checkingIn ? 'Checking in…' : 'Check in →'}
            </button>
          </div>
        )}

        {/* Run header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {run.runClub && (
            <div className="flex items-center gap-3 mb-4">
              {run.runClub.logoUrl && (
                <img src={run.runClub.logoUrl} alt={run.runClub.name} className="w-10 h-10 rounded-full object-cover" />
              )}
              <span className="text-sm font-medium text-gray-600">{run.runClub.name}</span>
            </div>
          )}

          <h1 className="text-2xl font-bold text-gray-900 mb-4">{run.title}</h1>

          <div className="space-y-2 text-gray-700">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span>
                {run.dayOfWeek
                  ? `Every ${run.dayOfWeek} · Next: ${formatDate(run.date)}`
                  : formatDate(run.date)}
                {formatTime() && <span className="ml-1 text-gray-500">at {formatTime()}</span>}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
              <div>
                <div className="font-medium">{run.meetUpPoint}</div>
                {(run.meetUpStreetAddress || run.meetUpCity) && (
                  <div className="text-sm text-gray-500">
                    {[run.meetUpStreetAddress, run.meetUpCity, run.meetUpState].filter(Boolean).join(', ')}
                  </div>
                )}
                {run.meetUpLat && run.meetUpLng && (
                  <a
                    href={`https://www.google.com/maps?q=${run.meetUpLat},${run.meetUpLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-orange-500 hover:text-orange-600"
                  >
                    Open in Maps →
                  </a>
                )}
              </div>
            </div>
            {(run.totalMiles || run.pace) && (
              <div className="flex gap-4 text-sm pt-1">
                {run.totalMiles && <span><span className="text-gray-400">Distance</span> {run.totalMiles} mi</span>}
                {run.pace && <span><span className="text-gray-400">Pace</span> {run.pace}</span>}
              </div>
            )}
            {run.stravaMapUrl && (
              <a href={run.stravaMapUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-orange-500 hover:text-orange-600 pt-1">
                <Map className="h-4 w-4" /> View Route
              </a>
            )}
          </div>

          {run.description && (
            <p className="mt-4 text-gray-700 text-sm whitespace-pre-wrap border-t border-gray-100 pt-4">{run.description}</p>
          )}
        </div>

        {/* Who's going */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Going ({going.length})</h2>
          </div>
          {going.length === 0 ? (
            <p className="text-sm text-gray-400">No one yet — you're the first!</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {going.map(r => (
                <div key={r.id} className="flex items-center gap-2">
                  <Avatar athlete={r.Athlete} size={8} />
                  <span className="text-sm text-gray-700">
                    {r.Athlete?.firstName} {r.Athlete?.lastName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messaging */}
        <div className="bg-white rounded-xl shadow-sm flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Run chat</h2>
            <p className="text-xs text-gray-400 mt-0.5">Only people going can see this</p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-[200px] max-h-[400px]">
            {messages.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No messages yet. Say something!</p>
            ) : (
              messages.map(msg => {
                const isMe = msg.athleteId === athleteId;
                return (
                  <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <Avatar athlete={msg.Athlete} size={8} />
                    <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {!isMe && (
                        <span className="text-xs text-gray-400">
                          {msg.Athlete?.firstName} {msg.Athlete?.lastName}
                        </span>
                      )}
                      <div className={`px-4 py-2 rounded-2xl text-sm ${
                        isMe
                          ? 'bg-orange-500 text-white rounded-tr-sm'
                          : 'bg-gray-100 text-gray-900 rounded-tl-sm'
                      }`}>
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

          <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Message the crew..."
              className="flex-1 px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sendingMessage}
              className="p-2 bg-orange-500 text-white rounded-full hover:bg-orange-600 disabled:opacity-40 transition"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
