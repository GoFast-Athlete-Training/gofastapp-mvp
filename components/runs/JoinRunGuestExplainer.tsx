'use client';

import { useState } from 'react';
import Link from 'next/link';
import TopNav from '@/components/shared/TopNav';
import { cityRunJoinSignupPath } from '@/lib/city-run/run-nav-paths';

type RunContext = {
  title: string;
  slug: string;
};

type Props = {
  run: RunContext;
};

export default function JoinRunGuestExplainer({ run }: Props) {
  const [showNameForm, setShowNameForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [stampLoading, setStampLoading] = useState(false);
  const [stampMessage, setStampMessage] = useState<string | null>(null);
  const [stampError, setStampError] = useState<string | null>(null);

  const signupHref = cityRunJoinSignupPath(run.slug);
  const joinKey = run.slug.trim();

  const submitNameStamp = async () => {
    setStampError(null);
    setStampMessage(null);
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail) {
      setStampError('Add your name and email.');
      return;
    }
    setStampLoading(true);
    try {
      const res = await fetch(`/api/runs/public/${encodeURIComponent(joinKey)}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, email: trimmedEmail }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setStampError(data.error || 'Could not add you to the list.');
        return;
      }
      setStampMessage("You're on the list — see you at the meetup!");
      setShowNameForm(false);
    } catch {
      setStampError('Something went wrong. Try again in a moment.');
    } finally {
      setStampLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-orange-50">
      <TopNav />
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.jpg"
            alt=""
            className="h-14 w-14 rounded-full object-cover ring-2 ring-sky-100"
          />
          <p className="mt-3 text-sm font-bold text-gray-900">GoFast</p>
        </div>

        <article className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <p className="text-lg font-bold text-gray-900">
            Hey, we see you&apos;re not a GoFast athlete
          </p>
          <p className="mt-2 text-sm text-gray-600">
            You have two options to RSVP for{' '}
            <span className="font-semibold text-gray-900">{run.title}</span>.
          </p>
          <p className="mt-1 text-sm text-gray-600">Choose the one that works best for you.</p>

          {!showNameForm ? (
            <div className="mt-6 space-y-3">
              <Link
                href={signupHref}
                className="flex w-full items-center justify-center rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white hover:bg-orange-700"
              >
                Sign up with GoFast
              </Link>
              <button
                type="button"
                onClick={() => setShowNameForm(true)}
                className="flex w-full items-center justify-center rounded-xl border border-sky-200 bg-sky-50 py-3 text-sm font-semibold text-sky-900 hover:bg-sky-100"
              >
                Put my name on the list
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-800">
                No account needed — we&apos;ll list your name for the host.
              </p>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Your name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  autoComplete="name"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  autoComplete="email"
                />
              </label>
              <button
                type="button"
                disabled={stampLoading}
                onClick={() => void submitNameStamp()}
                className="w-full rounded-xl bg-sky-700 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
              >
                {stampLoading ? 'Saving…' : "Add me to who's going"}
              </button>
              <button
                type="button"
                onClick={() => setShowNameForm(false)}
                className="w-full text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                ← Back to options
              </button>
            </div>
          )}

          {stampMessage ? (
            <p className="mt-4 text-center text-sm font-semibold text-green-700">{stampMessage}</p>
          ) : null}
          {stampError ? (
            <p className="mt-4 text-center text-sm font-semibold text-red-600">{stampError}</p>
          ) : null}
        </article>
      </div>
    </div>
  );
}
