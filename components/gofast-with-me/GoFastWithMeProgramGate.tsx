'use client';

import Link from 'next/link';
import { ExternalLink, Loader2 } from 'lucide-react';
import { GOFAST_WITH_ME_FAQ_URL } from '@/lib/gofast-with-me/program-config';

type Props = {
  loading?: boolean;
  error?: string | null;
  onReady: () => void;
};

const HOW_IT_WORKS_STUBS = [
  {
    title: 'How GoFast With Me works',
    body: 'Set up your public door, surface your GoFast plan, and share journey messages with followers.',
  },
  {
    title: 'How you get paid',
    body: 'As your audience grows, advertiser placements on your public surface can earn you revenue. Details coming soon.',
  },
  {
    title: 'What an advertiser sees',
    body: 'Brands see your public presence, audience reach, and fit with goal-focused runners. More on the program FAQ.',
  },
] as const;

export default function GoFastWithMeProgramGate({ loading, error, onReady }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-gray-50 flex flex-col">
      <header className="border-b border-sky-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link
            href="/athlete-home"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            ← Back to home
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            GoFast With Me
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 space-y-8">
        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700 mb-3">
            GoFast With Me
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
            Surface your goal and plan. Invite others to train alongside you.
          </h1>
          <p className="mt-4 text-gray-700 leading-relaxed">
            Share what you&apos;re training for, surface your GoFast plan, and let followers see your
            week. Our <strong>GoFast With Me</strong> program is for goal-focused athletes who want
            an audience on the journey — not just a static profile.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={GOFAST_WITH_ME_FAQ_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50"
            >
              See FAQs
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        </div>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">See how it works</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {HOW_IT_WORKS_STUBS.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-gray-200 bg-white p-4"
              >
                <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-xs text-gray-600 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="rounded-xl border border-sky-200 bg-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-gray-700">
            Ready to open your door and member room in Studio?
          </p>
          <button
            type="button"
            onClick={onReady}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Setting up…
              </>
            ) : (
              "I'm ready"
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
