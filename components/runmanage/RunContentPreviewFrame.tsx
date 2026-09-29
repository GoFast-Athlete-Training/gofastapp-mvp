"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { getPublicRunContentUrl } from "@/lib/publicRunUrl";

type RunContentPreviewFrameProps = {
  runId: string;
  slug?: string | null;
  citySlug?: string | null;
  /** Bust cache when re-entering preview after edits. */
  refreshKey?: string | number;
  compact?: boolean;
};

export default function RunContentPreviewFrame({
  runId,
  slug,
  citySlug,
  refreshKey = 0,
  compact = false,
}: RunContentPreviewFrameProps) {
  const [loaded, setLoaded] = useState(false);
  const previewUrl = useMemo(() => {
    const base = getPublicRunContentUrl({ runId, slug, citySlug });
    const url = new URL(base);
    url.searchParams.set("preview", "1");
    url.searchParams.set("t", String(refreshKey));
    return url.toString();
  }, [runId, slug, citySlug, refreshKey]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          Same page runners see on the content site — title, description, map, and photos hydrated
          from Product.
        </p>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:text-sky-800"
        >
          Open full page
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div
        className={`relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-sm ${
          compact ? "min-h-[60vh]" : "min-h-[75vh]"
        }`}
      >
        {!loaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-gray-50 text-sm text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
            Loading public preview…
          </div>
        )}
        <iframe
          key={previewUrl}
          src={previewUrl}
          title="Run public page preview"
          className="h-full w-full border-0 bg-white"
          style={{ minHeight: compact ? "60vh" : "75vh" }}
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  );
}
