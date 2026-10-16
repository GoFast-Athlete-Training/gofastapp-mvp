"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Share2 } from "lucide-react";
import api from "@/lib/api";

const LAST_HOSTED_RUN_KEY = "gofast_last_hosted_run_id";

type HostedInvite = {
  id: string;
  title: string;
  slug: string | null;
  date: string;
  createdAt: string;
  gorunPath: string;
  shareUrl: string;
  joinSignupUrl: string | null;
  isUpcoming: boolean;
};

function formatRunDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function markLastHostedRunForBuildPage(cityRunId: string): void {
  try {
    sessionStorage.setItem(LAST_HOSTED_RUN_KEY, cityRunId);
  } catch {
    /* ignore */
  }
}

export default function HostedRunInvitesPanel() {
  const [invites, setInvites] = useState<HostedInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ invites?: HostedInvite[] }>(
        "/me/hosted-run-invites?limit=12",
      );
      setInvites(res.data.invites ?? []);
    } catch (e) {
      console.error(e);
      setError("Could not load your run invites.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    try {
      const last = sessionStorage.getItem(LAST_HOSTED_RUN_KEY);
      if (last) {
        setHighlightId(last);
        sessionStorage.removeItem(LAST_HOSTED_RUN_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [load]);

  async function copyLink(invite: HostedInvite) {
    const url = invite.joinSignupUrl || invite.shareUrl;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50/80 to-white p-6 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="rounded-xl bg-orange-100 p-2.5 shrink-0">
          <Share2 className="h-6 w-6 text-orange-700" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Run invites you created
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Copy a share link or open the run page — newest first. This is your
            hosted invites, not every workout in your library.
          </p>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      ) : null}

      {!loading && !error && invites.length === 0 ? (
        <p className="text-sm text-gray-600 py-2">
          No run invites yet. Use{" "}
          <Link href="/host-a-run" className="font-semibold text-orange-700 hover:underline">
            Create a run
          </Link>{" "}
          — your invite will show up here with a link to share.
        </p>
      ) : null}

      {!loading && invites.length > 0 ? (
        <ul className="space-y-2">
          {invites.map((invite) => {
            const isHighlight = highlightId === invite.id;
            return (
              <li
                key={invite.id}
                className={`rounded-xl border bg-white p-4 ${
                  isHighlight
                    ? "border-orange-400 ring-2 ring-orange-200"
                    : "border-gray-100"
                }`}
              >
                {isHighlight ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 mb-2">
                    Just created
                  </p>
                ) : null}
                <p className="font-medium text-gray-900">{invite.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {formatRunDate(invite.date)}
                  {invite.isUpcoming ? (
                    <span className="ml-2 text-emerald-700 font-medium">Upcoming</span>
                  ) : (
                    <span className="ml-2 text-gray-400">Past</span>
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyLink(invite)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700"
                  >
                    <Copy className="h-4 w-4" />
                    {copiedId === invite.id ? "Copied" : "Copy invite link"}
                  </button>
                  <Link
                    href={invite.gorunPath}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open run page
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
