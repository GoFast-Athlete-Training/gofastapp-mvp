"use client";

import Link from "next/link";
import { ExternalLink, Link2, Megaphone, PenLine, Route, Wallet } from "lucide-react";
import GoFastWithMeUrlEditor from "@/components/profile/GoFastWithMeUrlEditor";

type Props = {
  liveUrl: string;
  appUrl: string;
  publicSlug: string;
  gofastHandle: string;
  slugUsesHandle: boolean;
  isPublishReady: boolean;
  copyDone: boolean;
  onCopyAppUrl: () => void;
  onUrlUpdated: (slug: string, usesHandle: boolean) => void;
};

export default function GoFastWithMeStudioSidebar({
  liveUrl,
  appUrl,
  publicSlug,
  gofastHandle,
  slugUsesHandle,
  isPublishReady,
  copyDone,
  onCopyAppUrl,
  onUrlUpdated,
}: Props) {
  return (
    <aside className="w-full shrink-0 space-y-3 lg:w-72">
      <nav className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm space-y-1">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Studio
        </p>

        <div className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-900">
          <PenLine className="h-4 w-4 shrink-0" />
          Landing / identity
        </div>

        <SidebarRow
          icon={<Link2 className="h-4 w-4" />}
          title="Publish"
          subtitle={isPublishReady ? "Ready to share" : "Add welcome + bio to publish"}
          href={liveUrl}
          external
        />

        <SidebarRow
          icon={<Wallet className="h-4 w-4" />}
          title="Earnings"
          subtitle="Advertiser revenue when your page gets attention"
          href="/gofast-with-others#earnings"
        />

        <SidebarRow
          icon={<Route className="h-4 w-4" />}
          title="Runs & plans"
          subtitle="What visitors can join from your page"
          href="/gofast-with-others#runs-plans"
        />
      </nav>

      <section
        id="publish"
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Publish</h2>
            <p className="text-xs text-gray-600 mt-0.5">
              {isPublishReady
                ? "Your landing has copy — share your public page."
                : "Add landing copy, then share your public URL."}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              isPublishReady
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-900"
            }`}
          >
            {isPublishReady ? "Ready" : "Draft"}
          </span>
        </div>

        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600"
        >
          Open public page
          <ExternalLink className="h-3.5 w-3.5" />
        </a>

        <GoFastWithMeUrlEditor
          gofastHandle={gofastHandle}
          publicSlug={publicSlug}
          slugUsesHandle={slugUsesHandle}
          publicUrl={liveUrl}
          onUpdated={onUrlUpdated}
        />

        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500">In-app preview</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="text-xs text-gray-800 truncate flex-1">{appUrl}</code>
            <button
              type="button"
              onClick={onCopyAppUrl}
              className="text-xs font-medium text-orange-600 hover:text-orange-700"
            >
              {copyDone ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </section>

      <section
        id="earnings"
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div className="flex items-start gap-2">
          <Megaphone className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Earnings</h2>
            <p className="text-xs text-gray-600 mt-1">
              When people follow and engage with your public page, advertiser attention can convert
              to revenue. Details live in your profile advertising settings for now.
            </p>
          </div>
        </div>
      </section>

      <section
        id="runs-plans"
        className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 shadow-sm space-y-2"
      >
        <div className="flex items-start gap-2">
          <Route className="h-4 w-4 text-violet-700 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Runs & plans</h2>
            <p className="text-xs text-gray-600 mt-1">
              Publish these and they hydrate on your public page automatically.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <Link
            href="/training-setup"
            className="inline-flex justify-center rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
          >
            Connect training plan
          </Link>
          <Link
            href="/training/lead"
            className="inline-flex justify-center rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-900 hover:bg-violet-50"
          >
            Publish training plan
          </Link>
          <Link
            href="/build-a-run"
            className="inline-flex justify-center rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-900 hover:bg-violet-50"
          >
            Build a run
          </Link>
          <Link
            href="/host-a-run"
            className="inline-flex justify-center rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-900 hover:bg-violet-50"
          >
            Host a public run
          </Link>
        </div>
      </section>
    </aside>
  );
}

function SidebarRow({
  icon,
  title,
  subtitle,
  href,
  external,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  href: string;
  external?: boolean;
}) {
  const className =
    "flex items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-gray-50 transition-colors";

  const content = (
    <>
      <span className="mt-0.5 text-gray-500 shrink-0">{icon}</span>
      <span>
        <span className="block text-sm font-medium text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500 mt-0.5">{subtitle}</span>
      </span>
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
