"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import GoFastPagePreviewCard, {
  type GoFastPagePayload,
} from "@/components/profile/GoFastPagePreviewCard";

const RUNNER_BASE =
  process.env.NEXT_PUBLIC_RUNNER_PHOTO_URL?.replace(/\/$/, "") ||
  "https://runner.gofastcrushgoals.com";

export default function GoFastPagePreviewRoute() {
  const router = useRouter();
  const [payload, setPayload] = useState<GoFastPagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = LocalStorageAPI.getAthleteId();
    if (!id) {
      router.replace("/welcome");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const profileRes = await api.get(`/athlete/${id}`);
        const handle = profileRes.data?.athlete?.gofastHandle?.trim();
        if (!handle) {
          if (!cancelled) {
            setError("Set your GoFast handle in Edit profile first.");
            setLoading(false);
          }
          return;
        }
        const pubRes = await fetch(`/api/athlete/public/${encodeURIComponent(handle)}`);
        const data = (await pubRes.json()) as GoFastPagePayload & { error?: string };
        if (!pubRes.ok || !data.success || !data.athlete) {
          if (!cancelled) {
            setError(data.error || "Could not load your public page data.");
            setLoading(false);
          }
          return;
        }
        if (!cancelled) {
          setPayload(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Something went wrong loading the preview.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="max-w-lg">
        <Link
          href="/profile"
          className="inline-block text-sm font-medium text-orange-600 hover:text-orange-700 mb-4"
        >
          ← Back to profile
        </Link>
        <p className="text-gray-700">{error || "Preview unavailable."}</p>
      </div>
    );
  }

  const handle = payload.athlete?.gofastHandle;
  const liveUrl = handle ? `${RUNNER_BASE}/${handle}` : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/profile"
          className="inline-block text-sm font-medium text-orange-600 hover:text-orange-700 mb-2"
        >
          ← Back to profile
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">GoFast Page preview</h1>
        <p className="text-gray-600 text-sm mt-1">
          This is how your public page hydrates today. Upload a banner in Edit profile to fill the
          hero.
        </p>
        {liveUrl ? (
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex mt-3 text-sm font-semibold text-orange-600 hover:text-orange-700"
          >
            View live GoFast Page →
          </a>
        ) : null}
      </div>

      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-lg">
        <GoFastPagePreviewCard data={payload} />
      </div>
    </div>
  );
}
