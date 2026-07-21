'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { User } from 'lucide-react';
import api from '@/lib/api';
import {
  GOFAST_WITH_ME_PHOTO_TYPE_OPTIONS,
  normalizeGoFastWithMePhotoType,
  photoTypeGuidance,
  usesWideFeaturePhotoLayout,
  type GoFastWithMePhotoType,
} from '@/lib/gofast-with-me/photo-type';

export type GoFastWithMeLandingValues = {
  welcome: string | null;
  gofastWithMeBio: string | null;
  whatYoullSeeHere: string | null;
  sportFocus: string | null;
  modelFocus: string | null;
  myAchievements: string | null;
  gofastWithMePhotoUrl: string | null;
  gofastWithMePhotoType: GoFastWithMePhotoType | null;
};

type Props = {
  initial: GoFastWithMeLandingValues;
  profileBio?: string | null;
  profilePhotoUrl?: string | null;
  displayName?: string;
  gofastHandle?: string | null;
  onSaved?: (values: GoFastWithMeLandingValues) => void;
};

function LandingPagePreview({
  displayName,
  gofastHandle,
  profilePhotoUrl,
  pagePhotoUrl,
  photoType,
}: {
  displayName: string;
  gofastHandle: string | null;
  profilePhotoUrl: string | null;
  pagePhotoUrl: string | null;
  photoType: GoFastWithMePhotoType | null;
}) {
  const wideFeature = usesWideFeaturePhotoLayout(pagePhotoUrl, photoType);

  return (
    <div className="rounded-xl border border-sky-200 bg-gray-50 overflow-hidden">
      <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-sky-700 bg-sky-50 border-b border-sky-100">
        Public page preview
      </p>
      <div className="bg-gradient-to-r from-sky-400 via-sky-500 to-sky-600 px-4 py-4">
        <div className="flex items-start gap-3">
          {profilePhotoUrl ? (
            <img
              src={profilePhotoUrl}
              alt=""
              className="w-12 h-12 rounded-full object-cover ring-2 ring-white shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shrink-0">
              <User className="w-6 h-6 text-sky-600" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-100">
              GoFastWithMe
            </p>
            <p className="text-sm font-bold text-white truncate">{displayName}</p>
            {gofastHandle ? (
              <p className="text-xs text-sky-100">@{gofastHandle}</p>
            ) : null}
          </div>
        </div>
      </div>
      {pagePhotoUrl ? (
        wideFeature ? (
          <div className="aspect-[16/7] bg-sky-100">
            <img src={pagePhotoUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="p-4 flex justify-center bg-white">
            <img
              src={pagePhotoUrl}
              alt=""
              className="w-28 h-28 rounded-2xl object-cover shadow-md border border-gray-200"
            />
          </div>
        )
      ) : (
        <div className="px-4 py-6 text-center text-xs text-gray-500 bg-white">
          Page photo appears here after upload
        </div>
      )}
    </div>
  );
}

export default function GoFastWithMeLandingForm({
  initial,
  profileBio,
  profilePhotoUrl = null,
  displayName = 'Your name',
  gofastHandle = null,
  onSaved,
}: Props) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState({
    welcome: initial.welcome ?? '',
    gofastWithMeBio: initial.gofastWithMeBio ?? '',
    whatYoullSeeHere: initial.whatYoullSeeHere ?? '',
    sportFocus: initial.sportFocus ?? '',
    modelFocus: initial.modelFocus ?? '',
    myAchievements: initial.myAchievements ?? '',
  });
  const [photoType, setPhotoType] = useState<GoFastWithMePhotoType | ''>(
    initial.gofastWithMePhotoType ?? ''
  );
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initial.gofastWithMePhotoUrl ?? null
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
    setPendingPhotoFile(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const normalizedType = normalizeGoFastWithMePhotoType(photoType || null);
      if (photoPreview && !normalizedType) {
        throw new Error('Choose what kind of page photo this is before saving.');
      }

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
        gofastWithMePhotoType: normalizedType,
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

  const selectedType = normalizeGoFastWithMePhotoType(photoType || null);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-5">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-1">
          Landing / identity
        </h2>
        <p className="text-xs text-gray-600">
          Build the first thing visitors see on your public page. Your profile avatar stays separate
          from the page photo below.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Page photo</h3>
            <p className="text-xs text-gray-500 mb-3">
              What kind of photo is this? Action, group, and race photos work best as the wide page
              image. Headshots belong on your profile unless you intentionally want a portrait here.
            </p>

            <fieldset className="space-y-2 mb-4">
              <legend className="sr-only">Photo type</legend>
              {GOFAST_WITH_ME_PHOTO_TYPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer ${
                    photoType === option.value
                      ? 'border-orange-300 bg-orange-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="gofastWithMePhotoType"
                    value={option.value}
                    checked={photoType === option.value}
                    onChange={() => setPhotoType(option.value)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                    <span className="block text-xs text-gray-500 mt-0.5">{option.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {selectedType ? (
              <p className="text-xs text-gray-600 mb-3">{photoTypeGuidance(selectedType)}</p>
            ) : null}

            <button
              type="button"
              onClick={handlePhotoPick}
              disabled={!photoType}
              className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center hover:border-orange-300 hover:bg-orange-50/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt=""
                  className={`mx-auto object-cover ${
                    selectedType === 'portrait'
                      ? 'w-32 h-32 rounded-2xl'
                      : 'w-full max-h-40 rounded-lg aspect-[16/7]'
                  }`}
                />
              ) : (
                <span className="text-gray-500 text-sm">
                  {photoType ? 'Upload page photo' : 'Choose a photo type first'}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handlePhotoPick}
              disabled={!photoType}
              className="mt-2 text-orange-600 text-sm font-medium disabled:opacity-50"
            >
              {photoPreview ? 'Change photo' : 'Upload photo'}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>
        </div>

        <LandingPagePreview
          displayName={displayName}
          gofastHandle={gofastHandle}
          profilePhotoUrl={profilePhotoUrl}
          pagePhotoUrl={photoPreview}
          photoType={selectedType}
        />
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
