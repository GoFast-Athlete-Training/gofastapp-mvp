'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Building2, Calendar, Megaphone } from 'lucide-react';
import { clubManagerHubPath } from '@/lib/club-manager-paths';

type ClubManagerConfirmWelcomeProps = {
  clubName: string;
  clubSlug: string;
  logoUrl?: string | null;
  confirming?: boolean;
  error?: string | null;
  onConfirm: () => void;
};

const NEXT_STEPS = [
  {
    icon: Building2,
    title: 'Club profile',
    body: 'Update how members see your club — description, logo, and socials.',
  },
  {
    icon: Calendar,
    title: 'Runs',
    body: 'Set weekly series and upcoming runs so people know when to show up.',
  },
  {
    icon: Megaphone,
    title: 'Announcements',
    body: 'Post updates once the basics are in place.',
  },
] as const;

/** First-time Club Manager gate: confirm club identity before the dashboard. */
export default function ClubManagerConfirmWelcome({
  clubName,
  clubSlug,
  logoUrl,
  confirming = false,
  error = null,
  onConfirm,
}: ClubManagerConfirmWelcomeProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <Image
            src="/logo.png"
            alt="GoFast Logo"
            width={88}
            height={88}
            className="mx-auto h-20 w-20 rounded-full object-cover shadow-xl"
            priority
          />
          <p className="mt-5 text-xs font-bold uppercase tracking-wide text-white/80">Club Manager</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Confirm this is your run club</h1>
          <p className="mt-3 text-base text-white/90">
            You&apos;re about to manage this club in GoFast. Here&apos;s what happens next.
          </p>
        </div>

        <div className="rounded-2xl bg-white shadow-xl p-6 sm:p-8">
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl border border-gray-100 bg-white object-contain p-1"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                <Building2 className="h-8 w-8" aria-hidden />
              </div>
            )}
            <div className="min-w-0 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Your club</p>
              <p className="mt-1 text-xl font-bold text-gray-900 truncate">{clubName}</p>
              <p className="text-xs text-gray-500 truncate">/{clubSlug}</p>
            </div>
          </div>

          <ul className="mt-6 space-y-4">
            {NEXT_STEPS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3 text-left">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                  <p className="mt-0.5 text-sm text-gray-600">{body}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-sm text-gray-500">
            You&apos;re still a full GoFast athlete — use Back to athlete anytime.
          </p>

          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="mt-6 w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {confirming ? 'Confirming…' : `Yes — manage ${clubName}`}
          </button>

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Link
              href={clubManagerHubPath()}
              className="inline-flex flex-1 justify-center rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Not this club
            </Link>
            <Link
              href="/athlete-home"
              className="inline-flex flex-1 justify-center rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Back to athlete
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
