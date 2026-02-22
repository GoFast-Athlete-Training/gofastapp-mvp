'use client';

import { useState, useRef } from 'react';
import { Trophy, ArrowLeft, ImagePlus, Loader2, MessageSquare } from 'lucide-react';
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
  meetUpCity: string | null;
  totalMiles: number | null;
  runClub?: { name: string; logoUrl: string | null } | null;
}

interface Props {
  run: Run;
  myCheckin: Checkin;
  allCheckins: Checkin[];
  onBack: () => void;
}

function Avatar({ athlete, size = 8 }: {
  athlete?: { firstName: string; lastName: string; photoURL?: string | null } | null;
  size?: number;
}) {
  if (!athlete) return null;
  const sz = `w-${size} h-${size}`;
  if (athlete.photoURL) {
    return <img src={athlete.photoURL} alt={athlete.firstName} className={`${sz} rounded-full object-cover ring-2 ring-white shrink-0`} />;
  }
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold ring-2 ring-white text-sm shrink-0`}>
      {(athlete.firstName?.[0] || '?').toUpperCase()}
    </div>
  );
}

export default function CityRunPostRunContainer({ run, myCheckin: initialCheckin, allCheckins: initialCheckins, onBack }: Props) {
  const athleteId = LocalStorageAPI.getAthleteId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [myCheckin, setMyCheckin] = useState<Checkin>(initialCheckin);
  const [checkins, setCheckins] = useState<Checkin[]>(initialCheckins);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [editingShouts, setEditingShouts] = useState(false);
  const [shoutsInput, setShoutsInput] = useState(initialCheckin.runShouts || '');
  const [savingShouts, setSavingShouts] = useState(false);

  const patchMyCheckin = (patch: Partial<Checkin>) => {
    const updated = { ...myCheckin, ...patch };
    setMyCheckin(updated);
    setCheckins(prev => prev.map(c => c.athleteId === athleteId ? updated : c));
  };

  // ── Photo upload ────────────────────────────────────────────────────────────
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
      await api.post(`/runs/${run.id}/checkin`, { runPhotoUrl: data.url });
      patchMyCheckin({ runPhotoUrl: data.url });
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Save shouts ─────────────────────────────────────────────────────────────
  const saveShouts = async () => {
    setSavingShouts(true);
    try {
      await api.post(`/runs/${run.id}/checkin`, { runShouts: shoutsInput });
      patchMyCheckin({ runShouts: shoutsInput });
      setEditingShouts(false);
    } catch (err) {
      console.error('Failed to save shouts:', err);
    } finally {
      setSavingShouts(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const photos = checkins.filter(c => c.runPhotoUrl);
  const shouts = checkins.filter(c => c.runShouts);
  const others = checkins.filter(c => c.athleteId !== athleteId);

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
          <div className="mt-2 text-orange-100 text-xs">
            {checkins.length} {checkins.length === 1 ? 'runner' : 'runners'} showed up
          </div>
        </div>

        {/* ── Photos section ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900 text-sm">Run Photos</h2>
          </div>

          {/* Your photo upload */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <Avatar athlete={myCheckin.Athlete} size={8} />
              <span className="text-sm font-medium text-gray-700">
                {myCheckin.Athlete?.firstName} <span className="text-orange-500 text-xs font-medium">you</span>
              </span>
            </div>

            {myCheckin.runPhotoUrl ? (
              <div className="relative rounded-xl overflow-hidden">
                <img src={myCheckin.runPhotoUrl} alt="Your run" className="w-full max-h-72 object-cover" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-2 right-2 flex items-center gap-1 px-2.5 py-1 bg-black/60 text-white text-xs rounded-full hover:bg-black/80 transition"
                >
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {uploading ? 'Uploading…' : 'Change'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl bg-gray-50 hover:bg-orange-50 border-2 border-dashed border-gray-200 hover:border-orange-200 transition"
              >
                {uploading
                  ? <Loader2 className="h-6 w-6 text-orange-400 animate-spin" />
                  : <ImagePlus className="h-6 w-6 text-gray-300" />
                }
                <span className="text-sm text-gray-400">
                  {uploading ? 'Uploading…' : 'Add your run photo'}
                </span>
              </button>
            )}

            {uploadError && <p className="text-xs text-red-500 mt-2">{uploadError}</p>}

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Crew photos */}
          {photos.filter(c => c.athleteId !== athleteId).length > 0 && (
            <div className="p-4">
              <p className="text-xs text-gray-400 mb-3">From the crew</p>
              <div className="grid grid-cols-2 gap-2">
                {photos
                  .filter(c => c.athleteId !== athleteId)
                  .map(c => (
                    <div key={c.id} className="relative rounded-xl overflow-hidden aspect-square bg-gray-100">
                      <img src={c.runPhotoUrl!} alt={c.Athlete?.firstName} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
                        <span className="text-white text-xs font-medium">{c.Athlete?.firstName}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {photos.length === 0 && !myCheckin.runPhotoUrl && others.length > 0 && (
            <p className="text-sm text-gray-400 px-4 pb-4 text-center">No crew photos yet</p>
          )}
        </div>

        {/* ── Shouts section ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900 text-sm">Shouts</h2>
          </div>

          {/* Other people's shouts */}
          {shouts.filter(c => c.athleteId !== athleteId).length > 0 && (
            <div className="divide-y divide-gray-50">
              {shouts
                .filter(c => c.athleteId !== athleteId)
                .map(c => (
                  <div key={c.id} className="flex gap-3 px-4 py-3">
                    <Avatar athlete={c.Athlete} size={8} />
                    <div>
                      <span className="text-sm font-semibold text-gray-900 mr-1.5">
                        {c.Athlete?.firstName} {c.Athlete?.lastName}
                      </span>
                      <span className="text-sm text-gray-700">{c.runShouts}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* My shout */}
          <div className="px-4 py-3 border-t border-gray-50">
            <div className="flex gap-3">
              <Avatar athlete={myCheckin.Athlete} size={8} />
              <div className="flex-1">
                {editingShouts ? (
                  <div className="space-y-2">
                    <textarea
                      value={shoutsInput}
                      onChange={e => setShoutsInput(e.target.value)}
                      placeholder="Shout out the crew, the route, the pace…"
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
                        {savingShouts ? 'Saving…' : 'Post'}
                      </button>
                      <button
                        onClick={() => { setEditingShouts(false); setShoutsInput(myCheckin.runShouts || ''); }}
                        className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingShouts(true)}
                    className="w-full text-left"
                  >
                    {myCheckin.runShouts ? (
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2 hover:bg-orange-50 transition">
                        <span className="font-semibold text-gray-900 mr-1.5">
                          {myCheckin.Athlete?.firstName}
                        </span>
                        {myCheckin.runShouts}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-3 py-2 hover:bg-orange-50 transition italic">
                        Add your shouts…
                      </p>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
