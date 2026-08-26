'use client';

import { useEffect, useState } from 'react';
import { Layout, Users, X, type LucideIcon } from 'lucide-react';
import {
  STUDIO_CHROME_LABELS,
  STUDIO_VIEW_NAV_ORDER,
  STUDIO_COMMUNITY_LABEL,
  STUDIO_LANDING_LABEL,
  type StudioChromeView,
} from '@/components/gofast-with-me/studio-sections';
import {
  fetchStudioTutorial,
  STUDIO_TUTORIAL_FALLBACK,
  type StudioTutorialPayload,
} from '@/lib/gofast-with-me/studio-tutorial';

const CHROME_ICONS: Record<StudioChromeView, LucideIcon> = {
  landingView: Layout,
  communityHome: Users,
};

type Props = {
  onDismiss: () => void;
};

export default function GoFastWithMeStudioExplainer({ onDismiss }: Props) {
  const [tutorial, setTutorial] = useState<StudioTutorialPayload>(STUDIO_TUTORIAL_FALLBACK);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remote = await fetchStudioTutorial();
      if (!cancelled && remote?.steps?.length) {
        setTutorial(remote);
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-violet-800">Tutorial</p>
          <p className="mt-1 text-sm text-violet-950 leading-relaxed">
            {STUDIO_TUTORIAL_FALLBACK.summary} Earnings live in the top app bar with Home and
            Settings — not under View.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 text-violet-700 hover:bg-violet-100"
          aria-label="Dismiss tutorial"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!loaded ? (
        <p className="text-xs text-violet-700">Loading tutorial…</p>
      ) : (
        <ul className="space-y-2">
          <TutorialRow
            icon={Users}
            label="Build first"
            description="My Story, daily log, tips, routes, and runs — create content on the left."
          />
          {STUDIO_VIEW_NAV_ORDER.map((item) => {
            const Icon = CHROME_ICONS[item.view];
            const description =
              item.view === 'landingView'
                ? `${STUDIO_LANDING_LABEL} — ${item.hint}. Edit in My Story and Build.`
                : `${STUDIO_COMMUNITY_LABEL} — ${item.hint}. Invite and moderate from Manage.`;
            return (
              <TutorialRow
                key={item.view}
                icon={Icon}
                label={`Preview: ${STUDIO_CHROME_LABELS[item.view]}`}
                description={description}
              />
            );
          })}
        </ul>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function TutorialRow({
  icon: Icon,
  label,
  description,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
}) {
  return (
    <li className="flex items-start gap-2.5 rounded-lg bg-white/70 px-2.5 py-2 border border-violet-100">
      <Icon className="h-4 w-4 text-violet-700 shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-violet-950">{label}</p>
        <p className="text-[11px] text-violet-800 leading-snug mt-0.5">{description}</p>
      </div>
    </li>
  );
}
