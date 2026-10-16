"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Copy, ExternalLink } from "lucide-react";
import api from "@/lib/api";
import { athleteLinksPublicUrl } from "@/lib/content/athlete-links-public-url";
import type { AthleteLinkTreeDetail } from "@/lib/content/athlete-link-tree-types";
import { linkInsertPayload, sectionOptions } from "@/lib/athlete-link-tree/link-tree-race-section";
import { useDebouncedSave, type SaveStatus } from "@/lib/athlete-link-tree/use-debounced-save";
import { AthleteLinkTreeLinkSources } from "@/components/profile/AthleteLinkTreeLinkSources";
import { AthleteLinkTreePageStructure } from "@/components/profile/AthleteLinkTreePageStructure";

type EditorTab = "header" | "links";

function SaveStatusLine({ headerStatus, rowStatus }: { headerStatus: SaveStatus; rowStatus: SaveStatus }) {
  const status =
    headerStatus === "error" || rowStatus === "error"
      ? "error"
      : headerStatus === "saving" || rowStatus === "saving"
        ? "saving"
        : headerStatus === "pending" || rowStatus === "pending"
          ? "pending"
          : headerStatus === "saved" || rowStatus === "saved"
            ? "saved"
            : "idle";

  if (status === "idle") return null;
  if (status === "error") {
    return <p className="text-xs text-red-600">Couldn&apos;t save — fix fields or retry from the row.</p>;
  }
  if (status === "saving" || status === "pending") {
    return <p className="text-xs text-gray-500">Saving…</p>;
  }
  return <p className="text-xs text-green-700">Saved</p>;
}

export function AthleteLinkTreeEditor() {
  const searchParams = useSearchParams();
  const initialTab: EditorTab = searchParams.get("tab") === "links" ? "links" : "header";

  const [tab, setTab] = useState<EditorTab>(initialTab);
  const [tree, setTree] = useState<AthleteLinkTreeDetail | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [publicSlug, setPublicSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [rowSaveStatus, setRowSaveStatus] = useState<SaveStatus>("idle");

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");

  const shareUrl = handle ? athleteLinksPublicUrl(handle) : "";

  const sortedLinks = useMemo(
    () => (tree ? tree.links.slice().sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [tree],
  );

  const sections = useMemo(() => sectionOptions(sortedLinks), [sortedLinks]);

  useEffect(() => {
    if (sections.length === 0) {
      setActiveSectionId(null);
      return;
    }
    if (activeSectionId && !sections.some((s) => s.id === activeSectionId)) {
      setActiveSectionId(null);
    }
  }, [sections, activeSectionId]);

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

  const {
    status: headerSaveStatus,
    schedule: scheduleHeaderSave,
    saveOnBlur: saveHeaderOnBlur,
    retry: retryHeaderSave,
  } = useDebouncedSave(async () => {
    if (!tree) return;
    const trimmedTitle = title.trim() || displayName;
    const res = await api.patch("/athlete/links", {
      publicLabel: trimmedTitle,
      publicDescription: subtitle.trim() || null,
    });
    if (!res.data?.success || !res.data?.tree) throw new Error("fail");
    setTree(res.data.tree);
    setTitle(res.data.tree.publicLabel?.trim() || trimmedTitle);
  });

  async function addLinkRaw(payload: Record<string, unknown>) {
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

  function addLinkWithPlacement(base: Record<string, unknown>) {
    return addLinkRaw(linkInsertPayload(sortedLinks, activeSectionId, base));
  }

  async function removeLink(linkId: string) {
    setError(null);
    try {
      const res = await api.delete(`/athlete/links/items/${linkId}`);
      if (!res.data?.success || !res.data?.tree) {
        throw new Error(res.data?.error || "Failed to remove");
      }
      setTree(res.data.tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
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

  async function addSection(name: string) {
    setAddingSection(true);
    setError(null);
    try {
      await addLinkRaw({ name, isSection: true });
    } finally {
      setAddingSection(false);
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
    <div className="space-y-4 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">GoFast Links</h1>
            {handleSlug ? (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900">
                /{handleSlug}
              </span>
            ) : null}
          </div>
          {shareUrl ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
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
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
              >
                {shareCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                {shareCopied ? "Copied" : "Copy"}
              </button>
            </div>
          ) : null}
        </div>

        <div
          className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 text-sm"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "header"}
            onClick={() => setTab("header")}
            className={`rounded-md px-3 py-1.5 font-medium ${tab === "header" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}
          >
            Header
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "links"}
            onClick={() => setTab("links")}
            className={`rounded-md px-3 py-1.5 font-medium ${tab === "links" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}
          >
            Links
          </button>
        </div>
      </div>

      <SaveStatusLine headerStatus={tab === "header" ? headerSaveStatus : "idle"} rowStatus={tab === "links" ? rowSaveStatus : "idle"} />

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {tab === "header" ? (
        <section className="max-w-lg space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <label className="block text-sm">
            <span className="font-medium">Title</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                scheduleHeaderSave();
              }}
              onBlur={saveHeaderOnBlur}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Subtitle</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
              value={subtitle}
              onChange={(e) => {
                setSubtitle(e.target.value);
                scheduleHeaderSave();
              }}
              onBlur={saveHeaderOnBlur}
              placeholder="Short line under your name"
            />
          </label>
          {headerSaveStatus === "error" ? (
            <button
              type="button"
              onClick={() => void retryHeaderSave()}
              className="text-xs text-red-600 hover:underline"
            >
              Couldn&apos;t save header — retry
            </button>
          ) : null}
        </section>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            Links add under the section selected on the left (or click a section on the right).
            Reorder with ↑↓ on the right.
          </p>
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-2">
              {publicSlug ? (
                <AthleteLinkTreeLinkSources
                  publicSlug={publicSlug}
                  sortedLinks={sortedLinks}
                  adding={adding}
                  sections={sections}
                  activeSectionId={activeSectionId}
                  onActiveSectionIdChange={setActiveSectionId}
                  onAddLink={addLinkWithPlacement}
                  onRemoveLink={removeLink}
                />
              ) : null}
            </div>
            <div className="lg:col-span-3">
              <AthleteLinkTreePageStructure
                sortedLinks={sortedLinks}
                activeSectionId={activeSectionId}
                onActiveSectionIdChange={setActiveSectionId}
                reorderBusy={reorderBusy}
                onMove={moveLink}
                onUpdated={(next) => setTree(next)}
                onRowSaveStatus={setRowSaveStatus}
                onAddSection={addSection}
                addingSection={addingSection}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
