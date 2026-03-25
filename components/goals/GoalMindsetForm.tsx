"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  Sparkles,
  Trophy,
  Heart,
  Flame,
  Sunrise,
  Mountain,
  Zap,
  Star,
} from "lucide-react";
import api from "@/lib/api";
import { MOTIVATION_ICON_SLUGS, type MotivationIconSlug } from "@/lib/goals-motivation-icons";

const ICON_BY_SLUG: Record<MotivationIconSlug, ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  trophy: Trophy,
  heart: Heart,
  flame: Flame,
  sunrise: Sunrise,
  mountain: Mountain,
  zap: Zap,
  star: Star,
};

type GoalRow = {
  id: string;
  whyGoal?: string | null;
  successLooksLike?: string | null;
  completionFeeling?: string | null;
  motivationIcon?: string | null;
};

export default function GoalMindsetForm() {
  const [goal, setGoal] = useState<GoalRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [whyGoal, setWhyGoal] = useState("");
  const [successLooksLike, setSuccessLooksLike] = useState("");
  const [completionFeeling, setCompletionFeeling] = useState("");
  const [motivationIcon, setMotivationIcon] = useState<MotivationIconSlug | null>(null);

  useEffect(() => {
    api
      .get<{ goals: GoalRow[] }>("/goals?status=ACTIVE")
      .then((res) => {
        const g = res.data?.goals?.[0] ?? null;
        setGoal(g);
        if (g) {
          setWhyGoal(g.whyGoal ?? "");
          setSuccessLooksLike(g.successLooksLike ?? "");
          setCompletionFeeling(g.completionFeeling ?? "");
          const icon = g.motivationIcon?.trim().toLowerCase();
          setMotivationIcon(
            icon && MOTIVATION_ICON_SLUGS.includes(icon as MotivationIconSlug)
              ? (icon as MotivationIconSlug)
              : null
          );
        }
      })
      .catch(() => setError("Could not load your goal."))
      .finally(() => setLoading(false));
  }, []);

  const toggleIcon = (slug: MotivationIconSlug) => {
    setMotivationIcon((prev) => (prev === slug ? null : slug));
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal?.id) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.put(`/goals/${goal.id}`, {
        whyGoal: whyGoal.trim() || null,
        successLooksLike: successLooksLike.trim() || null,
        completionFeeling: completionFeeling.trim() || null,
        motivationIcon: motivationIcon,
      });
      setSaved(true);
    } catch {
      setError("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mindset</h1>
        <p className="text-gray-600 mb-6">
          Set an active goal first, then you can capture why it matters and what success feels like.
        </p>
        <Link
          href="/goals"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
        >
          Go to Goals
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Mindset</h1>
      <p className="text-sm text-gray-600 mb-6">
        These notes are for you — they anchor commitment when training gets noisy. They do not change pace math.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="whyGoal" className="block text-sm font-medium text-gray-800 mb-1">
            Why this goal?
          </label>
          <textarea
            id="whyGoal"
            value={whyGoal}
            onChange={(e) => {
              setWhyGoal(e.target.value);
              setSaved(false);
            }}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        <div>
          <label htmlFor="successLooksLike" className="block text-sm font-medium text-gray-800 mb-1">
            What does success look like?
          </label>
          <textarea
            id="successLooksLike"
            value={successLooksLike}
            onChange={(e) => {
              setSuccessLooksLike(e.target.value);
              setSaved(false);
            }}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        <div>
          <label htmlFor="completionFeeling" className="block text-sm font-medium text-gray-800 mb-1">
            How will you feel when you accomplish this?
          </label>
          <textarea
            id="completionFeeling"
            value={completionFeeling}
            onChange={(e) => {
              setCompletionFeeling(e.target.value);
              setSaved(false);
            }}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        <div>
          <p className="block text-sm font-medium text-gray-800 mb-2">Motivation icon (optional)</p>
          <p className="text-xs text-gray-500 mb-2">Pick one that fits your headspace — tap again to clear.</p>
          <div className="flex flex-wrap gap-2">
            {MOTIVATION_ICON_SLUGS.map((slug) => {
              const Icon = ICON_BY_SLUG[slug];
              const selected = motivationIcon === slug;
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => toggleIcon(slug)}
                  className={`p-3 rounded-lg border transition-colors ${
                    selected
                      ? "border-orange-500 bg-orange-50 text-orange-800"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                  aria-pressed={selected}
                  aria-label={slug}
                >
                  <Icon className="h-6 w-6" />
                </button>
              );
            })}
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {saved ? <p className="text-sm text-green-700">Saved.</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save mindset"}
        </button>
      </form>
    </div>
  );
}
