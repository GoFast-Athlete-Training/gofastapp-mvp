'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ImagePlus } from 'lucide-react';
import api from '@/lib/api';
import { DEFAULT_PHOTO_FOCUS, normalizePhotoFocus } from '@/lib/gofast-with-me/photo-focus';
import {
  GOFAST_WITH_ME_PHOTO_TYPE_OPTIONS,
  normalizeGoFastWithMePhotoType,
  photoTypeGuidance,
  type GoFastWithMePhotoType,
} from '@/lib/gofast-with-me/photo-type';
import RunImageFocalPicker from '@/components/gofast-with-me/RunImageFocalPicker';

export type GoFastWithMeLandingValues = {
  welcome: string | null;
  gofastWithMeBio: string | null;
  whatYoullSeeHere: string | null;
  sportFocus: string | null;
  modelFocus: string | null;
  myAchievements: string | null;
  gofastWithMePhotoUrl: string | null;
  gofastWithMePhotoFocusX: number | null;
  gofastWithMePhotoFocusY: number | null;
  gofastWithMePhotoType: GoFastWithMePhotoType | null;
};

type Props = {
  initial: GoFastWithMeLandingValues;
  profileBio?: string | null;
  onSaved?: (values: GoFastWithMeLandingValues) => void;
};

export default function GoFastWithMeLandingForm({ initial, profileBio, onSaved }: Props) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const initialFocus = normalizePhotoFocus(
    initial.gofastWithMePhotoFocusX,
    initial.gofastWithMePhotoFocusY
  );
  const [values, setValues] = useState({
    welcome: initial.welcome ?? '',
    gofastWithMeBio: initial.gofastWithMeBio ?? '',
    whatYoullSeeHere: initial.whatYoullSeeHere ?? '',
    sportFocus: initial.sportFocus ?? '',
    modelFocus: initial.modelFocus ?? '',
    myAchievements: initial.myAchievements ?? '',
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initial.gofastWithMePhotoUrl ?? null
  );
  const [photoFocus, setPhotoFocus] = useState(initialFocus);
  const [photoType, setPhotoType] = useState<GoFastWithMePhotoType | null>(
    normalizeGoFastWithMePhotoType(initial.gofastWithMePhotoType)
  );
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handlePhotoPick = () => photoInputRef.current?.click();

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert('Image size must be less than 8MB');
      return;
    }
    setPhotoPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPhotoFocus({ x: DEFAULT_PHOTO_FOCUS, y: DEFAULT_PHOTO_FOCUS });
    if (!photoType) setPhotoType('action');
    setPendingPhotoFile(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      let photoUrl = photoPreview?.startsWith('blob:') ? null : photoPreview?.trim() || null;
      if (pendingPhotoFile) {
        const formData = new FormData();
        formData.append('file', pendingPhotoFile);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        const uploadData = (await uploadRes.json()) as {
          success?: boolean;
          url?: string;
          error?: string;
        };
        if (!uploadRes.ok || !uploadData.url) {
          throw new Error(uploadData.error || 'Photo upload failed');
        }
        photoUrl = uploadData.url;
      }

      const payload: GoFastWithMeLandingValues = {
        welcome: values.welcome.trim() || null,
        gofastWithMeBio: values.gofastWithMeBio.trim() || null,
        whatYoullSeeHere: values.whatYoullSeeHere.trim() || null,
        sportFocus: values.sportFocus.trim() || null,
        modelFocus: values.modelFocus.trim() || null,
        myAchievements: values.myAchievements.trim() || null,
        gofastWithMePhotoUrl: photoUrl,
        gofastWithMePhotoFocusX: photoFocus.x,
        gofastWithMePhotoFocusY: photoFocus.y,
        gofastWithMePhotoType: photoType,
      };
      const res = await api.patch('/me/gofast-with-me', payload);
      if (!res.data?.success) {
        throw new Error(res.data?.error || 'Save failed');
      }
      setSuccess(true);
      setPhotoPreview(photoUrl);
      setPendingPhotoFile(null);
      onSaved?.(payload);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const seedBioFromProfile = () => {
    if (profileBio?.trim()) {
      setValues((prev) => ({ ...prev, gofastWithMeBio: profileBio.trim() }));
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-5">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-1">
          Landing / identity
        </h2>
        <p className="text-xs text-gray-600">
          Your profile avatar stays in the header. Attach a run image to show below it on your
          public page.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Run image</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Attach a photo from a run, race, or group outing.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePhotoPick}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          <ImagePlus className="h-4 w-4 text-orange-600" />
          {photoPreview ? 'Replace image' : 'Attach image'}
        </button>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          className="hidden"
        />

        {photoPreview ? (
          <>
            <label className="block">
              <span className="text-sm font-semibold text-gray-900">Photo type</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                {photoTypeGuidance(photoType)}
              </span>
              <select
                value={photoType ?? ''}
                onChange={(e) =>
                  setPhotoType(normalizeGoFastWithMePhotoType(e.target.value) ?? null)
                }
                className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
              >
                <option value="">Choose type…</option>
                {GOFAST_WITH_ME_PHOTO_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <RunImageFocalPicker
              src={photoPreview}
              focusX={photoFocus.x}
              focusY={photoFocus.y}
              photoType={photoType}
              onFocusChange={setPhotoFocus}
            />
          </>
        ) : null}
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-gray-900">Welcome</span>
          <span className="block text-xs text-gray-500 mt-0.5">Invite opener for visitors.</span>
          <textarea
            value={values.welcome}
            onChange={(e) => setValues((v) => ({ ...v, welcome: e.target.value }))}
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gray-900">GoFastWithMe bio</span>
          <span className="block text-xs text-gray-500 mt-0.5">Public-athlete identity copy.</span>
          <textarea
            value={values.gofastWithMeBio}
            onChange={(e) => setValues((v) => ({ ...v, gofastWithMeBio: e.target.value }))}
            rows={4}
            className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          {profileBio?.trim() && !values.gofastWithMeBio.trim() ? (
            <button
              type="button"
              onClick={seedBioFromProfile}
              className="mt-1 text-xs font-medium text-orange-600 hover:text-orange-700"
            >
              Start from profile bio
            </button>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gray-900">What you&apos;ll see here</span>
          <textarea
            value={values.whatYoullSeeHere}
            onChange={(e) => setValues((v) => ({ ...v, whatYoullSeeHere: e.target.value }))}
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-gray-900">Sport focus</span>
            <input
              value={values.sportFocus}
              onChange={(e) => setValues((v) => ({ ...v, sportFocus: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-gray-900">Specific focus (optional)</span>
            <span className="block text-xs text-gray-500 mt-0.5">
              Distance, specialty, or angle: 5K, marathon, trail, nutrition, beginner plans.
            </span>
            <input
              value={values.modelFocus}
              onChange={(e) => setValues((v) => ({ ...v, modelFocus: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-gray-900">My achievements</span>
          <textarea
            value={values.myAchievements}
            onChange={(e) => setValues((v) => ({ ...v, myAchievements: e.target.value }))}
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <p className="text-xs text-gray-500">
        Name, avatar, and profile bio are edited under{' '}
        <Link href="/athlete-edit-profile" className="font-medium text-orange-600 hover:underline">
          Edit profile
        </Link>
        .
      </p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">Saved.</p> : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save landing page'}
      </button>
    </section>
  );
}
