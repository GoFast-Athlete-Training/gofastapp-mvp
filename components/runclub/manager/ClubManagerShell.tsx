'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Calendar,
  ExternalLink,
  LayoutDashboard,
  Megaphone,
  Users,
  type LucideIcon,
} from 'lucide-react';
import TopNav from '@/components/shared/TopNav';
import { clubManagerClubPath, clubManagerHubPath } from '@/lib/club-manager-paths';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';
import { isClubManagerClubWelcomed, parseClubManagerState } from '@/lib/club-manager-state';
import ClubManagerConfirmWelcome from '@/components/runclub/manager/ClubManagerConfirmWelcome';

export type ClubManagerNavSection =
  | 'overview'
  | 'content'
  | 'runs'
  | 'announcements';

interface ClubManagerShellProps {
  clubName: string;
  clubSlug: string;
  logoUrl?: string | null;
  active: ClubManagerNavSection;
  children: React.ReactNode;
}

const NAV_ITEMS: {
  id: ClubManagerNavSection;
  label: string;
  href: (slug: string) => string;
  icon: LucideIcon;
}[] = [
  { id: 'overview', label: 'Manager home', href: (s) => clubManagerClubPath(s), icon: LayoutDashboard },
  { id: 'content', label: 'Club profile', href: (s) => clubManagerClubPath(s, 'content'), icon: Building2 },
  { id: 'runs', label: 'Runs', href: (s) => clubManagerClubPath(s, 'runs'), icon: Calendar },
  {
    id: 'announcements',
    label: 'Announcements',
    href: (s) => clubManagerClubPath(s, 'announcements'),
    icon: Megaphone,
  },
];

type WelcomeGateState = 'loading' | 'needs_ack' | 'ready';

export default function ClubManagerShell({
  clubName,
  clubSlug,
  logoUrl,
  active,
  children,
}: ClubManagerShellProps) {
  const [welcomeGate, setWelcomeGate] = useState<WelcomeGateState>('loading');
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWelcomeState() {
      const athleteId = LocalStorageAPI.getAthleteId();
      if (!athleteId) {
        if (!cancelled) setWelcomeGate('needs_ack');
        return;
      }

      try {
        const prof = await api.get(`/athlete/${athleteId}`);
        const athlete = prof.data?.athlete;
        const clubs = athlete?.leaderContext?.clubs ?? [];
        const club = clubs.find(
          (c: { runClubSlug?: string | null; runClubId: string }) =>
            (c.runClubSlug ?? c.runClubId) === clubSlug
        );

        if (!club) {
          if (!cancelled) setWelcomeGate('ready');
          return;
        }

        const state = parseClubManagerState(athlete?.clubManagerState);
        if (!cancelled) {
          setWelcomeGate(
            isClubManagerClubWelcomed(state, club.runClubId) ? 'ready' : 'needs_ack'
          );
        }
      } catch {
        if (!cancelled) setWelcomeGate('needs_ack');
      }
    }

    void loadWelcomeState();
    return () => {
      cancelled = true;
    };
  }, [clubSlug]);

  const handleConfirm = useCallback(async () => {
    if (confirming) return;

    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await api.post('/me/club-manager-welcome');
      if (!res.data?.success) {
        throw new Error(res.data?.error ?? 'Could not confirm club manager access');
      }
      setWelcomeGate('ready');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Could not confirm club manager access');
      setConfirmError(message);
    } finally {
      setConfirming(false);
    }
  }, [confirming]);

  if (welcomeGate === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (welcomeGate === 'needs_ack') {
    return (
      <ClubManagerConfirmWelcome
        clubName={clubName}
        clubSlug={clubSlug}
        logoUrl={logoUrl}
        confirming={confirming}
        error={confirmError}
        onConfirm={() => void handleConfirm()}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden md:flex-row">
        <aside className="w-full bg-white border-b-2 border-gray-200 flex flex-col shrink-0 md:w-64 md:border-b-0 md:border-r-2 md:overflow-y-auto">
          <div className="px-4 pt-4 pb-2 md:p-4 md:border-b md:border-gray-200">
            <p className="text-lg font-bold text-gray-900">Club Manager</p>
            <p className="text-xs text-gray-500 mt-1 truncate" title={clubName}>
              {clubName}
            </p>
          </div>

          <nav className="p-2 md:flex-1 md:space-y-1" aria-label="Club Manager">
            <Link
              href="/athlete-home"
              className="mb-2 flex w-max items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 md:w-full"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back to athlete
            </Link>

            <p className="hidden px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 md:block">
              Manage
            </p>

            <div className="flex gap-2 overflow-x-auto pb-1 md:block md:space-y-1 md:overflow-visible md:pb-0">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.id;
                return (
                  <Link
                    key={item.id}
                    href={item.href(clubSlug)}
                    className={navButtonClass(isActive)}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <p className="hidden px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 md:block">
              Member hub
            </p>

            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 md:mt-0 md:block md:space-y-1 md:overflow-visible md:pb-0">
              <Link
                href={`/runclub/${clubSlug}`}
                className={secondaryNavClass()}
              >
                <Users className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">View member hub</span>
                <ExternalLink className="h-3.5 w-3.5 ml-auto shrink-0 text-gray-400 hidden md:block" aria-hidden />
              </Link>

              <Link href={clubManagerHubPath()} className={secondaryNavClass()}>
                <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">All clubs</span>
              </Link>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function navButtonClass(active: boolean): string {
  return `flex min-w-max items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors md:w-full ${
    active
      ? 'bg-orange-50 text-orange-800 border border-orange-200'
      : 'text-gray-700 hover:bg-gray-100 border border-transparent'
  }`;
}

function secondaryNavClass(): string {
  return 'flex min-w-max items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-transparent md:w-full';
}
