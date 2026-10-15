"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, Copy, ExternalLink, Save, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { athleteLinksPublicUrl } from "@/lib/content/athlete-links-public-url";
import type { AthleteLinkTreeDetail, AthleteLinkTreeLink } from "@/lib/content/athlete-link-tree-types";
import { AthleteLinkTreeLinkKind } from "@prisma/client";
import { AthleteLinkTreeLinkSources } from "@/components/profile/AthleteLinkTreeLinkSources";

const EMOJI_PRESETS = ["🌐", "📱", "🏃", "👟", "🔗", "📍"] as const;

export function AthleteLinkTreeEditor() {
  const [tree, setTree] = useState<AthleteLinkTreeDetail | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [publicSlug, setPublicSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [treeBusy, setTreeBusy] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");

  const [adding, setAdding] = useState(false);
  const [sectionHeading, setSectionHeading] = useState("");
  const [addingSection, setAddingSection] = useState(false);

  const shareUrl = handle ? athleteLinksPublicUrl(handle) : "";

  const sortedLinks = useMemo(
    () => (tree ? tree.links.slice().sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [tree],
  );

  const hasRacesCard = useMemo(
    () =>
      sortedLinks.some(
        (link) => !link.isSection && link.kind === AthleteLinkTreeLinkKind.RACES,
      ),
    [sortedLinks],
  );

  const hydrate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/athlete/links");
      if (!res.data?.success || !res.data?.tree) {
        throw new Error(res.data?.error || "Failed to load");
      }
      const next = res.data.tree as AthleteLinkTreeDetail;
      const dn =
        typeof res.data.displayName === "string" && res.data.displayName.trim()
          ? res.data.displayName.trim()
          : next.name;
      setTree(next);
      setHandle(typeof res.data.handle === "string" ? res.data.handle : null);
      setDisplayName(dn);
      setPublicSlug(
        typeof res.data.publicSlug === "string" && res.data.publicSlug.trim()
          ? res.data.publicSlug.trim()
          : typeof res.data.handle === "string"
            ? res.data.handle
            : "",
      );
      setTitle(next.publicLabel?.trim() || dn);
      setSubtitle(next.publicDescription ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load link page");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  async function saveTreeMeta() {
    if (!tree) return;
    setTreeBusy(true);
    setError(null);
    const trimmedTitle = title.trim() || displayName;
    try {
      const res = await api.patch("/athlete/links", {
        publicLabel: trimmedTitle,
        publicDescription: subtitle.trim() || null,
      });
      if (!res.data?.success || !res.data?.tree) {
        throw new Error(res.data?.error || "Failed to save");
      }
      setTree(res.data.tree);
      setTitle(res.data.tree.publicLabel?.trim() || trimmedTitle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setTreeBusy(false);
    }
  }

  async function addLink(payload: Record<string, unknown>) {
    setAdding(true);
    setError(null);
    try {
      const res = await api.post("/athlete/links/items", payload);
      if (!res.data?.success || !res.data?.tree) {
        throw new Error(res.data?.error || "Failed to add");
      }
      setTree(res.data.tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  }

  async function moveLink(linkId: string, direction: -1 | 1) {
    if (reorderBusy) return;
    setReorderBusy(true);
    setError(null);
    try {
      const res = await api.post("/athlete/links/items/reorder", { linkId, direction });
      if (!res.data?.success || !res.data?.tree) {
        throw new Error(res.data?.error || "Failed to reorder");
      }
      setTree(res.data.tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder");
    } finally {
      setReorderBusy(false);
    }
  }

  async function copyShare() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setError("Could not copy link");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (error && !tree) {
    return (
      <div className="max-w-lg space-y-4">
        <p className="text-red-700">{error}</p>
        {error.includes("handle") ? (
          <Link href="/athlete-edit-profile" className="font-medium text-sky-700 hover:underline">
            Edit profile to set your handle
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => void hydrate()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!tree) return null;

  const handleSlug = handle?.trim().replace(/^@+/, "").toLowerCase() ?? "";

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">GoFast Links</h1>
          {handleSlug ? (
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-900">
              gofastlinks /{handleSlug}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Your personal link page — title, subtitle, and buttons people tap.
        </p>
        {shareUrl ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline break-all"
            >
              {shareUrl}
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
            <button
              type="button"
              onClick={() => void copyShare()}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50"
            >
              {shareCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {shareCopied ? "Copied" : "Copy link"}
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <section className="rounded-xl border border-sky-100 bg-sky-50/40 p-5 space-y-4 ring-1 ring-sky-100">
        <div>
          <h2 className="font-semibold text-gray-900">Page header</h2>
          <p className="mt-1 text-sm text-gray-600">
            What people see at the top of gofastlinks — your photo comes from profile; set the title
            and subtitle here.
          </p>
        </div>
        <label className="block text-sm">
          <span className="font-medium">Title</span>
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Subtitle</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            rows={2}
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Short line under your name"
          />
        </label>
        <button
          type="button"
          disabled={treeBusy || !title.trim()}
          onClick={() => void saveTreeMeta()}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {treeBusy ? "Saving…" : "Save header"}
        </button>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-gray-900">Links on your page</h2>
        <p className="text-sm text-gray-600 -mt-2">
          Reorder buttons and section headings below. Headings like &ldquo;About me&rdquo; are yours
          to name — add them separately from link cards.
        </p>
        {sortedLinks.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing here yet — add something below.</p>
        ) : (
          <ul className="space-y-4">
            {sortedLinks.map((link, index) => (
              <LinkRow
                key={link.id}
                link={link}
                index={index}
                count={sortedLinks.length}
                reorderBusy={reorderBusy}
                onMove={moveLink}
                onUpdated={(next) => setTree(next)}
              />
            ))}
          </ul>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-gray-900">Section heading</h3>
            <p className="mt-1 text-xs text-gray-500">
              Labels that group your buttons on the public page — not links themselves.
            </p>
          </div>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              const heading = sectionHeading.trim();
              if (!heading) return;
              setAddingSection(true);
              void addLink({ name: heading, isSection: true })
                .then(() => setSectionHeading(""))
                .finally(() => setAddingSection(false));
            }}
          >
            <label className="block flex-1 text-sm">
              <span className="sr-only">Section heading</span>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={sectionHeading}
                onChange={(e) => setSectionHeading(e.target.value)}
                placeholder="e.g. About me"
              />
            </label>
            <button
              type="submit"
              disabled={addingSection || adding || !sectionHeading.trim()}
              className="shrink-0 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {addingSection ? "Adding…" : "Add heading"}
            </button>
          </form>
        </div>

        {publicSlug ? (
          <AthleteLinkTreeLinkSources
            publicSlug={publicSlug}
            sortedLinks={sortedLinks}
            hasRacesCard={hasRacesCard}
            adding={adding}
            onAddLink={addLink}
          />
        ) : null}
      </section>
    </div>
  );
}

function LinkRow({
  link,
  index,
  count,
  reorderBusy,
  onMove,
  onUpdated,
}: {
  link: AthleteLinkTreeLink;
  index: number;
  count: number;
  reorderBusy: boolean;
  onMove: (id: string, dir: -1 | 1) => void;
  onUpdated: (tree: AthleteLinkTreeDetail) => void;
}) {
  const isRacesCard = !link.isSection && link.kind === AthleteLinkTreeLinkKind.RACES;
  const initialTitle =
    link.publicLabel?.trim() || link.name.trim() || (isRacesCard ? "My races" : "");

  const [buttonTitle, setButtonTitle] = useState(initialTitle);
  const [sectionTitle, setSectionTitle] = useState(link.name);
  const [url, setUrl] = useState(link.url ?? "");
  const [emoji, setEmoji] = useState(link.emoji ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      if (link.isSection) {
        const title = sectionTitle.trim();
        if (!title) return;
        const res = await api.patch(`/athlete/links/items/${link.id}`, {
          name: title,
          publicLabel: title,
        });
        if (res.data?.success && res.data?.tree) onUpdated(res.data.tree);
        return;
      }

      const title = buttonTitle.trim();
      if (!title) return;

      const payload: Record<string, unknown> = {
        name: title,
        publicLabel: title,
        emoji: emoji.trim() || null,
      };

      if (isRacesCard) {
        payload.publicLabel = title;
      } else {
        payload.url = url.trim();
      }

      const res = await api.patch(`/athlete/links/items/${link.id}`, payload);
      if (res.data?.success && res.data?.tree) onUpdated(res.data.tree);
    } finally {
      setBusy(false);
    }
  }

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

  const rowLabel = link.isSection
    ? sectionTitle.trim() || "Section"
    : buttonTitle.trim() || (isRacesCard ? "Races" : `Link ${index + 1}`);

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 truncate">
          {link.isSection ? "Section heading" : "Link"}
          {" · "}
          {rowLabel}
          {isRacesCard ? (
            <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800 normal-case">
              GoFast
            </span>
          ) : null}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={index === 0 || busy || reorderBusy}
            onClick={() => onMove(link.id, -1)}
            className="rounded p-1 hover:bg-gray-100 disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={index >= count - 1 || busy || reorderBusy}
            onClick={() => onMove(link.id, 1)}
            className="rounded p-1 hover:bg-gray-100 disabled:opacity-40"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button type="button" disabled={busy} onClick={() => void remove()} className="rounded p-1 text-red-600">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {link.isSection ? (
        <label className="block text-sm">
          <span className="font-medium">Section heading</span>
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={sectionTitle}
            onChange={(e) => setSectionTitle(e.target.value)}
          />
        </label>
      ) : (
        <>
          {isRacesCard ? (
            <p className="text-sm text-gray-600">
              Shows your upcoming claimed races — each gets its own button on your public page.
            </p>
          ) : null}
          <label className="block text-sm">
            <span className="font-medium">{isRacesCard ? "Section heading" : "Button title"}</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={buttonTitle}
              onChange={(e) => setButtonTitle(e.target.value)}
            />
          </label>
          {!isRacesCard ? (
            <>
              <div>
                <span className="text-sm font-medium">Emoji</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {EMOJI_PRESETS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={`rounded-lg px-2 py-1 text-lg ${emoji === e ? "ring-2 ring-orange-400" : "bg-gray-50"}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-sm">
                <span className="font-medium">URL</span>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://"
                />
              </label>
            </>
          ) : null}
        </>
      )}

      <button
        type="button"
        disabled={busy || (link.isSection ? !sectionTitle.trim() : !buttonTitle.trim())}
        onClick={() => void save()}
        className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        Save
      </button>
    </li>
  );
}
