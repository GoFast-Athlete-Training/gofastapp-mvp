'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, LayoutDashboard, MapPin, Trophy, Heart, Users, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  match: (pathname: string | null) => boolean;
};

function planHubMatch(p: string | null): boolean {
  if (!p) return false;
  return (
    p === '/training' ||
    p.startsWith('/training/') ||
    p.startsWith('/training-setup') ||
    p.startsWith('/build-a-run')
  );
}

function gorunMatch(p: string | null): boolean {
  return !!p && (p === '/gorun' || p.startsWith('/gorun/') || p === '/host-a-run');
}

function racesMatch(p: string | null): boolean {
  return (
    !!p && (p === '/races' || p.startsWith('/races/') || p.startsWith('/myrace/'))
  );
}

function healthHubMatch(p: string | null): boolean {
  return !!p && (p === '/health' || p.startsWith('/health/'));
}

function performanceHubMatch(p: string | null): boolean {
  return !!p && (p === '/performance' || p.startsWith('/performance/'));
}

function goFastWithOthersMatch(p: string | null): boolean {
  return !!p && (p === '/gofast-with-others' || p.startsWith('/gofast-with-others/'));
}

const primaryTabs: NavItem[] = [
  { id: 'train', label: 'Train', href: '/training', icon: LayoutDashboard, match: planHubMatch },
  { id: 'run', label: 'Run', href: '/gorun', icon: MapPin, match: gorunMatch },
  { id: 'races', label: 'Races', href: '/races', icon: Trophy, match: racesMatch },
  { id: 'health', label: 'Health', href: '/health', icon: Heart, match: healthHubMatch },
];

const moreItems: NavItem[] = [
  {
    id: 'performance',
    label: 'Performance',
    href: '/performance',
    icon: Activity,
    match: performanceHubMatch,
  },
  {
    id: 'gwm',
    label: 'GoFast With Me',
    href: '/gofast-with-others',
    icon: Users,
    match: goFastWithOthersMatch,
  },
];

/**
 * Mobile bottom nav for athlete app chrome.
 * Desktop keeps AthleteSidebar; this is lg:hidden only.
 */
export default function AthleteMobileNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = moreItems.some((item) => item.match(pathname));

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const go = (href: string) => {
    setMoreOpen(false);
    router.push(href);
  };

  return (
    <div className="lg:hidden">
      {moreOpen ? (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-[calc(4.25rem+env(safe-area-inset-bottom))] left-3 right-3 rounded-2xl border border-gray-200 bg-white shadow-xl p-3 space-y-1">
            <div className="flex items-center justify-between px-2 pb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">More</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {moreItems.map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.href)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                    active
                      ? item.id === 'gwm'
                        ? 'bg-sky-100 text-sky-900 border border-sky-300'
                        : 'bg-orange-50 text-orange-700 border border-orange-200'
                      : item.id === 'gwm'
                        ? 'text-gray-800 hover:bg-gray-50 border border-transparent'
                        : 'text-gray-800 hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90"
        aria-label="Primary mobile"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1">
          {primaryTabs.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.href)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] font-semibold transition-colors ${
                  active
                    ? 'text-orange-600 bg-orange-50'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-orange-600' : 'text-gray-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-current={moreActive ? 'page' : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] font-semibold transition-colors ${
              moreOpen || moreActive
                ? 'text-orange-600 bg-orange-50'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Users
              className={`h-5 w-5 ${moreOpen || moreActive ? 'text-orange-600' : 'text-gray-400'}`}
            />
            <span className="truncate">More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

/** Bottom padding so page content clears the fixed mobile nav. */
export const ATHLETE_MOBILE_NAV_CONTENT_PAD = 'pb-24 lg:pb-0';
