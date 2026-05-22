'use client';

import { useRef } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ImagePlus,
  Info,
  Loader2,
  Map,
  MapPin,
  MessageSquare,
} from 'lucide-react';
import type { CityRunCheckin, PostRunRun } from '@/components/runs/city-run-types';
import { formatRunDate } from '@/components/runs/city-run-types';

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

type ShoutsSectionProps = {
  myCheckin: CityRunCheckin;
  othersWithShouts: CityRunCheckin[];
  editingShouts: boolean;
  shoutsInput: string;
  savingShouts: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onShoutsInputChange: (value: string) => void;
  onSaveShouts: () => void;
};

export function CityRunPostRunShoutsSection({
  myCheckin,
  othersWithShouts,
  editingShouts,
  shoutsInput,
  savingShouts,
  onStartEdit,
  onCancelEdit,
  onShoutsInputChange,
  onSaveShouts,
}: ShoutsSectionProps) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-gray-100 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-orange-600 shrink-0" />
        <div>
          <h2 className="text-lg font-bold text-gray-900">Shout-outs</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Give the crew some love — good job, great pace, thanks for showing up.
          </p>
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
                    onChange={(e) => onShoutsInputChange(e.target.value)}
                    placeholder="e.g. Great job everyone — see you next week!"
                    rows={3}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void onSaveShouts()}
                      disabled={savingShouts}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 disabled:opacity-50"
                    >
                      {savingShouts ? 'Saving…' : 'Post'}
                    </button>
                    <button type="button" onClick={onCancelEdit} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onStartEdit}
                  className="w-full text-left rounded-xl border border-dashed border-orange-200 bg-white px-3 py-3 hover:border-orange-300 transition"
                >
                  {myCheckin.runShouts ? (
                    <p className="text-sm text-gray-800">
                      <span className="font-semibold text-gray-900">{myCheckin.Athlete?.firstName}</span>{' '}
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
  );
}

type PhotosSectionProps = {
  myCheckin: CityRunCheckin;
  photos: CityRunCheckin[];
  athleteId: string | null;
  othersCount: number;
  uploading: boolean;
  uploadError: string | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export function CityRunPostRunPhotosSection({
  myCheckin,
  photos,
  athleteId,
  othersCount,
  uploading,
  uploadError,
  onFileChange,
}: PhotosSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
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
            <img src={myCheckin.runPhotoUrl} alt="Your run" className="w-full max-h-80 object-cover" />
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
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
      </div>

      {photos.filter((c) => c.athleteId !== athleteId).length > 0 ? (
        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-gray-500 mb-3">From the crew</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {photos
              .filter((c) => c.athleteId !== athleteId)
              .map((c) => (
                <div key={c.id} className="relative rounded-xl overflow-hidden aspect-square bg-gray-100">
                  <img
                    src={c.runPhotoUrl!}
                    alt={c.Athlete?.firstName || ''}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
                    <span className="text-white text-xs font-medium">{c.Athlete?.firstName}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {photos.length === 0 && !myCheckin.runPhotoUrl && othersCount > 0 ? (
        <p className="text-sm text-gray-500 px-4 sm:px-5 pb-5 text-center">No crew photos yet</p>
      ) : null}
    </section>
  );
}

export function CityRunPostRunDetailsSection({ run }: { run: PostRunRun }) {
  const locationLine = [run.meetUpStreetAddress, run.meetUpCity].filter(Boolean).join(', ') || null;

  return (
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
            <p className="text-gray-700">{formatRunDate(run.date)}</p>
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
  );
}

type CrewSectionProps = {
  sortedCrew: CityRunCheckin[];
  athleteId: string | null;
  crewExpanded: boolean;
  onToggleExpanded: () => void;
  expanded?: boolean;
};

export function CityRunPostRunCrewSection({
  sortedCrew,
  athleteId,
  crewExpanded,
  onToggleExpanded,
  expanded = false,
}: CrewSectionProps) {
  const showExpanded = expanded || crewExpanded;

  if (expanded) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Who showed up</h2>
          <p className="text-sm text-gray-500 mt-1">
            {sortedCrew.length === 0
              ? 'No one checked in yet.'
              : `${sortedCrew.length} runner${sortedCrew.length === 1 ? '' : 's'} checked in`}
          </p>
        </div>
        <ul className="space-y-2">
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
      </section>
    );
  }

  return (
    <section className="border-t border-gray-200 pt-4">
      <button
        type="button"
        onClick={onToggleExpanded}
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
                    [m.Athlete?.firstName, m.Athlete?.lastName].filter(Boolean).join(' ') || 'Runner'
                  }
                >
                  {m.Athlete?.photoURL ? (
                    <img src={m.Athlete.photoURL} alt="" className="w-full h-full object-cover" />
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
        {showExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
        )}
      </button>
      {showExpanded ? (
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
  );
}
