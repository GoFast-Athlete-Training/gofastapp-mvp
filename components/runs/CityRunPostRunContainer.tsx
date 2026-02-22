'use client';

import { useState, useEffect } from 'react';
import { Camera, MessageSquare, Users, Trophy, ArrowLeft } from 'lucide-react';
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

function Avatar({ athlete, size = 10 }: { athlete?: { firstName: string; lastName: string; photoURL?: string | null } | null; size?: number }) {
  if (!athlete) return null;
  if (athlete.photoURL) {
    return <img src={athlete.photoURL} alt={athlete.firstName} className={`w-${size} h-${size} rounded-full object-cover border-2 border-white`} />;
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-semibold border-2 border-white text-sm`}>
      {(athlete.firstName?.[0] || '?').toUpperCase()}
    </div>
  );
}

export default function CityRunPostRunContainer({ run, myCheckin: initialCheckin, allCheckins: initialCheckins, onBack }: Props) {
  const athleteId = LocalStorageAPI.getAthleteId();

  const [checkins, setCheckins] = useState<Checkin[]>(initialCheckins);
  const [myCheckin, setMyCheckin] = useState<Checkin>(initialCheckin);
  const [editingShouts, setEditingShouts] = useState(false);
  const [shoutsInput, setShoutsInput] = useState(initialCheckin.runShouts || '');
  const [savingShouts, setSavingShouts] = useState(false);

  const others = checkins.filter(c => c.athleteId !== athleteId);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const refreshCheckins = async () => {
    try {
      const res = await api.get(`/runs/${run.id}/checkin`);
      if (res.data.success) {
        setCheckins(res.data.checkins);
        if (res.data.myCheckin) setMyCheckin(res.data.myCheckin);
      }
    } catch (err) {
      console.error('Failed to refresh checkins:', err);
    }
  };

  const saveShouts = async () => {
    setSavingShouts(true);
    try {
      const res = await api.post(`/runs/${run.id}/checkin`, { runShouts: shoutsInput });
      if (res.data.success) {
        setMyCheckin(res.data.checkin);
        setEditingShouts(false);
        await refreshCheckins();
      }
    } catch (err) {
      console.error('Failed to save shouts:', err);
    } finally {
      setSavingShouts(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Back */}
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition text-sm">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Hero banner */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-400 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="h-5 w-5" />
            <span className="font-semibold text-sm uppercase tracking-wide">You made it</span>
          </div>
          <h1 className="text-2xl font-bold mb-1">{run.title}</h1>
          <p className="text-orange-100 text-sm">
            {formatDate(run.date)}
            {run.totalMiles && <span> · {run.totalMiles} miles</span>}
            {run.meetUpCity && <span> · {run.meetUpCity}</span>}
          </p>
          {checkins.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex -space-x-2">
                {checkins.slice(0, 5).map(c => (
                  <Avatar key={c.id} athlete={c.Athlete} size={7} />
                ))}
              </div>
              <span className="text-orange-100 text-sm">
                {checkins.length} {checkins.length === 1 ? 'runner' : 'runners'} showed up
              </span>
            </div>
          )}
        </div>

        {/* My post-run card */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <Avatar athlete={myCheckin.Athlete} size={10} />
            <div>
              <div className="font-semibold text-gray-900">
                {myCheckin.Athlete?.firstName} {myCheckin.Athlete?.lastName}
              </div>
              <div className="text-xs text-green-600 font-medium">Checked in ✓</div>
            </div>
          </div>

          {/* Run photo */}
          {myCheckin.runPhotoUrl ? (
            <div className="mb-4">
              <img src={myCheckin.runPhotoUrl} alt="Your run" className="w-full rounded-xl object-cover max-h-72" />
            </div>
          ) : (
            <div className="mb-4 border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
              <Camera className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Add a photo from your run</p>
              <p className="text-xs text-gray-300 mt-1">Photo upload coming soon</p>
            </div>
          )}

          {/* Shout-outs */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Your shouts</span>
            </div>
            {editingShouts ? (
              <div className="space-y-2">
                <textarea
                  value={shoutsInput}
                  onChange={e => setShoutsInput(e.target.value)}
                  placeholder="Shout out your crew, how the run felt, what you loved..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveShouts}
                    disabled={savingShouts}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition"
                  >
                    {savingShouts ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditingShouts(false); setShoutsInput(myCheckin.runShouts || ''); }}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingShouts(true)}
                className="cursor-pointer group"
              >
                {myCheckin.runShouts ? (
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3 group-hover:bg-orange-50 transition">
                    {myCheckin.runShouts}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3 group-hover:bg-orange-50 transition">
                    Tap to add shouts for the crew...
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Crew who showed up */}
        {others.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Crew who showed up</h2>
            </div>
            <div className="space-y-5">
              {others.map(c => (
                <div key={c.id}>
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar athlete={c.Athlete} size={9} />
                    <span className="font-medium text-gray-900 text-sm">
                      {c.Athlete?.firstName} {c.Athlete?.lastName}
                    </span>
                  </div>
                  {c.runPhotoUrl && (
                    <img src={c.runPhotoUrl} alt={`${c.Athlete?.firstName}'s run`} className="w-full rounded-xl object-cover max-h-64 mb-2 ml-12" />
                  )}
                  {c.runShouts && (
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3 ml-12">
                      {c.runShouts}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
