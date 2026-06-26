'use client';

import { useState } from 'react';
import { Trophy } from 'lucide-react';
import api from '@/lib/api';
import { buildPostRunHeroHeadline, isIndividualHostedRun, resolveRunClubLabel } from '@/lib/city-run-copy';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';
import {
  CityRunPostRunCrewSection,
  CityRunPostRunPhotosSection,
  CityRunPostRunShoutsSection,
  RunnerAvatar,
} from '@/components/runs/CityRunPostRunSections';
import { type CityRunCheckin, type PostRunRun } from '@/components/runs/city-run-types';

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
  const crewLabel = isIndividualHostedRun(run)
    ? 'Hosted run'
    : resolveRunClubLabel(run.runClub, run.title);
  const heroHeadline = buildPostRunHeroHeadline({
    cityRunType: run.cityRunType,
    runClub: run.runClub,
    runTitle: run.title,
    runDate: run.date,
  });

  const [myCheckin, setMyCheckin] = useState<CityRunCheckin>(initialCheckin);
  const [checkins, setCheckins] = useState<CityRunCheckin[]>(initialCheckins);

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

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <TopNav showBack backUrl="/gorun" backLabel="Run hub" />

      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-start gap-4">
            {run.runClub?.logoUrl?.trim() &&
            (run.runClub.logoUrl.startsWith('http') || run.runClub.logoUrl.startsWith('/')) ? (
              <img
                src={run.runClub.logoUrl}
                alt=""
                className="w-14 h-14 rounded-xl object-contain bg-white border border-gray-200 shrink-0 p-1"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white border border-gray-200 shrink-0">
                <Trophy className="w-7 h-7" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                {crewLabel}
              </p>
              <h1 className="mt-1 text-xl sm:text-2xl font-bold text-gray-900 leading-snug">
                {heroHeadline}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                {checkins.length} {checkins.length === 1 ? 'runner' : 'runners'} showed up
              </p>
              {sortedCrew.length > 0 ? (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex items-center -space-x-2">
                    {sortedCrew.slice(0, 8).map((m) => (
                      <RunnerAvatar key={m.id} athlete={m.Athlete} className="w-8 h-8" />
                    ))}
                  </div>
                  {sortedCrew.length > 8 ? (
                    <span className="text-xs text-gray-500">+{sortedCrew.length - 8} more</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-5 pb-10 space-y-4">
        <CityRunPostRunCrewSection
          sortedCrew={sortedCrew}
          athleteId={athleteId}
          crewExpanded
          onToggleExpanded={() => undefined}
          expanded
          clubName={crewLabel}
        />

        <CityRunPostRunShoutsSection
          myCheckin={myCheckin}
          othersWithShouts={othersWithShouts}
          editingShouts={editingShouts}
          shoutsInput={shoutsInput}
          savingShouts={savingShouts}
          clubName={crewLabel}
          showOthers={false}
          onStartEdit={() => setEditingShouts(true)}
          onCancelEdit={() => {
            setEditingShouts(false);
            setShoutsInput(myCheckin.runShouts || '');
          }}
          onShoutsInputChange={setShoutsInput}
          onSaveShouts={() => void saveShouts()}
        />

        {othersWithShouts.length > 0 ? (
          <CityRunPostRunShoutsSection
            myCheckin={myCheckin}
            othersWithShouts={othersWithShouts}
            editingShouts={false}
            shoutsInput=""
            savingShouts={false}
            clubName={crewLabel}
            showMine={false}
            onStartEdit={() => undefined}
            onCancelEdit={() => undefined}
            onShoutsInputChange={() => undefined}
            onSaveShouts={() => undefined}
          />
        ) : null}

        <CityRunPostRunPhotosSection
          myCheckin={myCheckin}
          photos={photos}
          athleteId={athleteId}
          othersCount={others.length}
          uploading={uploading}
          uploadError={uploadError}
          clubName={crewLabel}
          onFileChange={handleFileChange}
        />
      </main>
    </div>
  );
}
