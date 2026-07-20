'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Globe, Users } from 'lucide-react';
import GoFastWithMeLandingForm, {
  type GoFastWithMeLandingValues,
} from '@/components/gofast-with-me/GoFastWithMeLandingForm';

type PublicModuleSnapshot = {
  publishedPlans: { slug: string; title: string }[];
  upcomingRuns: { id: string; title: string; gorunPath: string }[];
  isGoFastContainer: boolean;
};

type Props = {
  publicSlug: string;
  liveUrl: string;
  appUrl: string;
  landingValues: GoFastWithMeLandingValues;
  profileBio: string | null;
  onSaved: (values: GoFastWithMeLandingValues) => void;
};

function ModuleStub({
  title,
  status,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  status: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <article className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      <p className="text-xs text-gray-600 mt-1">{status}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={primaryHref}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
        >
          {primaryLabel}
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export default function GoFastWithMeContentPanel({
  publicSlug,
  liveUrl,
  appUrl,
  landingValues,
  profileBio,
  onSaved,
}: Props) {
  const [modules, setModules] = useState<PublicModuleSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/athlete/public/${encodeURIComponent(publicSlug)}`);
        const data = await res.json();
        if (!cancelled && res.ok && data.success) {
          setModules({
            publishedPlans: data.publishedPlans ?? [],
            upcomingRuns: data.upcomingRuns ?? [],
            isGoFastContainer: !!data.isGoFastContainer,
          });
        }
      } catch {
        /* optional snapshot */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicSlug]);

  const firstPlan = modules?.publishedPlans?.[0];
  const firstRun = modules?.upcomingRuns?.[0];

  return (
    <section id="content" className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">General content</h2>
        <p className="text-sm text-gray-600 mt-1">
          Edit your public landing identity and see how modules appear on your public page and member
          hub.
        </p>
      </div>

      <GoFastWithMeLandingForm
        initial={landingValues}
        profileBio={profileBio}
        onSaved={onSaved}
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-start gap-2">
          <Globe className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Public module stubs</h3>
            <p className="text-xs text-gray-600 mt-1">
              These hydrate from real data — setup lives in the Setup area.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ModuleStub
            title="Public page"
            status="Landing intro + hero from the form above"
            primaryHref={appUrl}
            primaryLabel="View in app"
            secondaryHref={liveUrl}
            secondaryLabel="Live page"
          />

          <ModuleStub
            title="Training plan"
            status={
              firstPlan
                ? `${firstPlan.title} is live on your public page`
                : 'No published plan yet'
            }
            primaryHref={firstPlan ? `/plans/${encodeURIComponent(firstPlan.slug)}` : '/training/lead'}
            primaryLabel={firstPlan ? 'View public plan' : 'Publish plan'}
            secondaryHref="/gofast-with-others#setup"
            secondaryLabel="Go to setup"
          />

          <ModuleStub
            title="Public runs"
            status={
              modules?.upcomingRuns?.length
                ? `${modules.upcomingRuns.length} upcoming hosted run${modules.upcomingRuns.length === 1 ? '' : 's'}`
                : 'No upcoming public runs'
            }
            primaryHref={
              firstRun
                ? firstRun.gorunPath.startsWith('/')
                  ? firstRun.gorunPath
                  : `/${firstRun.gorunPath}`
                : '/host-a-run'
            }
            primaryLabel={firstRun ? 'View next run' : 'Host a run'}
            secondaryHref="/gofast-with-others#setup"
            secondaryLabel="Go to setup"
          />

          <article className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-gray-900">Follow & member hub</h4>
                <p className="text-xs text-gray-600 mt-1">
                  {modules?.isGoFastContainer
                    ? 'Followers can join your member hub after following'
                    : 'Follow surface enables when someone follows you'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/follow/${encodeURIComponent(publicSlug)}`}
                    className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
                  >
                    Follow explainer
                  </Link>
                  <Link
                    href={`/container/${encodeURIComponent(publicSlug)}`}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Member hub
                  </Link>
                </div>
              </div>
            </div>
          </article>
        </div>

        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700"
        >
          Preview full public page
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </section>
  );
}
