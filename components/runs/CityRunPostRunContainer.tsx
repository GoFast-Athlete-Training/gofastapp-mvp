'use client';

import { useState } from 'react';
import { Calendar, Trophy } from 'lucide-react';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';
import CityRunMobileTabs from '@/components/runs/CityRunMobileTabs';
import {
  CityRunPostRunCrewSection,
  CityRunPostRunPhotosSection,
  CityRunPostRunShoutsSection,
} from '@/components/runs/CityRunPostRunSections';
import { formatRunDate, type CityRunCheckin, type PostRunRun } from '@/components/runs/city-run-types';

interface Props {
  run: PostRunRun;
  myCheckin: CityRunCheckin;
  allCheckins: CityRunCheckin[];
}

export default function CityRunPostRunContainer({
  run,
  myCheckin: initialCheckin,
  allCheckins: initialCheckins,
}: Props) {
  const athleteId = LocalStorageAPI.getAthleteId();

  const [myCheckin, setMyCheckin] = useState<CityRunCheckin>(initialCheckin);
  const [checkins, setCheckins] = useState<CityRunCheckin[]>(initialCheckins);
  const [crewExpanded, setCrewExpanded] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [editingShouts, setEditingShouts] = useState(false);
  const [shoutsInput, setShoutsInput] = useState(initialCheckin.runShouts || '');
  const [savingShouts, setSavingShouts] = useState(false);

  const patchMyCheckin = (patch: Partial<CityRunCheckin>) => {
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

  const photos = checkins.filter((c) => c.runPhotoUrl);
  const others = checkins.filter((c) => c.athleteId !== athleteId);
  const othersWithShouts = checkins
    .filter((c) => c.runShouts && c.athleteId !== athleteId)
    .sort((a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime());

  const sortedCrew = [...checkins].sort(
    (a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime()
  );

  const shoutsProps = {
    myCheckin,
    othersWithShouts,
    editingShouts,
    shoutsInput,
    savingShouts,
    onStartEdit: () => setEditingShouts(true),
    onCancelEdit: () => {
      setEditingShouts(false);
      setShoutsInput(myCheckin.runShouts || '');
    },
    onShoutsInputChange: setShoutsInput,
    onSaveShouts: () => void saveShouts(),
  };

  const photosProps = {
    myCheckin,
    photos,
    athleteId,
    othersCount: others.length,
    uploading,
    uploadError,
    onFileChange: handleFileChange,
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <TopNav showBack backUrl="/gorun" backLabel="Run hub" />

      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-6">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            {run.runClub?.logoUrl?.trim() &&
            (run.runClub.logoUrl.startsWith('http') || run.runClub.logoUrl.startsWith('/')) ? (
              <img
                src={run.runClub.logoUrl}
                alt=""
                className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl object-contain bg-white border-2 border-gray-200 shrink-0 p-1"
              />
            ) : (
              <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white border-2 border-gray-200 shrink-0">
                <Trophy className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              {run.runClub?.name ? (
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5 truncate">
                  {run.runClub.name}
                </p>
              ) : null}
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 leading-tight truncate">
                {run.title}
              </h1>
              <div className="mt-1 sm:mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-600 items-center">
                <span className="inline-flex items-center gap-1 min-w-0">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">{formatRunDate(run.date)}</span>
                </span>
              </div>
              <p className="mt-1 sm:mt-2 text-sm text-orange-700 font-medium">
                {checkins.length} {checkins.length === 1 ? 'runner' : 'runners'} showed up
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <CityRunMobileTabs
          mode="post-run"
          run={run}
          myCheckin={myCheckin}
          checkins={checkins}
          athleteId={athleteId}
          othersWithShouts={othersWithShouts}
          photos={photos}
          othersCount={others.length}
          sortedCrew={sortedCrew}
          editingShouts={editingShouts}
          shoutsInput={shoutsInput}
          savingShouts={savingShouts}
          uploading={uploading}
          uploadError={uploadError}
          onStartEditShouts={() => setEditingShouts(true)}
          onCancelEditShouts={() => {
            setEditingShouts(false);
            setShoutsInput(myCheckin.runShouts || '');
          }}
          onShoutsInputChange={setShoutsInput}
          onSaveShouts={() => void saveShouts()}
          onFileChange={handleFileChange}
        />

        <div className="hidden lg:grid grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-6 space-y-6 min-w-0 order-1">
            <CityRunPostRunShoutsSection {...shoutsProps} />
            <CityRunPostRunPhotosSection {...photosProps} />
          </div>

          <aside className="lg:col-span-6 space-y-6 min-w-0 order-2">
            <CityRunPostRunCrewSection
              sortedCrew={sortedCrew}
              athleteId={athleteId}
              crewExpanded={crewExpanded}
              onToggleExpanded={() => setCrewExpanded((v) => !v)}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
