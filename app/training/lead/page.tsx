"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Megaphone } from "lucide-react";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";

type PlanDetail = {
  id: string;
  name: string;
  totalWeeks: number;
  planSchedule: unknown;
  publicSlug?: string | null;
  publicVisibility?: string | null;
  race_registry?: { name: string | null; distanceLabel: string | null } | null;
};

export default function LeadTrainingPlanPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"DRAFT" | "PUBLIC" | "UNLISTED">("PUBLIC");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const athleteId = LocalStorageAPI.getAthleteId();
      if (!athleteId) {
        router.replace("/welcome");
        return;
      }
      const plansRes = await api.get("/training-plan");
      const active = plansRes.data?.plans?.find(
        (p: { lifecycleStatus?: string }) => p.lifecycleStatus === "ACTIVE"
      );
      if (!active?.id) {
        setPlan(null);
        setLoading(false);
        return;
      }
      const detailRes = await api.get(`/training-plan/${active.id}`);
      const detail = detailRes.data?.plan as PlanDetail | undefined;
      if (!detail) {
        setError("Could not load your active plan");
        setLoading(false);
        return;
      }
      setPlan(detail);
      if (detail.publicSlug && detail.publicVisibility && detail.publicVisibility !== "DRAFT") {
        setPublishedSlug(detail.publicSlug);
      }
    } catch {
      setError("Could not load training plan");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const publish = async () => {
    if (!plan) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post("/public-training-plans", {
        sourceTrainingPlanId: plan.id,
        description: description.trim() || null,
        visibility,
      });
      if (res.data?.plan?.slug) {
        setPublishedSlug(res.data.plan.slug as string);
      } else {
        setError(res.data?.error || "Could not publish plan");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || "Could not publish plan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="max-w-lg mx-auto rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <Megaphone className="w-10 h-10 text-violet-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900">Share your training plan</h1>
          <p className="mt-2 text-gray-600">
            Create and generate a training plan first, then come back to publish it for others.
          </p>
          <Link
            href="/training-setup"
            className="mt-6 inline-flex rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Build my plan
          </Link>
        </div>
      </div>
    );
  }

  const hasSchedule =
    Array.isArray(plan.planSchedule) && (plan.planSchedule as unknown[]).length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/training" className="text-gray-500 hover:text-gray-800">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Share your training plan</h1>
            <p className="text-xs text-gray-500">
              Promote your generated schedule with a public link
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {!hasSchedule ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            Generate your schedule in plan setup before publishing.
            <Link href={`/training-setup/${plan.id}`} className="ml-2 font-semibold underline">
              Continue setup
            </Link>
          </div>
        ) : null}

        {publishedSlug ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <h2 className="text-lg font-semibold text-emerald-900">Your plan is live</h2>
            <p className="mt-2 text-sm text-emerald-800">
              Share it from your Run With Me page or copy the public link.
            </p>
            <Link
              href={`/plans/${encodeURIComponent(publishedSlug)}`}
              className="mt-4 inline-flex rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              View public plan
            </Link>
          </section>
        ) : null}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Plan to publish</h2>
          <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
            <p className="font-semibold text-gray-900">{plan.name}</p>
            <p className="text-sm text-gray-600 mt-1">
              {plan.totalWeeks} weeks
              {plan.race_registry?.name ? ` · ${plan.race_registry.name}` : ""}
              {plan.race_registry?.distanceLabel ? ` · ${plan.race_registry.distanceLabel}` : ""}
            </p>
          </div>
          <p className="text-sm text-gray-600">
            Your public URL slug is derived from this plan name. Edit the name in plan setup if you
            want a different title before publishing.
          </p>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Public description (optional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Who is this plan for? What makes your approach unique?"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Visibility</span>
            <select
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as "DRAFT" | "PUBLIC" | "UNLISTED")
              }
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="PUBLIC">Public — discoverable</option>
              <option value="UNLISTED">Unlisted — link only</option>
              <option value="DRAFT">Draft — only you</option>
            </select>
          </label>

          <button
            type="button"
            disabled={saving || !hasSchedule}
            onClick={() => void publish()}
            className="inline-flex rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? "Publishing…" : publishedSlug ? "Update visibility" : "Publish plan"}
          </button>
        </section>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </main>
    </div>
  );
}
