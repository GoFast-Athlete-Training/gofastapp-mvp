'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Calendar, MapPin, Target, Timer, User, Flag } from 'lucide-react';
import type { DiscoverRunnerCard } from '@/lib/find-runners-types';

function formatRunWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function raceDistanceLabel(
  distanceLabel: string | null | undefined,
  distanceMeters: number | null | undefined
): string | null {
  if (distanceLabel?.trim()) return distanceLabel.trim();
  if (distanceMeters != null && distanceMeters > 0) {
    return `${(distanceMeters / 1609.344).toFixed(1)} mi`;
  }
  return null;
}

type Props = {
  runner: DiscoverRunnerCard;
};

export default function RunnerCard({ runner }: Props) {
  const displayName =
    [runner.firstName, runner.lastName].filter(Boolean).join(' ') || `@${runner.gofastHandle}`;
  const location =
    runner.city && runner.state
      ? `${runner.city}, ${runner.state}`
      : runner.city || runner.state || null;
  const dist = runner.race
    ? raceDistanceLabel(runner.race.distanceLabel, runner.race.distanceMeters)
    : null;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all border border-gray-100 flex flex-col">
      <div className="p-6 bg-gradient-to-br from-orange-50 to-orange-100">
        <div className="flex items-start gap-4">
          {runner.photoURL ? (
            <Image
              src={runner.photoURL}
              alt=""
              width={64}
              height={64}
              className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md shrink-0"
              unoptimized
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center text-2xl text-white border-2 border-white shadow-md shrink-0">
              <User className="w-8 h-8" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-gray-900 truncate">{displayName}</h3>
            <p className="text-orange-700 font-medium text-sm">@{runner.gofastHandle}</p>
            {location && (
              <p className="text-gray-600 text-sm mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{location}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 space-y-3 flex-1 flex flex-col">
        {runner.race && (
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
              <Flag className="w-3.5 h-3.5" />
              Goal race
            </div>
            <p className="text-gray-900 font-semibold">{runner.race.name}</p>
            {dist && <p className="text-sm text-gray-600">{dist}</p>}
          </div>
        )}

        {runner.goalTime && (
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <Timer className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs text-gray-500 block">Race goal</span>
              <span className="font-medium">{runner.goalTime}</span>
            </div>
          </div>
        )}

        {runner.fiveKPace && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Target className="w-4 h-4 text-gray-400 shrink-0" />
            <div>
              <span className="text-xs text-gray-500 block">Current 5K</span>
              <span className="font-medium">{runner.fiveKPace}</span>
            </div>
          </div>
        )}

        {!runner.race && !runner.goalTime && !runner.fiveKPace && (
          <p className="text-sm text-gray-500">Training on GoFast — add a goal race on your profile.</p>
        )}

        {runner.nextRun && (
          <div className="pt-3 mt-auto border-t border-gray-200">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              <Calendar className="w-3.5 h-3.5" />
              Next run
            </div>
            <p className="font-semibold text-gray-900">{runner.nextRun.title}</p>
            <p className="text-sm text-gray-600 mt-0.5">{formatRunWhen(runner.nextRun.date)}</p>
            <p className="text-sm text-gray-600 flex items-start gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {runner.nextRun.meetUpPoint}
                {runner.nextRun.gofastCity ? ` · ${runner.nextRun.gofastCity}` : ''}
              </span>
            </p>
            <Link
              href={runner.nextRun.gorunPath}
              className="mt-3 inline-flex w-full items-center justify-center px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition"
            >
              Join this run
            </Link>
          </div>
        )}

        <div className="pt-2">
          <Link
            href={`/u/${encodeURIComponent(runner.gofastHandle)}`}
            className="text-sm text-orange-600 hover:text-orange-700 font-medium"
          >
            View profile
          </Link>
        </div>
      </div>
    </div>
  );
}
