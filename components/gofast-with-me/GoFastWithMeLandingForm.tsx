'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { CheckCircle2, ImagePlus, Loader2, User } from 'lucide-react';
import api from '@/lib/api';
import {
  DEFAULT_PHOTO_FOCUS,
  DEFAULT_PHOTO_ZOOM,
  normalizePhotoFocus,
  clampPhotoZoom,
  type PhotoFocus,
} from '@/lib/gofast-with-me/photo-focus';
import type { GoFastWithMePhotoType } from '@/lib/gofast-with-me/photo-type';
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
  gofastWithMePhotoZoom: number | null;
  gofastWithMePhotoType: GoFastWithMePhotoType | null;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type Props = {
  initial: GoFastWithMeLandingValues;
  profileBio?: string | null;
  profilePhotoURL?: string | null;
  athleteId?: string | null;
  onSaved?: (values: GoFastWithMeLandingValues) => void;
  onAvatarSaved?: (photoURL: string | null) => void;
};

const AUTOSAVE_MS = 900;
const SAVED_FLASH_MS = 3000;

function buildPayload(
  values: {
    welcome: string;
    gofastWithMeBio: string;
    whatYoullSeeHere: string;
    sportFocus: string;
    modelFocus: string;
    myAchievements: string;
  },
  photoUrl: string | null,
  photoFocus: PhotoFocus,
  photoZoom: number
): GoFastWithMeLandingValues {
  const photoType: GoFastWithMePhotoType = 'action';
  return {
    welcome: values.welcome.trim() || null,
    gofastWithMeBio: values.gofastWithMeBio.trim() || null,
    whatYoullSeeHere: values.whatYoullSeeHere.trim() || null,
    sportFocus: values.sportFocus.trim() || null,
    modelFocus: values.modelFocus.trim() || null,
    myAchievements: values.myAchievements.trim() || null,
    gofastWithMePhotoUrl: photoUrl,
    gofastWithMePhotoFocusX: photoFocus.x,
    gofastWithMePhotoFocusY: photoFocus.y,
    gofastWithMePhotoZoom: photoZoom,
    gofastWithMePhotoType: photoUrl ? photoType : null,
  };
}

function LandingSaveStatus({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
        Saving…
      </span>
    );
  }

  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Saved
      </span>
    );
  }

  if (status === 'error' && error) {
    return (
      <span
        className="inline-flex max-w-[14rem] items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 truncate"
        title={error}
      >
        {error}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500">
      Auto-save on
    </span>
  );
}

export default function GoFastWithMeLandingForm({
  initial,
  profileBio,
  profilePhotoURL,
  athleteId,
  onSaved,
  onAvatarSaved,
}: Props) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
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
  const [photoZoom, setPhotoZoom] = useState(clampPhotoZoom(initial.gofastWithMePhotoZoom));
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profilePhotoURL ?? null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMountRef = useRef(true);
  const savedFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef(false);
  const pendingResaveRef = useRef(false);

  const valuesRef = useRef(values);
  const photoPreviewRef = useRef(photoPreview);
  const photoFocusRef = useRef(photoFocus);
  const photoZoomRef = useRef(photoZoom);
  const pendingPhotoFileRef = useRef(pendingPhotoFile);
  const avatarPreviewRef = useRef(avatarPreview);
  const pendingAvatarFileRef = useRef(pendingAvatarFile);

  valuesRef.current = values;
  photoPreviewRef.current = photoPreview;
  photoFocusRef.current = photoFocus;
  photoZoomRef.current = photoZoom;
  pendingPhotoFileRef.current = pendingPhotoFile;
  avatarPreviewRef.current = avatarPreview;
  pendingAvatarFileRef.current = pendingAvatarFile;

  const clearSavedFlash = useCallback(() => {
    if (savedFlashRef.current) {
      clearTimeout(savedFlashRef.current);
      savedFlashRef.current = null;
    }
  }, []);

  const flashSaved = useCallback(() => {
    clearSavedFlash();
    setSaveStatus('saved');
    savedFlashRef.current = setTimeout(() => {
      setSaveStatus('idle');
      savedFlashRef.current = null;
    }, SAVED_FLASH_MS);
  }, [clearSavedFlash]);

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
    const uploadData = (await uploadRes.json()) as {
      success?: boolean;
      url?: string;
      error?: string;
    };
    if (!uploadRes.ok || !uploadData.url) {
      throw new Error(uploadData.error || 'Photo upload failed');
    }
    return uploadData.url;
  };

  const performSave = useCallback(async () => {
    if (saveInFlightRef.current) {
      pendingResaveRef.current = true;
      return;
    }

    saveInFlightRef.current = true;
    pendingResaveRef.current = false;
    setSaveStatus('saving');
    setError(null);

    try {
      const currentValues = valuesRef.current;
      let photoUrl = photoPreviewRef.current?.startsWith('blob:')
        ? null
        : photoPreviewRef.current?.trim() || null;
      const pendingPhoto = pendingPhotoFileRef.current;
      if (pendingPhoto) {
        photoUrl = await uploadFile(pendingPhoto);
      }

      let nextAvatarUrl = avatarPreviewRef.current?.startsWith('blob:')
        ? null
        : avatarPreviewRef.current?.trim() || null;
      const pendingAvatar = pendingAvatarFileRef.current;
      if (pendingAvatar) {
        nextAvatarUrl = await uploadFile(pendingAvatar);
        if (!athleteId) throw new Error('Missing athlete id for profile photo');
        await api.put(`/athlete/${athleteId}/profile`, { photoURL: nextAvatarUrl });
        setAvatarPreview(nextAvatarUrl);
        setPendingAvatarFile(null);
        onAvatarSaved?.(nextAvatarUrl);
      }

      const payload = buildPayload(
        currentValues,
        photoUrl,
        photoFocusRef.current,
        photoZoomRef.current
      );
      const res = await api.patch('/me/gofast-with-me', payload);
      if (!res.data?.success) {
        throw new Error(res.data?.error || 'Save failed');
      }

      setPhotoPreview(photoUrl);
      setPendingPhotoFile(null);
      onSaved?.(payload);
      flashSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      const message = e.response?.data?.error || e.message || 'Save failed';
      setError(message);
      setSaveStatus('error');
    } finally {
      saveInFlightRef.current = false;
      if (pendingResaveRef.current) {
        void performSave();
      }
    }
  }, [athleteId, flashSaved, onAvatarSaved, onSaved]);

  const scheduleAutosave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void performSave();
    }, AUTOSAVE_MS);
  }, [performSave]);

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    scheduleAutosave();
  }, [values, photoFocus, photoZoom, pendingPhotoFile, pendingAvatarFile, scheduleAutosave]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      clearSavedFlash();
    };
  }, [clearSavedFlash]);

  const handlePhotoPick = () => photoInputRef.current?.click();
  const handleAvatarPick = () => avatarInputRef.current?.click();

  const validateImageFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) return 'Please select a valid image file';
    if (file.size > 8 * 1024 * 1024) return 'Image size must be less than 8MB';
    return null;
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      alert(validationError);
      return;
    }
    setPhotoPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPhotoFocus({ x: DEFAULT_PHOTO_FOCUS, y: DEFAULT_PHOTO_FOCUS });
    setPhotoZoom(DEFAULT_PHOTO_ZOOM);
    setPendingPhotoFile(file);
    setSaveStatus('idle');
    setError(null);
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      alert(validationError);
      return;
    }
    setAvatarPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPendingAvatarFile(file);
    setSaveStatus('idle');
    setError(null);
  };

  const seedBioFromProfile = () => {
    if (profileBio?.trim()) {
      setValues((prev) => ({ ...prev, gofastWithMeBio: profileBio.trim() }));
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-1">
            Landing / identity
          </h2>
          <p className="text-xs text-gray-600">
            Profile picture sits in the banner. Run image is the feature photo visitors see below it.
          </p>
        </div>
        <LandingSaveStatus status={saveStatus} error={error} />
      </div>

      <div className="space-y-5 p-4">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Profile picture</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Shown in the banner — use a runner photo if you want it more like you on the road.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {avatarPreview ? (
              <Image
                src={avatarPreview}
                alt=""
                width={72}
                height={72}
                className="h-[72px] w-[72px] rounded-full object-cover border border-gray-200"
                unoptimized
              />
            ) : (
              <div className="h-[72px] w-[72px] rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
                <User className="h-8 w-8 text-gray-400" />
              </div>
            )}
            <button
              type="button"
              onClick={handleAvatarPick}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              <ImagePlus className="h-4 w-4 text-orange-600" />
              {avatarPreview ? 'Replace photo' : 'Add photo'}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Run image</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Attach a photo from a run, race, or group outing.
            </p>
          </div>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />

          {photoPreview ? (
            <RunImageFocalPicker
              src={photoPreview}
              focusX={photoFocus.x}
              focusY={photoFocus.y}
              zoom={photoZoom}
              photoType="action"
              onFocusChange={setPhotoFocus}
              onZoomChange={setPhotoZoom}
            />
          ) : null}

          <button
            type="button"
            onClick={handlePhotoPick}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            <ImagePlus className="h-4 w-4 text-orange-600" />
            {photoPreview ? 'Replace image' : 'Attach image'}
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-gray-900">Welcome</span>
            <span className="block text-xs text-gray-500 mt-0.5">
              Short opener when someone lands on your page.
            </span>
            <textarea
              value={values.welcome}
              onChange={(e) => {
                setValues((v) => ({ ...v, welcome: e.target.value }));
                setSaveStatus('idle');
                setError(null);
              }}
              rows={3}
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-gray-900">About you</span>
            <span className="block text-xs text-gray-500 mt-0.5">
              Describe yourself so people know what kind of runner you are and why they should follow.
            </span>
            <textarea
              value={values.gofastWithMeBio}
              onChange={(e) => {
                setValues((v) => ({ ...v, gofastWithMeBio: e.target.value }));
                setSaveStatus('idle');
                setError(null);
              }}
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
            <span className="text-sm font-semibold text-gray-900">What you&apos;ll see</span>
            <span className="block text-xs text-gray-500 mt-0.5">
              What kinds of content you&apos;ll post — plan updates, race notes, training tips, and so on.
            </span>
            <textarea
              value={values.whatYoullSeeHere}
              onChange={(e) => {
                setValues((v) => ({ ...v, whatYoullSeeHere: e.target.value }));
                setSaveStatus('idle');
                setError(null);
              }}
              rows={3}
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-gray-900">Sport focus</span>
              <input
                value={values.sportFocus}
                onChange={(e) => {
                  setValues((v) => ({ ...v, sportFocus: e.target.value }));
                  setSaveStatus('idle');
                  setError(null);
                }}
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
                onChange={(e) => {
                  setValues((v) => ({ ...v, modelFocus: e.target.value }));
                  setSaveStatus('idle');
                  setError(null);
                }}
                className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-gray-900">My achievements</span>
            <textarea
              value={values.myAchievements}
              onChange={(e) => {
                setValues((v) => ({ ...v, myAchievements: e.target.value }));
                setSaveStatus('idle');
                setError(null);
              }}
              rows={3}
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">Changes save automatically as you edit.</p>
          <LandingSaveStatus status={saveStatus} error={error} />
        </div>
      </div>
    </section>
  );
}
