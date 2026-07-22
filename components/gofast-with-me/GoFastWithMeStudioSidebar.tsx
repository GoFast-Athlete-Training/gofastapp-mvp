"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  Lock,
  PenLine,
  Settings,
  Users,
} from "lucide-react";
import GoFastWithMeUrlEditor from "@/components/profile/GoFastWithMeUrlEditor";
import {
  STUDIO_SECTION_LABELS,
  STUDIO_SIDEBAR_SECTIONS,
  type StudioSection,
} from "@/components/gofast-with-me/studio-sections";

type Props = {
  activeSection: StudioSection;
  onSectionChange: (section: StudioSection) => void;
  isWelcomeComplete: boolean;
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

const SECTION_ICONS: Record<StudioSection, React.ReactNode> = {
  welcome: <PenLine className="h-4 w-4" />,
  configure: <Settings className="h-4 w-4" />,
  content: <PenLine className="h-4 w-4" />,
  manage: <Users className="h-4 w-4" />,
};

export default function GoFastWithMeStudioSidebar({
  activeSection,
  onSectionChange,
  isWelcomeComplete,
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
  const memberHubPath = `/container/${encodeURIComponent(publicSlug)}`;
  const displaySection = activeSection === "content" ? "welcome" : activeSection;

  return (
    <aside className="w-full shrink-0 space-y-3 lg:w-72">
      <nav className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm space-y-1">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Studio
        </p>

        {!isWelcomeComplete ? (
          <p className="px-2 pb-2 text-xs text-amber-800">
            Finish your GoFastWithMe CMS to unlock plan and member tools.
          </p>
        ) : null}

        {STUDIO_SIDEBAR_SECTIONS.map((section) => {
          const locked = section !== "welcome" && !isWelcomeComplete;
          return (
            <NavButton
              key={section}
              active={displaySection === section}
              icon={SECTION_ICONS[section]}
              label={STUDIO_SECTION_LABELS[section]}
              complete={section === "welcome" ? isWelcomeComplete : undefined}
              needed={section === "welcome" && !isWelcomeComplete}
              locked={locked}
              onClick={() => onSectionChange(section)}
            />
          );
        })}
      </nav>

      <section
        id="publish"
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Your surfaces</h2>
            <p className="text-xs text-gray-600 mt-0.5">
              {isPublishReady
                ? "Public landing is the door; the container is where followers engage."
                : "Finish your landing page, then share your public URL."}
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
          View public page
          <ExternalLink className="h-3.5 w-3.5" />
        </a>

        <Link
          href={memberHubPath}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100"
        >
          View as member
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>

        <button
          type="button"
          onClick={() => onSectionChange("manage")}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
        >
          View as manager
        </button>

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
    </aside>
  );
}

function NavButton({
  active,
  icon,
  label,
  complete,
  needed,
  locked,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  complete?: boolean;
  needed?: boolean;
  locked?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={locked}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-left transition ${
        locked
          ? "cursor-not-allowed text-gray-400"
          : active
            ? "bg-orange-50 text-orange-900 font-semibold"
            : "text-gray-700 hover:bg-gray-50"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">{label}</span>
      {locked ? (
        <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-label="Locked" />
      ) : complete ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Complete" />
      ) : needed ? (
        <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-900">
          Needed
        </span>
      ) : null}
    </button>
  );
}
