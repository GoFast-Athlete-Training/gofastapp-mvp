'use client';

import { useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ImagePlus,
  Loader2,
  MessageSquare,
  Users,
} from 'lucide-react';
import type { CityRunCheckin } from '@/components/runs/city-run-types';

export function RunnerAvatar({
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
  clubName?: string;
  showMine?: boolean;
  showOthers?: boolean;
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
  clubName,
  showMine = true,
  showOthers = true,
  onStartEdit,
  onCancelEdit,
  onShoutsInputChange,
  onSaveShouts,
}: ShoutsSectionProps) {
  const isCommunityOnly = !showMine && showOthers;

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-gray-100 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-orange-600 shrink-0" />
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {isCommunityOnly ? 'What others are saying' : 'How did it feel?'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isCommunityOnly
              ? clubName
                ? `Shout-outs from ${clubName}`
                : 'Shout-outs from the crew'
              : clubName
                ? `Give ${clubName} a shout-out`
                : 'Tell the crew how it went'}
          </p>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {showOthers && othersWithShouts.length === 0 && !showMine ? (
          <p className="px-4 sm:px-5 py-6 text-sm text-gray-500 text-center">
            No crew shout-outs yet.
          </p>
        ) : null}

        {showOthers
          ? othersWithShouts.map((c) => (
              <div key={c.id} className="flex gap-3 px-4 sm:px-5 py-4">
                <RunnerAvatar athlete={c.Athlete} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {c.Athlete?.firstName} {c.Athlete?.lastName}
                  </p>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{c.runShouts}</p>
                </div>
              </div>
            ))
          : null}

        {showMine ? (
          <div className="px-4 sm:px-5 py-4 bg-orange-50/40">
            <div className="flex gap-3">
              <RunnerAvatar athlete={myCheckin.Athlete} />
              <div className="flex-1 min-w-0">
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
                      <button
                        type="button"
                        onClick={onCancelEdit}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                      >
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
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
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
        ) : null}
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
  clubName?: string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export function CityRunPostRunPhotosSection({
  myCheckin,
  photos,
  athleteId,
  othersCount,
  uploading,
  uploadError,
  clubName,
  onFileChange,
}: PhotosSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-gray-100 flex items-center gap-2">
        <ImagePlus className="h-5 w-5 text-orange-600 shrink-0" />
        <div>
          <h2 className="text-lg font-bold text-gray-900">Photos</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {clubName ? `From ${clubName}` : 'From the run'}
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5 border-b border-gray-100">
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

type CrewSectionProps = {
  sortedCrew: CityRunCheckin[];
  athleteId: string | null;
  crewExpanded: boolean;
  onToggleExpanded: () => void;
  expanded?: boolean;
  clubName?: string;
};

export function CityRunPostRunCrewSection({
  sortedCrew,
  athleteId,
  crewExpanded,
  onToggleExpanded,
  expanded = false,
  clubName,
}: CrewSectionProps) {
  const showExpanded = expanded || crewExpanded;
  const title = clubName ? `Who was at ${clubName}?` : 'Who else was here';

  if (expanded) {
    return (
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-gray-100 flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-600 shrink-0" />
          <div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {sortedCrew.length === 0
                ? 'No one checked in yet.'
                : `${sortedCrew.length} runner${sortedCrew.length === 1 ? '' : 's'} checked in`}
            </p>
          </div>
        </div>
        <ul className="divide-y divide-gray-100">
          {sortedCrew.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
              <RunnerAvatar athlete={m.Athlete} className="w-9 h-9" />
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
            {title}
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
              <RunnerAvatar athlete={m.Athlete} className="w-9 h-9" />
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
      ) : null}
    </section>
  );
}
