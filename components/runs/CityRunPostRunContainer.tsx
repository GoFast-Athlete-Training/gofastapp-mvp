'use client';

import { useState, useRef } from 'react';
import { Camera, Trophy, ArrowLeft, ImagePlus, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

interface Checkin {
  id: string;
  runId: string;
  athleteId: string;
  checkedInAt: string;
  runPhotoUrl: string | null;
  runShouts: string | null;
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
  date: string;
  meetUpPoint: string;
  meetUpCity: string | null;
  meetUpState: string | null;
  totalMiles: number | null;
  pace: string | null;
  runClub?: { name: string; logoUrl: string | null } | null;
}

interface Props {
  run: Run;
  myCheckin: Checkin;
  allCheckins: Checkin[];
  onBack: () => void;
}

function Avatar({ athlete, size = 9 }: {
  athlete?: { firstName: string; lastName: string; photoURL?: string | null } | null;
  size?: number;
}) {
  if (!athlete) return null;
  const sz = `w-${size} h-${size}`;
  if (athlete.photoURL) {
    return <img src={athlete.photoURL} alt={athlete.firstName} className={`${sz} rounded-full object-cover ring-2 ring-white`} />;
  }
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold ring-2 ring-white text-sm`}>
      {(athlete.firstName?.[0] || '?').toUpperCase()}
    </div>
  );
}

// ── Single feed post ──────────────────────────────────────────────────────────
function FeedPost({
  checkin,
  isMe,
  onPhotoUploaded,
  onShoutsSaved,
  runId,
}: {
  checkin: Checkin;
  isMe: boolean;
  onPhotoUploaded: (url: string) => void;
  onShoutsSaved: (text: string) => void;
  runId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingShouts, setEditingShouts] = useState(false);
  const [shoutsInput, setShoutsInput] = useState(checkin.runShouts || '');
  const [savingShouts, setSavingShouts] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed');
      // Persist to checkin record
      await api.post(`/runs/${runId}/checkin`, { runPhotoUrl: data.url });
      onPhotoUploaded(data.url);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveShouts = async () => {
    setSavingShouts(true);
    try {
      await api.post(`/runs/${runId}/checkin`, { runShouts: shoutsInput });
      onShoutsSaved(shoutsInput);
      setEditingShouts(false);
    } catch (err) {
      console.error('Failed to save shouts:', err);
    } finally {
      setSavingShouts(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Post header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Avatar athlete={checkin.Athlete} size={9} />
        <div className="flex-1">
          <div className="font-semibold text-gray-900 text-sm">
            {checkin.Athlete?.firstName} {checkin.Athlete?.lastName}
            {isMe && <span className="ml-2 text-xs text-orange-500 font-medium">you</span>}
          </div>
          <div className="text-xs text-green-600 font-medium">Ran it ✓</div>
        </div>
      </div>

      {/* Photo */}
      {checkin.runPhotoUrl ? (
        <div className="relative w-full bg-gray-100">
          <img
            src={checkin.runPhotoUrl}
            alt="Run photo"
            className="w-full max-h-[480px] object-cover"
          />
          {isMe && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 text-white text-xs rounded-full hover:bg-black/80 transition"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
              {uploading ? 'Uploading…' : 'Change photo'}
            </button>
          )}
        </div>
      ) : isMe ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full flex flex-col items-center justify-center gap-2 py-12 bg-gray-50 hover:bg-orange-50 transition border-t border-b border-dashed border-gray-200"
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
          ) : (
            <ImagePlus className="h-8 w-8 text-gray-300" />
          )}
          <span className="text-sm text-gray-400">{uploading ? 'Uploading…' : 'Add a photo from your run'}</span>
        </button>
      ) : null}

      {/* Hidden file input */}
      {isMe && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      )}

      {uploadError && (
        <p className="text-xs text-red-500 px-4 pt-2">{uploadError}</p>
      )}

      {/* Shouts */}
      <div className="px-4 py-3">
        {isMe ? (
          editingShouts ? (
            <div className="space-y-2">
              <textarea
                value={shoutsInput}
                onChange={e => setShoutsInput(e.target.value)}
                placeholder="Shout out your crew, how the run felt, what you loved..."
                rows={3}
                className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={saveShouts}
                  disabled={savingShouts}
                  className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition"
                >
                  {savingShouts ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditingShouts(false); setShoutsInput(checkin.runShouts || ''); }}
                  className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p
              onClick={() => setEditingShouts(true)}
              className={`text-sm cursor-pointer rounded-lg px-2 py-1 -mx-2 hover:bg-orange-50 transition ${
                checkin.runShouts ? 'text-gray-800' : 'text-gray-400 italic'
              }`}
            >
              {checkin.runShouts || 'Add your shouts…'}
            </p>
          )
        ) : (
          checkin.runShouts && (
            <p className="text-sm text-gray-800">{checkin.runShouts}</p>
          )
        )}
      </div>
    </div>
  );
}

// ── Main container ────────────────────────────────────────────────────────────
export default function CityRunPostRunContainer({ run, myCheckin: initialCheckin, allCheckins: initialCheckins, onBack }: Props) {
  const athleteId = LocalStorageAPI.getAthleteId();
  const [checkins, setCheckins] = useState<Checkin[]>(initialCheckins);
  const [myCheckin, setMyCheckin] = useState<Checkin>(initialCheckin);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Update my checkin in both the dedicated state and the feed list
  const updateMyCheckin = (patch: Partial<Checkin>) => {
    const updated = { ...myCheckin, ...patch };
    setMyCheckin(updated);
    setCheckins(prev => prev.map(c => c.athleteId === athleteId ? updated : c));
  };

  // Feed order: my post first, then others sorted by checkedInAt desc
  const feedOrder = [
    myCheckin,
    ...checkins
      .filter(c => c.athleteId !== athleteId)
      .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime()),
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Back */}
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition text-sm">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Run hero */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-400 rounded-2xl px-5 py-4 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Post-run</span>
          </div>
          <h1 className="text-xl font-bold leading-tight">{run.title}</h1>
          <p className="text-orange-100 text-sm mt-0.5">
            {formatDate(run.date)}
            {run.totalMiles && <span> · {run.totalMiles} mi</span>}
            {run.meetUpCity && <span> · {run.meetUpCity}</span>}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex -space-x-2">
              {checkins.slice(0, 5).map(c => (
                <Avatar key={c.id} athlete={c.Athlete} size={7} />
              ))}
            </div>
            <span className="text-orange-100 text-xs">
              {checkins.length} {checkins.length === 1 ? 'runner' : 'runners'} showed up
            </span>
          </div>
        </div>

        {/* Feed */}
        {feedOrder.map(c => (
          <FeedPost
            key={c.id}
            checkin={c}
            isMe={c.athleteId === athleteId}
            runId={run.id}
            onPhotoUploaded={url => updateMyCheckin({ runPhotoUrl: url })}
            onShoutsSaved={text => updateMyCheckin({ runShouts: text })}
          />
        ))}

      </div>
    </div>
  );
}
