'use client';

import { useState, useRef } from 'react';
import {
  Trophy,
  ImagePlus,
  Loader2,
  MessageSquare,
  Calendar,
  MapPin,
  Map,
  ExternalLink,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';
import CityRunActivityLinkPanel from '@/components/runs/CityRunActivityLinkPanel';
import CityRunRouteMedia from '@/components/runs/CityRunRouteMedia';

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

export interface PostRunRun {
  id: string;
  title: string;
  date: string;
  meetUpPoint: string;
  meetUpCity: string | null;
  meetUpStreetAddress: string | null;
  totalMiles: number | null;
  pace: string | null;
  stravaMapUrl: string | null;
  routePhotos?: string[] | null;
  mapImageUrl?: string | null;
  runClub?: { name: string; logoUrl: string | null } | null;
}

interface Props {
  run: PostRunRun;
  myCheckin: Checkin;
  allCheckins: Checkin[];
}

function Avatar({
  athlete,
  className = 'w-10 h-10',
}: {
  athlete?: { firstName: string; lastName: string; photoURL?: string | null } | null;
  className?: string;
}) {
  if (!athlete) return null;
  if (athlete.photoURL) {
    return (
      <img
        src={athlete.photoURL}
        alt={athlete.firstName}
        className={`${className} rounded-full object-cover ring-2 ring-white shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${className} rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold ring-2 ring-white text-sm shrink-0`}
    >
      {(athlete.firstName?.[0] || '?').toUpperCase()}
    </div>
  );
}

export default function CityRunPostRunContainer({
  run,
  myCheckin: initialCheckin,
  allCheckins: initialCheckins,
}: Props) {
  const athleteId = LocalStorageAPI.getAthleteId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [myCheckin, setMyCheckin] = useState<Checkin>(initialCheckin);
  const [checkins, setCheckins] = useState<Checkin[]>(initialCheckins);
  const [crewExpanded, setCrewExpanded] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [editingShouts, setEditingShouts] = useState(false);
  const [shoutsInput, setShoutsInput] = useState(initialCheckin.runShouts || '');
  const [savingShouts, setSavingShouts] = useState(false);

  const patchMyCheckin = (patch: Partial<Checkin>) => {
    const updated = { ...myCheckin, ...patch };
    setMyCheckin(updated);
    setCheckins((prev) => prev.map((c) => (c.athleteId === athleteId ? updated : c)));
  };

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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

  const formatDateHeader = (d: string) =>
    new Date(d).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  const photos = checkins.filter((c) => c.runPhotoUrl);
  const others = checkins.filter((c) => c.athleteId !== athleteId);
  const othersWithShouts = checkins
    .filter((c) => c.runShouts && c.athleteId !== athleteId)
    .sort((a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime());

  const sortedCrew = [...checkins].sort(
    (a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime()
  );

  const locationLine = [run.meetUpStreetAddress, run.meetUpCity].filter(Boolean).join(', ') || null;
  const hasRouteMedia =
    Boolean(run.mapImageUrl) ||
    (Array.isArray(run.routePhotos) && run.routePhotos.some((u) => typeof u === 'string' && u.trim()));

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <TopNav showBack backUrl="/gorun" backLabel="Run hub" />

      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              {run.runClub?.logoUrl?.trim() &&
              (run.runClub.logoUrl.startsWith('http') || run.runClub.logoUrl.startsWith('/')) ? (
                <img
                  src={run.runClub.logoUrl}
                  alt=""
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-contain bg-white border-2 border-gray-200 shrink-0 p-1"
                />
              ) : (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white border-2 border-gray-200 shrink-0">
                  <Trophy className="w-8 h-8" />
                </div>
              )}
              <div className="min-w-0">
                {run.runClub?.name ? (
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">{run.runClub.name}</p>
                ) : null}
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 leading-tight">
                  {run.title}
                </h1>
                <div className="mt-2 flex flex-wrap gap-2 sm:gap-3 text-sm text-gray-600 items-center">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-4 h-4 shrink-0" />
                    {formatDateHeader(run.date)}
                  </span>
                  {run.totalMiles != null && Number.isFinite(Number(run.totalMiles)) ? (
                    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                      {run.totalMiles} mi
                    </span>
                  ) : null}
                  {run.pace?.trim() ? (
                    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                      {run.pace}
                    </span>
                  ) : null}
                  {run.meetUpCity ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-4 h-4 shrink-0" />
                      {run.meetUpCity}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-orange-700 font-medium">
                  {checkins.length} {checkins.length === 1 ? 'runner' : 'runners'} showed up
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {hasRouteMedia ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-4">
          <CityRunRouteMedia routePhotos={run.routePhotos} mapImageUrl={run.mapImageUrl} />
        </div>
      ) : null}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-6 space-y-6 min-w-0 order-1">
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-gray-100 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-orange-600 shrink-0" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Shout-outs</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Give the crew some love — good job, great pace, thanks for showing up.</p>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {othersWithShouts.length === 0 && !myCheckin.runShouts ? (
                  <p className="px-4 sm:px-5 py-8 text-sm text-gray-500 text-center">
                    Be the first to shout out the crew.
                  </p>
                ) : null}

                {othersWithShouts.map((c) => (
                  <div key={c.id} className="flex gap-3 px-4 sm:px-5 py-4">
                    <Avatar athlete={c.Athlete} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {c.Athlete?.firstName} {c.Athlete?.lastName}
                      </p>
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{c.runShouts}</p>
                    </div>
                  </div>
                ))}

                <div className="px-4 sm:px-5 py-4 bg-orange-50/40">
                  <div className="flex gap-3">
                    <Avatar athlete={myCheckin.Athlete} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-orange-800 mb-2">Your shout-out</p>
                      {editingShouts ? (
                        <div className="space-y-2">
                          <textarea
                            value={shoutsInput}
                            onChange={(e) => setShoutsInput(e.target.value)}
                            placeholder="e.g. Great job everyone — see you next week!"
                            rows={3}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                            autoFocus
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void saveShouts()}
                              disabled={savingShouts}
                              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 disabled:opacity-50"
                            >
                              {savingShouts ? 'Saving…' : 'Post'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingShouts(false);
                                setShoutsInput(myCheckin.runShouts || '');
                              }}
                              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingShouts(true)}
                          className="w-full text-left rounded-xl border border-dashed border-orange-200 bg-white px-3 py-3 hover:border-orange-300 transition"
                        >
                          {myCheckin.runShouts ? (
                            <p className="text-sm text-gray-800">
                              <span className="font-semibold text-gray-900">
                                {myCheckin.Athlete?.firstName}
                              </span>{' '}
                              {myCheckin.runShouts}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-500 italic">Add your shout-out…</p>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-gray-100 flex items-center gap-2">
                <ImagePlus className="h-5 w-5 text-gray-500 shrink-0" />
                <h2 className="text-lg font-bold text-gray-900">Run photos</h2>
              </div>

              <div className="p-4 sm:p-5 border-b border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar athlete={myCheckin.Athlete} />
                  <span className="text-sm font-medium text-gray-700">
                    {myCheckin.Athlete?.firstName}{' '}
                    <span className="text-orange-600 text-xs font-semibold">you</span>
                  </span>
                </div>

                {myCheckin.runPhotoUrl ? (
                  <div className="relative rounded-xl overflow-hidden">
                    <img
                      src={myCheckin.runPhotoUrl}
                      alt="Your run"
                      className="w-full max-h-80 object-cover"
                    />
                    <button
                      type="button"
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
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex flex-col items-center justify-center gap-2 py-10 rounded-xl bg-gray-50 hover:bg-orange-50 border-2 border-dashed border-gray-200 hover:border-orange-200 transition"
                  >
                    {uploading ? (
                      <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
                    ) : (
                      <ImagePlus className="h-8 w-8 text-gray-300" />
                    )}
                    <span className="text-sm text-gray-500">
                      {uploading ? 'Uploading…' : 'Add your run photo'}
                    </span>
                  </button>
                )}

                {uploadError ? <p className="text-xs text-red-600 mt-2">{uploadError}</p> : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {photos.filter((c) => c.athleteId !== athleteId).length > 0 ? (
                <div className="p-4 sm:p-5">
                  <p className="text-xs font-medium text-gray-500 mb-3">From the crew</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {photos
                      .filter((c) => c.athleteId !== athleteId)
                      .map((c) => (
                        <div
                          key={c.id}
                          className="relative rounded-xl overflow-hidden aspect-square bg-gray-100"
                        >
                          <img
                            src={c.runPhotoUrl!}
                            alt={c.Athlete?.firstName || ''}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
                            <span className="text-white text-xs font-medium">
                              {c.Athlete?.firstName}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}

              {photos.length === 0 && !myCheckin.runPhotoUrl && others.length > 0 ? (
                <p className="text-sm text-gray-500 px-4 sm:px-5 pb-5 text-center">No crew photos yet</p>
              ) : null}
            </section>
          </div>

          <aside className="lg:col-span-6 space-y-6 min-w-0 order-2">
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-orange-600 shrink-0" />
                At a glance
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex gap-2">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">When</p>
                    <p className="text-gray-700">{formatDateHeader(run.date)}</p>
                  </div>
                </div>
                {run.meetUpPoint ? (
                  <div className="flex gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">Meet-up</p>
                      <p className="text-gray-700">{run.meetUpPoint}</p>
                      {locationLine ? <p className="text-gray-500 text-xs mt-0.5">{locationLine}</p> : null}
                    </div>
                  </div>
                ) : null}
                {run.totalMiles != null && Number.isFinite(Number(run.totalMiles)) ? (
                  <div>
                    <p className="font-semibold text-gray-900">Distance</p>
                    <p className="text-gray-700">{run.totalMiles} mi</p>
                  </div>
                ) : null}
                {run.pace?.trim() ? (
                  <div>
                    <p className="font-semibold text-gray-900">Pace</p>
                    <p className="text-gray-700">{run.pace}</p>
                  </div>
                ) : null}
              </div>
              {run.stravaMapUrl ? (
                <a
                  href={run.stravaMapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
                >
                  <Map className="w-4 h-4 shrink-0" />
                  View route on Strava
                  <ExternalLink className="w-4 h-4 shrink-0" />
                </a>
              ) : null}
            </section>

            <CityRunActivityLinkPanel runId={run.id} runDateIso={run.date} />

            <section className="border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={() => setCrewExpanded((v) => !v)}
                className="w-full flex items-center justify-between gap-3 text-left rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-3 py-2.5 transition-colors shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0">
                    Who showed up
                  </span>
                  {sortedCrew.length > 0 ? (
                    <div className="flex items-center -space-x-2">
                      {sortedCrew.slice(0, 6).map((m) => (
                        <div
                          key={m.id}
                          className="relative w-8 h-8 rounded-full border-2 border-white bg-gray-200 overflow-hidden flex items-center justify-center text-[10px] font-semibold text-gray-700 shrink-0"
                          title={
                            [m.Athlete?.firstName, m.Athlete?.lastName].filter(Boolean).join(' ') ||
                            'Runner'
                          }
                        >
                          {m.Athlete?.photoURL ? (
                            <img
                              src={m.Athlete.photoURL}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            (m.Athlete?.firstName?.[0] || '?').toUpperCase()
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <span className="text-sm text-gray-600 truncate">
                    {sortedCrew.length === 0
                      ? 'No one yet'
                      : `${sortedCrew.length} runner${sortedCrew.length === 1 ? '' : 's'}`}
                  </span>
                </div>
                {crewExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                )}
              </button>
              {crewExpanded ? (
                <ul className="mt-3 space-y-2 max-h-[min(24rem,50vh)] overflow-y-auto pr-1">
                  {sortedCrew.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2"
                    >
                      <Avatar athlete={m.Athlete} className="w-9 h-9" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {m.Athlete?.firstName} {m.Athlete?.lastName}
                        </p>
                        {m.athleteId === athleteId ? (
                          <p className="text-xs text-orange-600 font-medium">You</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {sortedCrew.slice(0, 4).map((m) => (
                    <li key={m.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <Avatar athlete={m.Athlete} className="w-7 h-7" />
                      <span className="truncate">
                        {m.Athlete?.firstName} {m.Athlete?.lastName}
                        {m.athleteId === athleteId ? (
                          <span className="text-orange-600 font-medium"> · you</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                  {sortedCrew.length > 4 ? (
                    <li className="text-xs text-gray-500 pl-9 pt-1">
                      +{sortedCrew.length - 4} more — tap header to expand
                    </li>
                  ) : null}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
