import Link from 'next/link';

export default function GarminConnectPrompt() {
  return (
    <section className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/40 p-8 text-center shadow-sm">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Recovery &amp; sleep from your watch</h2>
      <p className="text-sm text-gray-600 max-w-md mx-auto mb-6 leading-relaxed">
        Connect Garmin to see Body Battery, sleep stages, and resting heart rate — so you can train
        at your best, not just log miles.
      </p>
      <Link
        href="/settings/garmin"
        className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 shadow-sm"
      >
        Connect Garmin
      </Link>
    </section>
  );
}
