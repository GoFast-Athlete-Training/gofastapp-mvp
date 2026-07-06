'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import { clubManagerActivatePath } from '@/lib/club-manager-paths';

type ProfileStep = 'intro' | 'form' | 'success';

export default function AthleteCreateProfilePage() {
  const router = useRouter();
  const [step, setStep] = useState<ProfileStep>('intro');
  const [nextRouteAfterSuccess, setNextRouteAfterSuccess] = useState<string>('/goals');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    birthday: '',
    gender: '',
    city: '',
    state: '',
    gofastHandle: '',
    primarySport: '',
    fiveKPaceMinutes: '',
    fiveKPaceSeconds: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [handleError, setHandleError] = useState('');
  const handleCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const firebaseUser = auth.currentUser;
    const storedAthleteId = LocalStorageAPI.getAthleteId();

    if (firebaseUser) {
      const displayName = firebaseUser.displayName || '';
      const firstNameFromFirebase = displayName.split(' ')[0] || '';
      const lastNameFromFirebase = displayName.split(' ').slice(1).join(' ') || '';

      console.log('🔄 PROFILE CREATE: Stored athleteId:', storedAthleteId);

      setFormData((prev) => ({
        ...prev,
        email: firebaseUser.email || '',
        firstName: firstNameFromFirebase || prev.firstName,
        lastName: lastNameFromFirebase || prev.lastName,
      }));
    }
  }, []);

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
          setHandleError(`"@${normalized}" is already taken. Please choose a different handle.`);
        }
      }
    } catch {
      setHandleStatus('idle');
    }
  }, []);

  const handleHandleChange = (value: string) => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, '');

    setFormData((prev) => ({ ...prev, gofastHandle: normalized }));

    if (handleCheckTimeoutRef.current) {
      clearTimeout(handleCheckTimeoutRef.current);
    }

    if (!normalized) {
      setHandleStatus('idle');
      setHandleError('');
      return;
    }

    handleCheckTimeoutRef.current = setTimeout(() => {
      checkHandleAvailability(normalized);
    }, 500);
  };

  const handleHandleBlur = () => {
    const handle = formData.gofastHandle.trim().toLowerCase();

    if (handleCheckTimeoutRef.current) {
      clearTimeout(handleCheckTimeoutRef.current);
      handleCheckTimeoutRef.current = null;
    }

    if (handle && handleStatus === 'idle') {
      checkHandleAvailability(handle);
    }
  };

  useEffect(() => {
    return () => {
      if (handleCheckTimeoutRef.current) {
        clearTimeout(handleCheckTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.gofastHandle ||
      !formData.birthday ||
      !formData.gender ||
      !formData.primarySport ||
      !formData.city ||
      !formData.state
    ) {
      setError('Please fill in all required fields');
      return;
    }

    if (handleStatus === 'taken') {
      setError('Please choose a different handle. The current handle is already taken.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        setError('No user logged in. Please sign in first.');
        setLoading(false);
        return;
      }

      let athleteId: string | null = null;
      try {
        const meRes = await api.get('/athlete/me');
        athleteId = meRes.data?.athleteId || null;
      } catch (meErr: any) {
        if (meErr?.response?.status !== 404) {
          throw meErr;
        }
      }

      if (!athleteId) {
        const res = await api.post('/athlete/create', {});
        const athleteData = res.data;

        athleteId = athleteData.athleteId || athleteData.data?.id;
        if (!athleteId) {
          throw new Error('No athlete ID returned from server');
        }
      }
      LocalStorageAPI.setAthleteId(athleteId);

      const photoURL = firebaseUser.photoURL || null;

      await api.put(`/athlete/${athleteId}/profile`, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        gofastHandle: formData.gofastHandle.trim().toLowerCase(),
        birthday: formData.birthday,
        gender: formData.gender,
        city: formData.city,
        state: formData.state,
        primarySport: formData.primarySport || null,
        fiveKPace:
          formData.fiveKPaceMinutes && formData.fiveKPaceSeconds
            ? `${parseInt(formData.fiveKPaceMinutes, 10)}:${formData.fiveKPaceSeconds.padStart(2, '0')}`
            : null,
        photoURL,
      });

      let nextPath = '/welcome';
      if (LocalStorageAPI.getClubManagerMode()) {
        const activationToken = LocalStorageAPI.getClubManagerActivationToken();
        nextPath = activationToken ? clubManagerActivatePath(activationToken) : '/welcome-club-owner';
      } else {
        const createCrewIntent = LocalStorageAPI.getRunCrewCreateIntent();
        if (createCrewIntent) {
          LocalStorageAPI.removeRunCrewCreateIntent();
          nextPath = '/runcrew/create';
        } else {
          const raceHubJoinIntent = localStorage.getItem('raceHubJoinIntent');
          const raceHubJoinIntentSlug = localStorage.getItem('raceHubJoinIntentSlug');
          if (raceHubJoinIntent && raceHubJoinIntentSlug) {
            nextPath = `/join/race/${encodeURIComponent(raceHubJoinIntentSlug)}/confirm`;
          } else {
            const joinIntent = localStorage.getItem('runCrewJoinIntent');
            const joinIntentHandle = localStorage.getItem('runCrewJoinIntentHandle');
            if (joinIntent && joinIntentHandle) {
              nextPath = `/join/runcrew/${joinIntentHandle}/confirm`;
            }
          }
        }
      }
      setNextRouteAfterSuccess(nextPath);
      setLoading(false);
      setStep('success');
    } catch (err: unknown) {
      console.error('❌ Profile creation failed:', err);
      setLoading(false);

      const anyErr = err as { response?: { data?: unknown; status?: number } };
      const errorData = anyErr.response?.data as
        | { error?: string; message?: string; field?: string }
        | undefined;

      if (errorData?.error) {
        if (errorData.field === 'gofastHandle') {
          setError(
            `❌ Handle taken!\n\n"@${formData.gofastHandle}" is already taken. Please choose a different handle.`
          );
        } else {
          setError(`❌ Profile update failed:\n\n${errorData.message || errorData.error}`);
        }
      } else if (anyErr.response?.status === 403) {
        setError('❌ Forbidden!\n\nYou can only update your own profile. Please sign in with the correct account.');
      } else if (anyErr.response?.status === 404) {
        setError('❌ Profile not found!\n\nYour athlete record was not found. Please try signing in again.');
      } else {
        setError(`❌ Profile creation failed:\n\n${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  };

  const handleContinueAfterSuccess = () => {
    router.push(nextRouteAfterSuccess);
  };

  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <Image
              src="/logo.jpg"
              alt="GoFast"
              width={64}
              height={64}
              className="w-16 h-16 rounded-full mx-auto mb-4"
            />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              You&apos;re an athlete. Let&apos;s set up your GoFast profile.
            </h1>
            <p className="text-gray-600 text-sm">
              A few details help us personalize your training, runs, and races from day one.
            </p>
          </div>

          <ul className="space-y-4 mb-8 text-left text-gray-700 text-sm">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-lg">
                @
              </span>
              <span>
                <strong className="text-gray-900">Your GoFast handle</strong> creates your public page and how others
                find you.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-lg">
                📍
              </span>
              <span>
                <strong className="text-gray-900">City and state</strong> help surface nearby community runs and races
                that fit you.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-lg">
                🏃
              </span>
              <span>
                <strong className="text-gray-900">Sport and 5K pace</strong> power your training plan and pace zones
                from the start.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-lg">
                🎂
              </span>
              <span>
                <strong className="text-gray-900">Birthday</strong> is used for age-group context and results where
                relevant.
              </span>
            </li>
          </ul>

          <button
            type="button"
            onClick={() => setStep('form')}
            className="w-full bg-orange-500 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-orange-600 transition-colors shadow-lg"
          >
            Set up my profile →
          </button>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <Image
              src="/logo.jpg"
              alt="GoFast"
              width={64}
              height={64}
              className="w-16 h-16 rounded-full mx-auto mb-4"
            />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              You&apos;re in! Here&apos;s what&apos;s waiting for you
            </h1>
            <p className="text-gray-600 text-sm">
              Your GoFast home is where everything comes together.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
              <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-xl shadow-sm">
                📋
              </span>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">Training dashboard</h3>
                <p className="text-xs text-gray-600 leading-snug">
                  Next session, race countdown, and goal pace — at a glance.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
              <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-xl shadow-sm">
                👥
              </span>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">Find a run with others</h3>
                <p className="text-xs text-gray-600 leading-snug">
                  Browse and RSVP to community runs near you.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
              <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-xl shadow-sm">
                🏁
              </span>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">Discover races</h3>
                <p className="text-xs text-gray-600 leading-snug">
                  Search the race registry and set goal times.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
              <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-xl shadow-sm">
                ⏱️
              </span>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">Track your progress</h3>
                <p className="text-xs text-gray-600 leading-snug">
                  Log workouts and watch your pace improve over time.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleContinueAfterSuccess}
            className="w-full bg-orange-500 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-orange-600 transition-colors shadow-lg"
          >
            Let&apos;s go →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <Image
            src="/logo.jpg"
            alt="GoFast"
            width={64}
            height={64}
            className="w-16 h-16 rounded-full mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to GoFast</h1>
          <p className="text-gray-600 text-sm">
            Set up your athlete profile — handle, location, sport, and pace. Add bio and your public GoFast Page
            later from Profile.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm whitespace-pre-line">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              readOnly
              className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GoFast handle <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Your public URL is <span className="font-medium">runner…/@[handle]</span>. Letters, numbers, underscore
              only.
            </p>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 text-sm">@</span>
              </div>
              <input
                type="text"
                value={formData.gofastHandle}
                onChange={(e) => handleHandleChange(e.target.value)}
                onBlur={handleHandleBlur}
                className={`w-full pl-8 pr-3 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                  handleStatus === 'taken'
                    ? 'border-red-500'
                    : handleStatus === 'available'
                      ? 'border-green-500'
                      : 'border-gray-300'
                }`}
                required
                disabled={loading}
              />
            </div>
            {handleStatus === 'checking' && <p className="text-xs text-gray-500 mt-1">Checking availability…</p>}
            {handleStatus === 'available' && <p className="text-xs text-green-600 mt-1">Handle available</p>}
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
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gender <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Male', value: 'male' },
                { label: 'Female', value: 'female' },
                { label: 'Non-binary', value: 'non-binary' },
                { label: 'Prefer not to say', value: 'prefer-not-to-say' },
              ].map((opt) => {
                const selected = formData.gender === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={loading}
                    onClick={() => handleInputChange('gender', opt.value)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                      selected
                        ? 'border-orange-500 bg-orange-500 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-orange-300'
                    }`}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary sport <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Running', value: 'running' },
                { label: 'Triathlon', value: 'triathlon' },
                { label: 'Cycling', value: 'cycling' },
                { label: 'Swimming', value: 'swimming' },
              ].map((opt) => {
                const selected = formData.primarySport === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={loading}
                    onClick={() => handleInputChange('primarySport', opt.value)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                      selected
                        ? 'border-orange-500 bg-orange-500 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-orange-300'
                    }`}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current 5K pace <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Used to calibrate training zones. Enter minutes and seconds per mile.
            </p>
            <div className="flex items-center gap-2 max-w-xs">
              <input
                type="number"
                min={0}
                max={59}
                placeholder="min"
                value={formData.fiveKPaceMinutes}
                onChange={(e) => handleInputChange('fiveKPaceMinutes', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-center"
                disabled={loading}
              />
              <span className="text-gray-500 font-bold">:</span>
              <input
                type="number"
                min={0}
                max={59}
                placeholder="sec"
                value={formData.fiveKPaceSeconds}
                onChange={(e) => handleInputChange('fiveKPaceSeconds', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-center"
                disabled={loading}
              />
              <span className="text-sm text-gray-500 whitespace-nowrap">/mi</span>
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 uppercase"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || handleStatus === 'taken'}
              className="w-full bg-orange-500 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-orange-600 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving…' : 'Continue'}
            </button>
            <p className="text-center text-sm text-gray-500 mt-3">
              Photo, bio, sport, and a favorite race-moment shot for your public page — add anytime under
              Profile → Edit profile.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
