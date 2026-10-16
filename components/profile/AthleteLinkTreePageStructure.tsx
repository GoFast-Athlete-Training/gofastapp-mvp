"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import api from "@/lib/api";
import type { AthleteLinkTreeDetail, AthleteLinkTreeLink } from "@/lib/content/athlete-link-tree-types";
import { buildLinkTreeEditorBlocks } from "@/lib/athlete-link-tree/link-tree-blocks";
import { useDebouncedSave, type SaveStatus } from "@/lib/athlete-link-tree/use-debounced-save";
import { AthleteLinkTreeLinkKind } from "@prisma/client";

const EMOJI_PRESETS = ["🌐", "📱", "🏃", "👟", "🔗", "📍"] as const;

type Props = {
  sortedLinks: AthleteLinkTreeLink[];
  reorderBusy: boolean;
  onMove: (id: string, dir: -1 | 1) => void;
  onUpdated: (tree: AthleteLinkTreeDetail) => void;
  onRowSaveStatus: (status: SaveStatus) => void;
  onAddSection: (name: string) => Promise<void>;
  addingSection: boolean;
};

function CompactLinkRow({
  link,
  index,
  count,
  reorderBusy,
  onMove,
  onUpdated,
  onRowSaveStatus,
  indent,
}: {
  link: AthleteLinkTreeLink;
  index: number;
  count: number;
  reorderBusy: boolean;
  onMove: (id: string, dir: -1 | 1) => void;
  onUpdated: (tree: AthleteLinkTreeDetail) => void;
  onRowSaveStatus: (status: SaveStatus) => void;
  indent?: boolean;
}) {
  const isLegacyRaces = !link.isSection && link.kind === AthleteLinkTreeLinkKind.RACES;
  const isGeneratedRace = !link.isSection && link.kind === AthleteLinkTreeLinkKind.ATHLETE_RACE;
  const readOnly = isGeneratedRace;

  const [buttonTitle, setButtonTitle] = useState(link.publicLabel?.trim() || link.name.trim());
  const [sectionTitle, setSectionTitle] = useState(link.name);
  const [url, setUrl] = useState(link.url ?? "");
  const [emoji, setEmoji] = useState(link.emoji ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setButtonTitle(link.publicLabel?.trim() || link.name.trim());
    setSectionTitle(link.name);
    setUrl(link.url ?? "");
    setEmoji(link.emoji ?? "");
  }, [link.id, link.name, link.publicLabel, link.url, link.emoji]);

  const { status, schedule, saveOnBlur, retry } = useDebouncedSave(async () => {
    if (readOnly) return;
    if (link.isSection) {
      const title = sectionTitle.trim();
      if (!title) throw new Error("empty");
      const res = await api.patch(`/athlete/links/items/${link.id}`, {
        name: title,
        publicLabel: title,
      });
      if (!res.data?.success || !res.data?.tree) throw new Error("fail");
      onUpdated(res.data.tree);
      return;
    }
    const title = buttonTitle.trim();
    if (!title) throw new Error("empty");
    const payload: Record<string, unknown> = {
      name: title,
      publicLabel: title,
      emoji: emoji.trim() || null,
    };
    if (!isLegacyRaces) payload.url = url.trim();
    const res = await api.patch(`/athlete/links/items/${link.id}`, payload);
    if (!res.data?.success || !res.data?.tree) throw new Error("fail");
    onUpdated(res.data.tree);
  });

  useEffect(() => {
    onRowSaveStatus(status);
  }, [status, onRowSaveStatus]);

  async function remove() {
    if (!window.confirm("Remove this from your page?")) return;
    setBusy(true);
    try {
      const res = await api.delete(`/athlete/links/items/${link.id}`);
      if (res.data?.success && res.data?.tree) onUpdated(res.data.tree);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className={`flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-2 py-2 ${indent ? "ml-4 border-l-2 border-l-sky-100" : ""}`}
    >
      <div className="flex shrink-0 flex-col gap-0.5 pt-1">
        <button
          type="button"
          disabled={index === 0 || busy || reorderBusy}
          onClick={() => onMove(link.id, -1)}
          className="rounded p-0.5 hover:bg-gray-100 disabled:opacity-30"
          aria-label="Move up"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={index >= count - 1 || busy || reorderBusy}
          onClick={() => onMove(link.id, 1)}
          className="rounded p-0.5 hover:bg-gray-100 disabled:opacity-30"
          aria-label="Move down"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        {link.isSection ? (
          <input
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-semibold"
            value={sectionTitle}
            onChange={(e) => {
              setSectionTitle(e.target.value);
              schedule();
            }}
            onBlur={saveOnBlur}
            placeholder="Section heading"
          />
        ) : readOnly ? (
          <div>
            <p className="text-sm font-medium text-gray-900">{link.name}</p>
            {link.url ? <p className="truncate text-xs text-gray-500">{link.url}</p> : null}
            <p className="text-[11px] text-gray-400">Toggle in Add → Races</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex gap-0.5">
                {EMOJI_PRESETS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      setEmoji(e);
                      schedule();
                    }}
                    className={`rounded px-1 py-0.5 text-base ${emoji === e ? "ring-1 ring-orange-400" : ""}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <input
                className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                value={buttonTitle}
                onChange={(e) => {
                  setButtonTitle(e.target.value);
                  schedule();
                }}
                onBlur={saveOnBlur}
                placeholder="Button title"
              />
            </div>
            {!isLegacyRaces ? (
              <input
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-800"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  schedule();
                }}
                onBlur={saveOnBlur}
                placeholder="https://"
              />
            ) : null}
          </>
        )}
        {status === "error" ? (
          <button type="button" onClick={() => void retry()} className="text-xs text-red-600 hover:underline">
            Couldn&apos;t save — retry
          </button>
        ) : null}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void remove()}
        className="shrink-0 rounded p-1.5 text-red-600 hover:bg-red-50"
        aria-label="Remove"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

export function AthleteLinkTreePageStructure({
  sortedLinks,
  reorderBusy,
  onMove,
  onUpdated,
  onRowSaveStatus,
  onAddSection,
  addingSection,
}: Props) {
  const blocks = buildLinkTreeEditorBlocks(sortedLinks);
  const [sectionName, setSectionName] = useState("");
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-semibold text-gray-900">Your page</h2>
        <p className="text-xs text-gray-500">Order matches gofastlinks — edits save automatically.</p>
      </div>

      {blocks.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing yet — add a section or link from the left.</p>
      ) : (
        <ul className="space-y-2">
          {blocks.map((block) => {
            if (block.type === "section") {
              const sectionIndex = sortedLinks.findIndex((l) => l.id === block.section.id);
              return (
                <li key={block.section.id} className="space-y-1">
                  <CompactLinkRow
                    link={block.section}
                    index={sectionIndex}
                    count={sortedLinks.length}
                    reorderBusy={reorderBusy}
                    onMove={onMove}
                    onUpdated={onUpdated}
                    onRowSaveStatus={onRowSaveStatus}
                  />
                  {block.children.length > 0 ? (
                    <ul className="space-y-1">
                      {block.children.map((child) => {
                        const childIndex = sortedLinks.findIndex((l) => l.id === child.id);
                        return (
                          <CompactLinkRow
                            key={child.id}
                            link={child}
                            index={childIndex}
                            count={sortedLinks.length}
                            reorderBusy={reorderBusy}
                            onMove={onMove}
                            onUpdated={onUpdated}
                            onRowSaveStatus={onRowSaveStatus}
                            indent
                          />
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            }
            const rootIndex = sortedLinks.findIndex((l) => l.id === block.link.id);
            return (
              <CompactLinkRow
                key={block.link.id}
                link={block.link}
                index={rootIndex}
                count={sortedLinks.length}
                reorderBusy={reorderBusy}
                onMove={onMove}
                onUpdated={onUpdated}
                onRowSaveStatus={onRowSaveStatus}
              />
            );
          })}
        </ul>
      )}

      <form
        className="flex gap-2 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          const name = sectionName.trim();
          if (!name) return;
          void onAddSection(name).then(() => setSectionName(""));
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={sectionName}
          onChange={(e) => setSectionName(e.target.value)}
          placeholder="New section heading"
        />
        <button
          type="submit"
          disabled={addingSection || !sectionName.trim()}
          className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
        >
          {addingSection ? "…" : "Add"}
        </button>
      </form>
    </div>
  );
}
