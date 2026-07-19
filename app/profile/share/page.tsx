"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Megaphone, Share2, Sparkles, Users } from "lucide-react";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import ShareCreatorCard from "@/components/profile/ShareCreatorCard";
import {
  buildShareCreatorCards,
  type ShareHubStatus,
} from "@/lib/profile/share-creator-card-logic";

const CARD_ICONS = {
  profile: Sparkles,
  plan: Megaphone,
  run: CalendarDays,
  runcrew: Users,
} as const;

const CARD_ACCENTS = {
  profile: "bg-amber-100 text-amber-800",
  plan: "bg-violet-100 text-violet-800",
  run: "bg-sky-100 text-sky-800",
  runcrew: "bg-orange-100 text-orange-800",
} as const;

export default function ShareWithCommunityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ShareHubStatus | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const athleteId = LocalStorageAPI.getAthleteId();
      if (!athleteId) {
        router.replace("/welcome");
        return;
      }
      const res = await api.get("/me/share-hub-status");
      if (!res.data?.success || !res.data?.status) {
        setError("Could not load your share settings.");
        return;
      }
      setStatus(res.data.status as ShareHubStatus);
    } catch {
      setError("Could not load your share settings.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const cards = useMemo(
    () => (status ? buildShareCreatorCards(status) : []),
    [status]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="max-w-lg space-y-4">
        <p className="text-gray-700">{error ?? "Something went wrong."}</p>
        <button
          type="button"
          onClick={() => void loadStatus()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Retry
        </button>
      </div>
    );
  }

  const publicPageUrl = status.profile.publicPageUrl;

  return (
    <div className="space-y-6 pb-8 max-w-4xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-orange-700 mb-2">
            <Share2 className="h-3.5 w-3.5" />
            Creator hub
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Share with the Community</h1>
          <p className="text-sm text-gray-600 mt-2 max-w-2xl leading-relaxed">
            Choose what to make public — your GoFastWithMe landing, training plan, hosted runs, or a
            RunCrew. Each action is separate; GoFastWithMe brings the live pieces together for
            visitors.
          </p>
        </div>
        {publicPageUrl ? (
          <a
            href={publicPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100"
          >
            View public page →
          </a>
        ) : null}
      </div>

      <section className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">GoFastWithMe</h2>
        <p className="text-sm text-gray-600 mt-1">
          Where visitors see your landing copy, published plans, upcoming runs, group training, and
          community links — after you turn each piece on below.
        </p>
        <Link
          href="/gofast-with-others"
          className="mt-3 inline-flex text-sm font-semibold text-orange-700 hover:text-orange-800"
        >
          Open GoFast with Others →
        </Link>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card) => {
          const Icon = CARD_ICONS[card.id];
          const accent = CARD_ACCENTS[card.id];
          return <ShareCreatorCard key={card.id} card={card} icon={Icon} accentClass={accent} />;
        })}
      </div>
    </div>
  );
}
