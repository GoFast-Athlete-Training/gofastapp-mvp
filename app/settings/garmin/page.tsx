'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

export default function GarminSettingsPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [athlete, setAthlete] = useState<Record<string, unknown> | null>(null);

  const refreshAthlete = () => {
    const id = LocalStorageAPI.getAthleteId();
    if (!id) return;
    api.get(`/athlete/${id}`).then((res) => {
      if (res.data?.athlete) setAthlete(res.data.athlete);
    });
  };

  useEffect(() => {
    const id = LocalStorageAPI.getAthleteId();
    if (!id) {
      router.replace('/welcome');
      return;
    }
    api
      .get(`/athlete/${id}`)
      .then((res) => {
        if (res.data?.athlete) setAthlete(res.data.athlete);
      })
      .catch(() => router.replace('/welcome'));
  }, [router]);

  const handleConnect = async () => {
    if (!athlete?.id) {
      alert('Please sign in to connect Garmin');
      return;
    }

    setBusy(true);
    try {
      const { data } = await api.get<{
        success?: boolean;
        authUrl?: string;
        error?: string;
      }>('/auth/garmin/authorize', {
        params: { athleteId: String(athlete.id), popup: 'true' },
      });
      if (!data.success || !data.authUrl) {
        throw new Error(data.error || 'Invalid response from server');
      }

      const popup = window.open(
        data.authUrl,
        'garmin-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        alert('Popup blocked. Please allow popups for this site.');
        return;
      }

      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          setBusy(false);
          refreshAthlete();
        }
      }, 500);

      const messageHandler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data.type === 'GARMIN_OAUTH_SUCCESS') {
          clearInterval(checkPopup);
          if (!popup.closed) popup.close();
          setBusy(false);
          refreshAthlete();
          window.removeEventListener('message', messageHandler);
        } else if (event.data.type === 'GARMIN_OAUTH_ERROR') {
          clearInterval(checkPopup);
          if (!popup.closed) popup.close();
          setBusy(false);
          alert('Failed to connect Garmin: ' + (event.data.error || 'Unknown error'));
          window.removeEventListener('message', messageHandler);
        }
      };
      window.addEventListener('message', messageHandler);
    } catch (error: unknown) {
      console.error('Error connecting Garmin:', error);
      alert(
        'Failed to connect Garmin: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      );
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        'Disconnect your Garmin account from GoFast? Workouts and sync will stop using this connection.'
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      await api.post('/auth/garmin/disconnect');
      refreshAthlete();
    } catch (error: unknown) {
      console.error('Error disconnecting:', error);
      const msg =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      alert(msg || (error instanceof Error ? error.message : 'Disconnect failed'));
    } finally {
      setBusy(false);
    }
  };

  const connected = !!athlete?.garmin_connected;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <button
          onClick={() => router.push('/settings')}
          className="mb-2 text-blue-600 hover:text-blue-700"
        >
          ← Back to Settings
        </button>

        <div className="flex items-center gap-4">
          <Image
            src="/Garmin_Connect_app_1024x1024-02.png"
            alt="Garmin Connect"
            width={48}
            height={48}
            className="rounded-lg"
          />
          <h1 className="text-3xl font-bold text-gray-900">Garmin Connect</h1>
        </div>

        <section className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Connection</h2>
            <span
              className={
                connected
                  ? 'text-xs font-medium rounded-full px-2 py-0.5 bg-green-100 text-green-800'
                  : 'text-xs font-medium rounded-full px-2 py-0.5 bg-gray-100 text-gray-600'
              }
            >
              {connected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            For Garmin Developer Program or sandbox testing, point{' '}
            <code className="bg-gray-100 px-1 rounded text-xs">GARMIN_CLIENT_ID</code> and{' '}
            <code className="bg-gray-100 px-1 rounded text-xs">GARMIN_CLIENT_SECRET</code> at your
            eval app in this environment, register the same callback URL, then connect here.
          </p>
          {typeof athlete?.garmin_user_id === 'string' && athlete.garmin_user_id && (
            <p className="text-xs text-gray-500 font-mono break-all">
              Garmin user id: {athlete.garmin_user_id}
            </p>
          )}
          {connected && athlete?.garmin_connected_at != null ? (
            <p className="text-sm text-gray-500">
              Connected since{' '}
              {new Date(String(athlete.garmin_connected_at)).toLocaleDateString()}
            </p>
          ) : null}
          <div className="pt-2">
            {connected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={busy}
                className="w-full py-2.5 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
              >
                {busy ? 'Working…' : 'Disconnect Garmin'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={busy}
                className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {busy ? 'Connecting…' : 'Connect Garmin'}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
