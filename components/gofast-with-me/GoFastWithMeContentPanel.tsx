'use client';

import { BookOpen, ExternalLink, MapPin, Sparkles } from 'lucide-react';

type Props = {
  liveUrl: string;
  onOpenWorkouts?: () => void;
  onOpenCommunity?: () => void;
};

function CmsCapabilityCard({
  title,
  modelName,
  description,
  status,
}: {
  title: string;
  modelName: string;
  description: string;
  status: string;
}) {
  return (
    <article className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
      <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      <p className="text-[11px] font-mono text-gray-500 mt-1">{modelName}</p>
      <p className="text-xs text-gray-600 mt-2">{description}</p>
      <p className="mt-3 text-xs font-medium text-amber-800">{status}</p>
    </article>
  );
}

export default function GoFastWithMeCmsContentSection({
  liveUrl,
  onOpenWorkouts,
  onOpenCommunity,
}: Props) {
  return (
    <section id="content" className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Content</h2>
        <p className="text-sm text-gray-600 mt-1">
          Athlete-scoped production content owned by your Athlete ID — durable public creator
          surface, not container feed posts.
        </p>
      </div>

      <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-4 py-3 text-xs text-violet-900">
        Container feed tips (<code className="font-mono">gofast_container_messages.topic = tips</code>
        ) are separate from CMS Tips. CMS models and editor flows are coming in a follow-up pass.
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <CmsCapabilityCard
          title="Tips"
          modelName="athlete_tips"
          description="Short coaching insights and notes that appear on your public landing."
          status="Planned — athlete-scoped CMS model"
        />
        <CmsCapabilityCard
          title="myRunRoutes"
          modelName="gofast_with_me_my_run_routes"
          description="Running routes you recommend — not Next.js routes or page URLs."
          status="Planned — athlete-scoped CMS model"
        />
        <CmsCapabilityCard
          title="Blog"
          modelName="gofast_with_me_blog_posts"
          description="Longer posts to keep your landing page feeling like a live blog."
          status="Planned — athlete-scoped CMS model"
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-start gap-2">
          <Sparkles className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-gray-900">What hydrates today</h4>
            <p className="text-xs text-gray-600 mt-1">
              Your landing intro, page photo, published training plan, and hosted runs hydrate from
              real athlete-owned data — not fake CMS placeholders.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {onOpenWorkouts ? (
            <button
              type="button"
              onClick={onOpenWorkouts}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-100"
            >
              <MapPin className="h-3.5 w-3.5" />
              My Workouts
            </button>
          ) : null}
          {onOpenCommunity ? (
            <button
              type="button"
              onClick={onOpenCommunity}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-100"
            >
              <BookOpen className="h-3.5 w-3.5" />
              My Community
            </button>
          ) : null}
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700"
          >
            View public page
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
