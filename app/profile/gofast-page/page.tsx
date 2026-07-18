"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import GoFastPagePreviewCard, {
  type GoFastPagePayload,
} from "@/components/profile/GoFastPagePreviewCard";
import PersonalCommunityCard from "@/components/profile/PersonalCommunityCard";
import { AdvertisingEarningsPanel } from "@/components/advertising/AdvertisingEarningsPanel";
import GoFastWithMeIntroEditor, {
  type GoFastWithMeIntroValues,
} from "@/components/profile/GoFastWithMeIntroEditor";
import GoFastWithMeUrlEditor from "@/components/profile/GoFastWithMeUrlEditor";

const RUNNER_BASE =
  process.env.NEXT_PUBLIC_RUNNER_PHOTO_URL?.replace(/\/$/, "") ||
  "https://runner.gofastcrushgoals.com";

const AUTO_MODULES = [
  "Next race",
  "My plan",
  "Last run",
  "Upcoming public runs",
  "Community audience",
  "Group training",
  "Published training plans",
] as const;

export default function GoFastWithMeStudioRoute() {
  const router = useRouter();
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [gofastHandle, setGofastHandle] = useState<string | null>(null);
  const [profileBio, setProfileBio] = useState<string | null>(null);
  const [isGoFastContainer, setIsGoFastContainer] = useState(false);
  const [payload, setPayload] = useState<GoFastPagePayload | null>(null);
  const [publicSlug, setPublicSlug] = useState<string | null>(null);
  const [slugUsesHandle, setSlugUsesHandle] = useState(true);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [noHandle, setNoHandle] = useState(false);

  const refreshPublicPreview = useCallback(async (slug: string) => {
    const pubRes = await fetch(`/api/athlete/public/${encodeURIComponent(slug)}`);
    const data = (await pubRes.json()) as GoFastPagePayload & { error?: string };
    if (pubRes.ok && data.success && data.athlete) {
      setPayload(data);
    }
  }, []);

  useEffect(() => {
    const id = LocalStorageAPI.getAthleteId();
    if (!id) {
      router.replace("/welcome");
      return;
    }
    setAthleteId(id);

    let cancelled = false;
    (async () => {
      try {
        const [profileRes, gwmRes] = await Promise.all([
          api.get(`/athlete/${id}`),
          api.get("/me/gofast-with-me"),
        ]);
        const athlete = profileRes.data?.athlete;
        const handle = athlete?.gofastHandle?.trim();
        if (!handle) {
          if (!cancelled) {
            setNoHandle(true);
            setLoading(false);
          }
          return;
        }
        setGofastHandle(handle);
        setProfileBio(athlete?.bio ?? null);
        setIsGoFastContainer(!!athlete?.isGoFastContainer);

        const gwm = gwmRes.data?.gofastWithMe;
        const slug = gwm?.gofastSlugSnapshot ?? handle;
        setPublicSlug(slug);
        setSlugUsesHandle(gwm?.slugUsesHandle ?? true);

        const pubRes = await fetch(`/api/athlete/public/${encodeURIComponent(slug)}`);
        const data = (await pubRes.json()) as GoFastPagePayload & { error?: string };
        if (!pubRes.ok || !data.success || !data.athlete) {
          if (!cancelled) {
            setError(data.error || "Could not load your GoFast With Me page.");
            setLoading(false);
          }
          return;
        }
        if (!cancelled) {
          setPayload(data);
          setBannerPreview(athlete.myBestRunPhotoURL || data.athlete.myBestRunPhotoURL || null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Something went wrong loading GoFast With Me.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    return () => {
      if (bannerPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(bannerPreview);
      }
    };
  }, [bannerPreview]);

  const handleBannerPick = () => bannerInputRef.current?.click();

  const handleBannerUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert("Image size must be less than 8MB");
      return;
    }
    setBannerPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setSuccess(null);
    setError(null);
  };

  const handleSaveHero = async () => {
    if (!athleteId) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const bannerURL = bannerPreview || null;
      await api.put(`/athlete/${athleteId}/profile`, {
        myBestRunPhotoURL: bannerURL,
      });
      setPayload((prev) => {
        if (!prev?.athlete) return prev;
        return {
          ...prev,
          athlete: {
            ...prev.athlete,
            myBestRunPhotoURL: bannerURL,
          },
        };
      });
      setSuccess("Saved hero photo.");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; error?: string } } };
      setError(e.response?.data?.message || e.response?.data?.error || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const copyPublicUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  const introValues: GoFastWithMeIntroValues = {
    welcome: payload?.gofastWithMe?.welcome ?? null,
    gofastWithMeBio: payload?.gofastWithMe?.gofastWithMeBio ?? null,
    whatYoullSeeHere: payload?.gofastWithMe?.whatYoullSeeHere ?? null,
    sportFocus: payload?.gofastWithMe?.sportFocus ?? null,
    modelFocus: payload?.gofastWithMe?.modelFocus ?? null,
    myAchievements: payload?.gofastWithMe?.myAchievements ?? null,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (noHandle) {
    return (
      <div className="max-w-lg space-y-4">
        <Link
          href="/profile"
          className="inline-block text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          ← Back to profile
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">GoFast With Me</h1>
        <p className="text-gray-700 text-sm">
          Set your GoFast handle first — it becomes your default GoFast With Me link.
        </p>
        <Link
          href="/athlete-edit-profile?tab=profile-info"
          className="inline-flex items-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          Go to Profile Info
        </Link>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="max-w-lg space-y-4">
        <Link
          href="/profile"
          className="inline-block text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          ← Back to profile
        </Link>
        <p className="text-gray-700">{error}</p>
      </div>
    );
  }

  if (!payload?.athlete || !gofastHandle || !publicSlug) {
    return (
      <div className="max-w-lg space-y-4">
        <Link
          href="/profile"
          className="inline-block text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          ← Back to profile
        </Link>
        <p className="text-gray-700">Preview unavailable.</p>
      </div>
    );
  }

  const liveUrl = `${RUNNER_BASE}/${publicSlug}`;
  const appUrl = `/u/${publicSlug}`;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/profile"
            className="inline-block text-sm font-medium text-orange-600 hover:text-orange-700 mb-1"
          >
            ← Back to profile
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">GoFast With Me</h1>
          <p className="text-gray-600 text-sm mt-1 max-w-xl">
            Your public invite identity — who you are as a GoFast athlete and how people train,
            follow, and join you. The page is the render surface; this is the data behind it.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100"
          >
            View live page →
          </a>
        </div>
      </div>

      {publicSlug && gofastHandle ? (
        <GoFastWithMeUrlEditor
          gofastHandle={gofastHandle}
          publicSlug={publicSlug}
          slugUsesHandle={slugUsesHandle}
          publicUrl={liveUrl}
          onUpdated={(slug, usesHandle) => {
            setPublicSlug(slug);
            setSlugUsesHandle(usesHandle);
            void refreshPublicPreview(slug);
          }}
        />
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-gray-900">What appears on your page</h2>
        <p className="text-sm text-gray-600 mt-1">
          You edit your GoFast With Me intro below. Training, runs, races, and community modules
          hydrate automatically from your activity.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {AUTO_MODULES.map((label) => (
            <li
              key={label}
              className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700"
            >
              {label}
            </li>
          ))}
        </ul>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="w-full shrink-0 space-y-6 lg:w-96">
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-4">
              Hero photo
            </h2>
            <p className="text-xs text-gray-600 mb-3">
              A horizontal action shot from a race or run — the hero at the top of your public page.
            </p>
            <button
              type="button"
              onClick={handleBannerPick}
              className="w-full aspect-[21/9] max-h-32 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center hover:bg-gray-300"
            >
              {bannerPreview ? (
                <img src={bannerPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-500 text-sm">Tap to add a photo</span>
              )}
            </button>
            <button
              type="button"
              onClick={handleBannerPick}
              className="mt-2 text-orange-600 text-sm font-medium"
            >
              {bannerPreview ? "Change photo" : "Add photo"}
            </button>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={handleBannerUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => void handleSaveHero()}
              disabled={saving}
              className="mt-4 w-full rounded-lg bg-orange-500 py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save hero photo"}
            </button>
            <p className="text-xs text-gray-500 mt-3">
              Name, profile photo, location, and profile bio are edited under{" "}
              <Link href="/athlete-edit-profile" className="font-medium text-orange-600 hover:underline">
                Edit profile
              </Link>
              .
            </p>
          </section>

          <GoFastWithMeIntroEditor
            initial={introValues}
            profileBio={profileBio}
            onSaved={(values) => {
              setPayload((prev) =>
                prev ? { ...prev, gofastWithMe: { ...prev.gofastWithMe, ...values } } : prev
              );
              void refreshPublicPreview(publicSlug);
            }}
          />

          {athleteId ? (
            <div className="space-y-2">
              <PersonalCommunityCard
                athleteId={athleteId}
                gofastHandle={gofastHandle}
                initialEnabled={isGoFastContainer}
                compact
                onEnabledChange={(enabled) => {
                  setIsGoFastContainer(enabled);
                  setPayload((prev) => (prev ? { ...prev, isGoFastContainer: enabled } : prev));
                }}
              />
              <p className="text-xs text-gray-500 px-1">
                Turn on your audience — unlocks join, chatter, and partner earnings on this page.
              </p>
            </div>
          ) : null}

          {athleteId ? (
            <AdvertisingEarningsPanel
              athleteId={athleteId}
              isGoFastContainer={isGoFastContainer}
            />
          ) : null}

          <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900">Run with me</h2>
            <p className="text-xs text-gray-600 mt-1">
              Publish your plan or host runs — they appear on your page automatically.
            </p>
            {payload.publishedPlans && payload.publishedPlans.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {payload.publishedPlans.map((p) => (
                  <li key={p.id} className="text-sm text-gray-800">
                    <Link
                      href={`/plans/${encodeURIComponent(p.slug)}`}
                      className="font-medium text-violet-800 hover:text-violet-900"
                    >
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-gray-600">No published plans yet.</p>
            )}
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/training/lead"
                className="inline-flex justify-center rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
              >
                Publish training plan
              </Link>
              <Link
                href="/host-a-run"
                className="inline-flex justify-center rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-900 hover:bg-violet-50"
              >
                Host a public run
              </Link>
            </div>
          </section>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-600">In-app preview URL</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="text-xs text-gray-800 truncate flex-1">{appUrl}</code>
              <button
                type="button"
                onClick={() => void copyPublicUrl(`${window.location.origin}${appUrl}`)}
                className="text-xs font-medium text-orange-600"
              >
                {copyDone ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Live preview
          </p>
          <div className="rounded-xl border border-gray-200 shadow-lg max-h-[calc(100vh-8rem)] overflow-y-auto overflow-x-hidden bg-zinc-950">
            <GoFastPagePreviewCard data={payload} />
          </div>
        </div>
      </div>
    </div>
  );
}
