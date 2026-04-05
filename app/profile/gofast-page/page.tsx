"use client";

import { useEffect, useRef, useState } from "react";
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

export default function GoFastPageStudioRoute() {
  const router = useRouter();
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [payload, setPayload] = useState<GoFastPagePayload | null>(null);
  const [bio, setBio] = useState("");
  const [instagram, setInstagram] = useState("");
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [noHandle, setNoHandle] = useState(false);

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
        const profileRes = await api.get(`/athlete/${id}`);
        const athlete = profileRes.data?.athlete;
        const handle = athlete?.gofastHandle?.trim();
        if (!handle) {
          if (!cancelled) {
            setNoHandle(true);
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
          setBio(athlete.bio || "");
          setInstagram(athlete.instagram || "");
          setBannerPreview(athlete.myBestRunPhotoURL || data.athlete.myBestRunPhotoURL || null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Something went wrong loading the studio.");
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

  const handleSave = async () => {
    if (!athleteId) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const bannerURL = bannerPreview || null;
      await api.put(`/athlete/${athleteId}/profile`, {
        myBestRunPhotoURL: bannerURL,
        bio: bio.trim() || null,
        instagram: instagram.trim() || null,
      });
      setPayload((prev) => {
        if (!prev?.athlete) return prev;
        return {
          ...prev,
          athlete: {
            ...prev.athlete,
            myBestRunPhotoURL: bannerURL,
            bio: bio.trim() || null,
          },
        };
      });
      setSuccess("Saved. Your preview updates below — your live page will match after it refreshes.");
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
        <h1 className="text-2xl font-bold text-gray-900">GoFast Page Studio</h1>
        <p className="text-gray-700 text-sm">
          Set your GoFast handle first — it becomes the web address for your public page.
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

  if (!payload?.athlete) {
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

  const handle = payload.athlete.gofastHandle;
  const liveUrl = handle ? `${RUNNER_BASE}/${handle}` : null;
  const publicUrlDisplay = liveUrl || "";

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
          <h1 className="text-2xl font-bold text-gray-900">GoFast Page Studio</h1>
          <p className="text-gray-600 text-sm mt-1 max-w-xl">
            Your public GoFast Page is what friends and new runners see on the web. Edit here and watch
            the preview update.
          </p>
        </div>
        {liveUrl ? (
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100"
          >
            View live page →
          </a>
        ) : null}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-gray-900">Your public link</h2>
        <p className="text-sm text-gray-600 mt-1">
          Anyone can open this URL — no app required. It pulls together your banner, bio, location, sport,
          runs, and training highlights.
        </p>
        {liveUrl ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
            <code className="block truncate rounded-lg border border-amber-200/80 bg-white px-3 py-2 text-xs text-gray-800 sm:max-w-md">
              {publicUrlDisplay}
            </code>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyPublicUrl(liveUrl)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                {copyDone ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
        ) : null}
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
              Edit your page
            </h2>

            <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-3 mb-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Banner photo</h3>
              <p className="text-xs text-gray-600 mb-3">
                This is the large hero on your public page (separate from your profile circle).
              </p>
              <button
                type="button"
                onClick={handleBannerPick}
                className="w-full aspect-[21/9] max-h-32 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center hover:bg-gray-300"
              >
                {bannerPreview ? (
                  <img src={bannerPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-500 text-sm">Tap to add banner</span>
                )}
              </button>
              <button
                type="button"
                onClick={handleBannerPick}
                className="mt-2 text-orange-600 text-sm font-medium"
              >
                {bannerPreview ? "Change banner" : "Add banner"}
              </button>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={handleBannerUpload}
                className="hidden"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio (public)</label>
              <textarea
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value);
                  setSuccess(null);
                }}
                maxLength={250}
                rows={4}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                disabled={saving}
              />
              <p className="text-xs text-gray-500 mt-1">{bio.length}/250</p>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
              <input
                type="text"
                value={instagram}
                onChange={(e) => {
                  setInstagram(e.target.value);
                  setSuccess(null);
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                disabled={saving}
              />
            </div>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="w-full rounded-lg bg-orange-500 py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>

            <p className="text-xs text-gray-500 mt-3">
              Location, sport, and profile photo are edited under{" "}
              <Link href="/athlete-edit-profile" className="font-medium text-orange-600 hover:underline">
                Edit profile
              </Link>
              .
            </p>
          </section>
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
