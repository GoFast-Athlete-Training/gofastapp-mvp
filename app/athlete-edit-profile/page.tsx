'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import AthleteAppShell from '@/components/athlete/AthleteAppShell';

const RUNNER_BASE =
  process.env.NEXT_PUBLIC_RUNNER_PHOTO_URL?.replace(/\/$/, '') || 'https://runner.gofastcrushgoals.com';

const TAB_IDS = ['profile-info', 'about-you', 'goal-perf'] as const;
type ProfileTab = (typeof TAB_IDS)[number];

/** Old ?tab= slugs from bookmarks / shared links */
const LEGACY_TAB_MAP: Record<string, ProfileTab> = {
  you: 'profile-info',
  'gofast-page': 'about-you',
  training: 'goal-perf',
};

function tabFromParam(raw: string | null): ProfileTab {
  if (!raw) return 'profile-info';
  if (LEGACY_TAB_MAP[raw]) return LEGACY_TAB_MAP[raw];
  if (TAB_IDS.includes(raw as ProfileTab)) return raw as ProfileTab;
  return 'profile-info';
}

function AthleteEditProfileInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const handleCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [activeTab, setActiveTab] = useState<ProfileTab>(() => tabFromParam(searchParams.get('tab')));

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    birthday: '',
    gender: '',
    city: '',
    state: '',
    primarySport: '',
    gofastHandle: '',
    bio: '',
    instagram: '',
    fiveKPace: '',
    weeklyMileage: '',
    profilePhoto: null as File | null,
    profilePhotoPreview: null as string | null,
    bannerFile: null as File | null,
    bannerPreview: null as string | null,
  });
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [handleError, setHandleError] = useState('');
  const [isGoFastContainer, setIsGoFastContainer] = useState(false);
  const [containerMemberCount, setContainerMemberCount] = useState(0);
  const [containerToggleLoading, setContainerToggleLoading] = useState(false);

  useEffect(() => {
    setActiveTab(tabFromParam(searchParams.get('tab')));
  }, [searchParams]);

  useEffect(() => {
    const raw = searchParams.get('tab');
    if (raw && LEGACY_TAB_MAP[raw]) {
      router.replace(`/athlete-edit-profile?tab=${LEGACY_TAB_MAP[raw]}`, { scroll: false });
    }
  }, [searchParams, router]);

  const setTab = (t: ProfileTab) => {
    setActiveTab(t);
    router.replace(`/athlete-edit-profile?tab=${t}`, { scroll: false });
  };

  useEffect(() => {
    const storedAthleteId = LocalStorageAPI.getAthleteId();
    if (!storedAthleteId) {
      router.replace('/welcome');
      return;
    }
    setAthleteId(storedAthleteId);
    api
      .get(`/athlete/${storedAthleteId}`)
      .then((res) => {
        const stored = res.data?.athlete;
        if (!stored) {
          router.replace('/welcome');
          return;
        }
        setFormData({
          firstName: stored.firstName || '',
          lastName: stored.lastName || '',
          phoneNumber: stored.phoneNumber || '',
          birthday: stored.birthday ? new Date(stored.birthday).toISOString().split('T')[0] : '',
          gender: stored.gender || '',
          city: stored.city || '',
          state: stored.state || '',
          primarySport: stored.primarySport || '',
          gofastHandle: stored.gofastHandle || '',
          bio: stored.bio || '',
          instagram: stored.instagram || '',
          fiveKPace: stored.fiveKPace?.trim() || '',
          weeklyMileage:
            stored.weeklyMileage != null && Number.isFinite(Number(stored.weeklyMileage))
              ? String(stored.weeklyMileage)
              : '',
          profilePhoto: null,
          profilePhotoPreview: stored.photoURL || auth.currentUser?.photoURL || null,
          bannerFile: null,
          bannerPreview: stored.myBestRunPhotoURL || null,
        });
        setIsGoFastContainer(!!stored.isGoFastContainer);
      })
      .catch(() => {
        setError('Error loading profile. Please try again.');
        router.push('/profile');
      })
      .finally(() => setIsLoading(false));
  }, [router]);

  useEffect(() => {
    if (!athleteId || !isGoFastContainer) return;
    api
      .get(`/athlete/${athleteId}/container/members`)
      .then((r) => setContainerMemberCount(r.data?.count ?? 0))
      .catch(() => {});
  }, [athleteId, isGoFastContainer]);

  const handleContainerToggle = async () => {
    if (!athleteId || containerToggleLoading) return;
    setContainerToggleLoading(true);
    setError('');
    try {
      const res = await api.post(`/athlete/${athleteId}/container/toggle`, {
        value: !isGoFastContainer,
      });
      const next = !!res.data?.isGoFastContainer;
      setIsGoFastContainer(next);
      if (next) {
        const m = await api.get(`/athlete/${athleteId}/container/members`);
        setContainerMemberCount(m.data?.count ?? 0);
      } else {
        setContainerMemberCount(0);
      }
      setSuccess(next ? 'GoFast Container is on.' : 'GoFast Container is off.');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; error?: string } } };
      setError(e.response?.data?.message || e.response?.data?.error || 'Could not update container setting.');
    } finally {
      setContainerToggleLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const checkHandleAvailability = useCallback(async (handle: string) => {
    const normalized = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!normalized || normalized.length < 2) {
      setHandleStatus('idle');
      setHandleError('');
      return;
    }
    setHandleStatus('checking');
    setHandleError('');
    try {
      const response = await api.get(`/athlete/check-handle?handle=${normalized}`);
      if (response.data.success) {
        if (response.data.available) {
          setHandleStatus('available');
          setHandleError('');
        } else {
          setHandleStatus('taken');
          setHandleError(`"@${normalized}" is already taken.`);
        }
      }
    } catch {
      setHandleStatus('idle');
    }
  }, []);

  const handleHandleChange = (value: string) => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setFormData((prev) => ({ ...prev, gofastHandle: normalized }));
    if (handleCheckTimeoutRef.current) clearTimeout(handleCheckTimeoutRef.current);
    if (!normalized) {
      setHandleStatus('idle');
      setHandleError('');
      return;
    }
    handleCheckTimeoutRef.current = setTimeout(() => checkHandleAvailability(normalized), 500);
  };

  const handleHandleBlur = () => {
    const handle = formData.gofastHandle.trim().toLowerCase();
    if (handleCheckTimeoutRef.current) {
      clearTimeout(handleCheckTimeoutRef.current);
      handleCheckTimeoutRef.current = null;
    }
    if (handle && handleStatus === 'idle') checkHandleAvailability(handle);
  };

  useEffect(() => {
    return () => {
      if (handleCheckTimeoutRef.current) clearTimeout(handleCheckTimeoutRef.current);
    };
  }, []);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      setFormData((prev) => ({
        ...prev,
        profilePhoto: file,
        profilePhotoPreview: previewUrl,
      }));
    }
  };

  const handleImageClick = () => fileInputRef.current?.click();

  const handleBannerUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        alert('Image size must be less than 8MB');
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      setFormData((prev) => ({
        ...prev,
        bannerFile: file,
        bannerPreview: previewUrl,
      }));
    }
  };

  const handleBannerClick = () => bannerInputRef.current?.click();

  const beginSave = () => {
    setError('');
    setSuccess('');
  };

  const saveProfileInfoTab = async () => {
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.gofastHandle ||
      !formData.birthday ||
      !formData.gender ||
      !formData.city ||
      !formData.state
    ) {
      setError('Fill in all required fields on this tab.');
      return;
    }
    if (handleStatus === 'taken') {
      setError('Choose a different handle.');
      return;
    }
    if (!athleteId) {
      setError('Athlete ID not found.');
      return;
    }
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setError('Sign in to save.');
      return;
    }

    beginSave();
    setLoading(true);
    try {
      const photoURL = formData.profilePhotoPreview || firebaseUser.photoURL || null;
      await api.put(`/athlete/${athleteId}/profile`, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber || null,
        gofastHandle: formData.gofastHandle.trim().toLowerCase(),
        birthday: formData.birthday,
        gender: formData.gender,
        city: formData.city,
        state: formData.state,
        photoURL,
      });
      setSuccess('Profile Info — saved.');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { field?: string; message?: string; error?: string } } };
      if (e.response?.data?.field === 'gofastHandle') {
        setError(`Handle @"${formData.gofastHandle}" is taken.`);
      } else {
        setError(e.response?.data?.message || e.response?.data?.error || 'Save failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveAboutYouTab = async () => {
    if (!athleteId) {
      setError('Athlete ID not found.');
      return;
    }
    beginSave();
    setLoading(true);
    try {
      const bannerURL = formData.bannerPreview || null;
      await api.put(`/athlete/${athleteId}/profile`, {
        myBestRunPhotoURL: bannerURL,
        bio: formData.bio || null,
        instagram: formData.instagram.trim() || null,
      });
      setSuccess('About You — saved.');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; error?: string } } };
      setError(e.response?.data?.message || e.response?.data?.error || 'Save failed.');
    } finally {
      setLoading(false);
    }
  };

  const saveGoalPerfTab = async () => {
    if (!athleteId) {
      setError('Athlete ID not found.');
      return;
    }
    beginSave();
    setLoading(true);
    try {
      await api.put(`/athlete/${athleteId}/profile`, {
        primarySport: formData.primarySport.trim() || null,
        fiveKPace: formData.fiveKPace.trim() || null,
        weeklyMileage: (() => {
          const t = formData.weeklyMileage.trim();
          if (!t) return null;
          const n = Number(t);
          return Number.isFinite(n) ? n : null;
        })(),
      });
      setSuccess('Goal & Performance — saved.');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; error?: string } } };
      setError(e.response?.data?.message || e.response?.data?.error || 'Save failed.');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AthleteAppShell>
        <div className="flex min-h-[50vh] items-center justify-center px-6 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </AthleteAppShell>
    );
  }

  const liveGoFastUrl = formData.gofastHandle ? `${RUNNER_BASE}/${formData.gofastHandle}` : null;

  const sectionMeta: Record<ProfileTab, { title: string; subtitle: string }> = {
    'profile-info': {
      title: 'Profile Info',
      subtitle:
        'Profile photo, name, GoFast handle, birthday, gender, phone, and city. Save when you’re done with this section.',
    },
    'about-you': {
      title: 'About You',
      subtitle:
        'Public hero banner, bio, Instagram, and optional GoFast Container. These fields shape how the world sees you.',
    },
    'goal-perf': {
      title: 'Goal & Performance',
      subtitle:
        'Primary sport, 5K pace, and weekly mileage help tune workouts and pacing in the app.',
    },
  };

  const sectionNavItem = (id: ProfileTab, label: string, hint: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`w-full rounded-r-lg border-l-[3px] px-3 py-3 text-left transition-colors ${
        activeTab === id
          ? 'border-orange-500 bg-white text-gray-900 shadow-sm'
          : 'border-transparent text-gray-600 hover:bg-white/60 hover:text-gray-900'
      }`}
    >
      <span className={`block text-sm ${activeTab === id ? 'font-semibold' : 'font-medium'}`}>{label}</span>
      <span className="mt-0.5 block text-xs text-gray-500 leading-snug">{hint}</span>
    </button>
  );

  return (
    <AthleteAppShell>
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push('/profile')}
            className="text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            ← Back to profile
          </button>
          {liveGoFastUrl ? (
            <a
              href={liveGoFastUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              See your GoFast Page →
            </a>
          ) : null}
        </div>

        <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg md:min-h-[580px] md:flex-row">
          <aside className="shrink-0 border-b border-gray-200 bg-gradient-to-b from-gray-50 to-gray-50/90 md:w-64 md:border-b-0 md:border-r md:border-gray-200 md:bg-gray-50">
            <div className="sticky top-0 p-3 sm:p-4">
              <p className="mb-2 hidden px-1 text-xs font-bold uppercase tracking-wider text-gray-400 md:block">
                Sections
              </p>
              <nav className="flex flex-col gap-0.5" aria-label="Profile sections">
                {sectionNavItem('profile-info', 'Profile Info', 'Photo, name & account')}
                {sectionNavItem('about-you', 'About You', 'Public page & banner')}
                {sectionNavItem('goal-perf', 'Goal & Performance', 'Sport, pace & mileage')}
              </nav>
            </div>
          </aside>

          <div className="min-w-0 flex-1 p-5 sm:p-8">
            <header className="mb-6 border-b border-gray-100 pb-4">
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{sectionMeta[activeTab].title}</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{sectionMeta[activeTab].subtitle}</p>
            </header>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800 text-sm whitespace-pre-line">{error}</p>
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-green-800 text-sm">{success}</p>
              </div>
            )}

            {activeTab === 'profile-info' && (
            <div className="space-y-5">
              <div className="text-center">
                <div
                  className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-2 flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors overflow-hidden"
                  onClick={handleImageClick}
                >
                  {formData.profilePhotoPreview ? (
                    <img
                      src={formData.profilePhotoPreview}
                      alt=""
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl">📷</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleImageClick}
                  className="text-orange-600 text-sm font-medium hover:text-orange-700"
                >
                  {formData.profilePhotoPreview ? 'Change photo' : 'Add photo'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GoFast handle <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">@</span>
                  <input
                    type="text"
                    value={formData.gofastHandle}
                    onChange={(e) => handleHandleChange(e.target.value)}
                    onBlur={handleHandleBlur}
                    className={`w-full pl-8 pr-3 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 ${
                      handleStatus === 'taken'
                        ? 'border-red-500'
                        : handleStatus === 'available'
                          ? 'border-green-500'
                          : 'border-gray-300'
                    }`}
                    disabled={loading}
                  />
                </div>
                {handleStatus === 'checking' && <p className="text-xs text-gray-500 mt-1">Checking…</p>}
                {handleError && <p className="text-xs text-red-600 mt-1">{handleError}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Birthday <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.birthday}
                  onChange={(e) => handleInputChange('birthday', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      checked={formData.gender === 'male'}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      className="mr-2"
                      disabled={loading}
                    />
                    Male
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      checked={formData.gender === 'female'}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      className="mr-2"
                      disabled={loading}
                    />
                    Female
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    maxLength={2}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 uppercase"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => router.push('/profile')}
                  className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveProfileInfoTab}
                  disabled={loading || handleStatus === 'taken'}
                  className="flex-1 bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Save profile info'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'about-you' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Banner photo</h3>
                <p className="text-xs text-gray-600 mb-3">
                  Large hero on your public GoFast Page. Separate from your profile circle.
                </p>
                <button
                  type="button"
                  onClick={handleBannerClick}
                  className="w-full aspect-[21/9] max-h-36 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center hover:bg-gray-300"
                >
                  {formData.bannerPreview ? (
                    <img src={formData.bannerPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-500 text-sm">Tap to add banner</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleBannerClick}
                  className="mt-2 text-orange-600 text-sm font-medium"
                >
                  {formData.bannerPreview ? 'Change banner' : 'Add banner'}
                </button>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerUpload}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio (public)</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  maxLength={250}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">{formData.bio.length}/250</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                <input
                  type="text"
                  value={formData.instagram}
                  onChange={(e) => handleInputChange('instagram', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  disabled={loading}
                />
              </div>

              <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isGoFastContainer}
                    disabled={containerToggleLoading || !athleteId || loading}
                    onChange={() => void handleContainerToggle()}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span>
                    <span className="font-semibold text-gray-900">GoFast Container</span>
                    <p className="text-xs text-gray-600 mt-1">
                      Optional: turn your public page into a small community — your upcoming runs appear automatically,
                      and members can chat in one feed. You moderate as the host.
                    </p>
                  </span>
                </label>
                {isGoFastContainer ? (
                  <div className="mt-3 pl-7 text-sm text-gray-700">
                    <p>
                      {containerMemberCount} member{containerMemberCount !== 1 ? 's' : ''}
                      {containerToggleLoading ? '…' : ''}
                    </p>
                    {formData.gofastHandle ? (
                      <Link
                        href={`/container/${encodeURIComponent(formData.gofastHandle)}`}
                        className="inline-block mt-2 font-semibold text-orange-600 hover:text-orange-700"
                      >
                        Open container hub →
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/profile/gofast-page"
                  className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Preview in app
                </Link>
                {liveGoFastUrl ? (
                  <a
                    href={liveGoFastUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 rounded-lg border border-orange-200 text-sm font-semibold text-orange-800 hover:bg-orange-50"
                  >
                    View live GoFast Page
                  </a>
                ) : null}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => router.push('/profile')}
                  className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveAboutYouTab}
                  disabled={loading}
                  className="flex-1 bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Save about you'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'goal-perf' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary sport <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  value={formData.primarySport}
                  onChange={(e) => handleInputChange('primarySport', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  disabled={loading}
                >
                  <option value="">Select…</option>
                  <option value="running">Running</option>
                  <option value="cycling">Cycling</option>
                  <option value="swimming">Swimming</option>
                  <option value="triathlon">Triathlon</option>
                  <option value="ultra-racing">Ultra racing</option>
                  <option value="hiking">Hiking</option>
                  <option value="trail-running">Trail running</option>
                  <option value="track-field">Track & field</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current 5K pace</label>
                <input
                  type="text"
                  value={formData.fiveKPace}
                  onChange={(e) => handleInputChange('fiveKPace', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weekly mileage</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={formData.weeklyMileage}
                  onChange={(e) => handleInputChange('weeklyMileage', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  disabled={loading}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => router.push('/profile')}
                  className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveGoalPerfTab}
                  disabled={loading}
                  className="flex-1 bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Save goal & performance'}
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </AthleteAppShell>
  );
}

export default function AthleteEditProfilePage() {
  return (
    <Suspense
      fallback={
        <AthleteAppShell>
          <div className="flex min-h-[50vh] items-center justify-center px-6 py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
          </div>
        </AthleteAppShell>
      }
    >
      <AthleteEditProfileInner />
    </Suspense>
  );
}
