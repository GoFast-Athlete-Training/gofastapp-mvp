"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, Copy, ExternalLink, Save, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { athleteLinksPublicUrl } from "@/lib/content/athlete-links-public-url";
import type { AthleteLinkTreeDetail, AthleteLinkTreeLink } from "@/lib/content/athlete-link-tree-types";

const EMOJI_PRESETS = ["🌐", "📱", "🏃", "👟", "🔗", "📍"] as const;

export function AthleteLinkTreeEditor() {
  const [tree, setTree] = useState<AthleteLinkTreeDetail | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [treeBusy, setTreeBusy] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const [publicLabel, setPublicLabel] = useState("");
  const [publicDescription, setPublicDescription] = useState("");
  const [internalDescription, setInternalDescription] = useState("");

  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("https://");
  const [sectionTitle, setSectionTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const shareUrl = handle ? athleteLinksPublicUrl(handle) : "";

  const sortedLinks = useMemo(
    () => (tree ? tree.links.slice().sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [tree],
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
      setTree(next);
      setHandle(typeof res.data.handle === "string" ? res.data.handle : null);
      setPublicLabel(next.publicLabel ?? "");
      setPublicDescription(next.publicDescription ?? "");
      setInternalDescription(next.internalDescription ?? "");
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
    try {
      const res = await api.patch("/athlete/links", {
        publicLabel: publicLabel.trim() || null,
        publicDescription: publicDescription.trim() || null,
        internalDescription: internalDescription.trim() || null,
      });
      if (!res.data?.success || !res.data?.tree) {
        throw new Error(res.data?.error || "Failed to save");
      }
      setTree(res.data.tree);
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
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/gofast-with-others" className="text-sky-700 hover:underline">
            ← GoFastWithMe studio
          </Link>
          <Link href="/profile/share" className="text-sky-700 hover:underline">
            Share hub
          </Link>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Link page</h1>
          {handleSlug ? (
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-900">
              Athlete · athletelinks /{handleSlug}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Public link buttons on athletelinks — edited here, not in Content Studio.
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

      <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Page title &amp; subtitle</h2>
        <label className="block text-sm">
          <span className="font-medium">Public title</span>
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={publicLabel}
            onChange={(e) => setPublicLabel(e.target.value)}
            placeholder={tree.name}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Public description</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={2}
            value={publicDescription}
            onChange={(e) => setPublicDescription(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Internal notes</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={2}
            value={internalDescription}
            onChange={(e) => setInternalDescription(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={treeBusy}
          onClick={() => void saveTreeMeta()}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {treeBusy ? "Saving…" : "Save page"}
        </button>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-gray-900">Links</h2>
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

        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <p className="text-sm font-medium">Add section title</p>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              placeholder="e.g. My training"
            />
            <button
              type="button"
              disabled={adding || !sectionTitle.trim()}
              onClick={() => {
                void addLink({ name: sectionTitle.trim(), isSection: true }).then(() =>
                  setSectionTitle(""),
                );
              }}
              className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <p className="text-sm font-medium">Add custom link</p>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Internal title"
          />
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://"
          />
          <button
            type="button"
            disabled={adding || !customName.trim() || !customUrl.trim()}
            onClick={() => {
              void addLink({
                name: customName.trim(),
                url: customUrl.trim(),
                emoji: "🌐",
              }).then(() => {
                setCustomName("");
                setCustomUrl("https://");
              });
            }}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add link"}
          </button>
        </div>
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
  const [name, setName] = useState(link.name);
  const [publicLabel, setPublicLabel] = useState(link.publicLabel ?? "");
  const [internalDescription, setInternalDescription] = useState(link.internalDescription ?? "");
  const [description, setDescription] = useState(link.description ?? "");
  const [url, setUrl] = useState(link.url ?? "");
  const [emoji, setEmoji] = useState(link.emoji ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await api.patch(`/athlete/links/items/${link.id}`, {
        name: name.trim(),
        publicLabel: publicLabel.trim() || null,
        internalDescription: internalDescription.trim() || null,
        description: description.trim() || null,
        url: link.isSection ? undefined : url.trim(),
        emoji: emoji.trim() || null,
      });
      if (res.data?.success && res.data?.tree) onUpdated(res.data.tree);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this row?")) return;
    setBusy(true);
    try {
      const res = await api.delete(`/athlete/links/items/${link.id}`);
      if (res.data?.success && res.data?.tree) onUpdated(res.data.tree);
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post(`/athlete/links/items/${link.id}/image`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.success && res.data?.tree) onUpdated(res.data.tree);
    } finally {
      setBusy(false);
    }
  }

  const header = name.trim() || (link.isSection ? "Section" : `Link ${index + 1}`);

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 truncate">
          {header}
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

      {!link.isSection && link.linkLogoUrl ? (
        <img src={link.linkLogoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
      ) : null}

      <label className="block text-sm">
        <span className="font-medium">Internal title</span>
        <input
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      {!link.isSection ? (
        <>
          <label className="block text-sm">
            <span className="font-medium">Public title</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={publicLabel}
              onChange={(e) => setPublicLabel(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Internal description</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
              value={internalDescription}
              onChange={(e) => setInternalDescription(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Public description</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">URL</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
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
          <label className="block text-sm">
            <span className="font-medium">Photo</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-1 block w-full text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadPhoto(f);
              }}
            />
          </label>
        </>
      ) : null}

      <button
        type="button"
        disabled={busy || !name.trim()}
        onClick={() => void save()}
        className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        Save
      </button>
    </li>
  );
}
