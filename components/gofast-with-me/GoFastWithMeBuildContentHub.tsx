"use client";

import { BookOpen, Map, PenLine, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  STUDIO_CONTENT_NAV_ORDER,
  STUDIO_ROUTES_DESCRIPTION,
  STUDIO_BIN_DESCRIPTIONS,
  type ContentEditorFocus,
  type StudioSection,
} from "@/components/gofast-with-me/studio-sections";

type Props = {
  onOpen: (section: StudioSection, focus?: ContentEditorFocus) => void;
};

const CARD_ICONS: Record<string, LucideIcon> = {
  page: UserRound,
  runnerStory: BookOpen,
  route: Map,
  reflections: PenLine,
  tip: PenLine,
};

function cardKey(section: StudioSection, focus?: ContentEditorFocus): string {
  if (section === "content") return focus ?? "tip";
  return section;
}

function cardDescription(section: StudioSection, focus?: ContentEditorFocus): string {
  if (section === "content" && focus === "route") {
    return STUDIO_ROUTES_DESCRIPTION;
  }
  return STUDIO_BIN_DESCRIPTIONS[section];
}

export default function GoFastWithMeBuildContentHub({ onOpen }: Props) {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Content builder</h1>
        <p className="mt-1 text-sm text-gray-600">
          Ways to share your story on your handle. What you build shows up on your public pages; leave
          a section empty and it stays off the site. Custom links live under{" "}
          <span className="font-medium">GoFast Links</span> in the app nav.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {STUDIO_CONTENT_NAV_ORDER.map((item) => {
          const Icon = CARD_ICONS[cardKey(item.section, item.focus)] ?? PenLine;
          return (
            <button
              key={`${item.section}-${item.focus ?? "default"}-${item.label}`}
              type="button"
              onClick={() => onOpen(item.section, item.focus)}
              className="rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50/50"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-800">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{item.label}</span>
                  </span>
                  <span className="mt-1 block text-sm text-gray-600">
                    {cardDescription(item.section, item.focus)}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
