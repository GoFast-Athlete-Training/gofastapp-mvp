"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, Copy, Check, ExternalLink } from "lucide-react";
import api from "@/lib/api";

type PublishedPlan = {
  id: string;
  slug: string;
  title: string;
  visibility: string;
  publishedAt: string | null;
};

type Props = {
  planId: string;
  hasSchedule: boolean;
};

export default function LeadTrainingPlanPanel({ planId, hasSchedule }: Props) {
  const [plans, setPlans] = useState<PublishedPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/public-training-plans?mine=1");
      setPlans(Array.isArray(res.data?.plans) ? res.data.plans : []);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasSchedule) void loadPlans();
    else setLoading(false);
  }, [hasSchedule, loadPlans, planId]);

  const copyPlanLink = async (slug: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/plans/${encodeURIComponent(slug)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 2000);
    } catch {
      /* ignore */
    }
  };

  if (!hasSchedule) {
    return (
      <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-violet-100 p-2 text-violet-700">
            <Megaphone className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900">Lead a Training Plan</h3>
            <p className="text-sm text-gray-600 mt-1">
              Create a plan first, then publish it for others to follow your build.
            </p>
            <Link
              href="/training-setup"
              className="mt-3 inline-flex items-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Build my plan
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (loading) return null;

  const published = plans.filter(
    (p) => p.visibility === "PUBLIC" || p.visibility === "UNLISTED"
  );

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-violet-100 p-2 text-violet-700">
          <Megaphone className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900">Lead a Training Plan</h3>
          {published.length > 0 ? (
            <>
              <p className="text-sm text-gray-700 mt-1">
                {published.length} published plan{published.length !== 1 ? "s" : ""} — share your
                build with other runners.
              </p>
              <ul className="mt-3 space-y-2">
                {published.slice(0, 3).map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-2 text-sm text-gray-800"
                  >
                    <Link
                      href={`/plans/${encodeURIComponent(p.slug)}`}
                      className="font-medium text-violet-800 hover:text-violet-900"
                    >
                      {p.title}
                    </Link>
                    <button
                      type="button"
                      onClick={() => void copyPlanLink(p.slug)}
                      className="inline-flex items-center gap-1 rounded border border-violet-200 bg-white px-2 py-0.5 text-xs font-semibold text-violet-800 hover:bg-violet-50"
                    >
                      {copiedSlug === p.slug ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copiedSlug === p.slug ? "Copied" : "Copy link"}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-gray-600 mt-1">
              Publish your plan and share a link so other runners can preview and follow your build.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/training/lead"
              className="inline-flex items-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              {published.length > 0 ? "Manage plans" : "Start leading"}
            </Link>
            {published.length > 0 ? (
              <Link
                href="/training/lead"
                className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open builder
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
