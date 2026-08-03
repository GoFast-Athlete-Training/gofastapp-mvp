'use client';

import Link from 'next/link';

export type StoplightTone = 'complete' | 'incomplete' | 'attention';

export type StoplightItem = {
  label: string;
  tone: StoplightTone;
  status: string;
  href: string;
  actionLabel: string;
};

const lightClass: Record<StoplightTone, string> = {
  complete: 'bg-emerald-500',
  incomplete: 'bg-red-500',
  attention: 'bg-amber-400',
};

function StoplightRow({ item }: { item: StoplightItem }) {
  const isComplete = item.tone === 'complete';
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`h-3 w-3 shrink-0 rounded-full ${lightClass[item.tone]}`} aria-hidden />
        <span className="text-sm font-semibold text-gray-900">{item.label}</span>
        <span className="text-xs text-gray-500">{item.status}</span>
      </div>
      <Link
        href={item.href}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
          isComplete
            ? 'border border-sky-200 bg-white text-sky-800 hover:bg-sky-50'
            : 'bg-sky-600 text-white hover:bg-sky-700'
        }`}
      >
        {item.actionLabel}
      </Link>
    </div>
  );
}

export default function ManagerStoplightCard({
  title,
  items,
}: {
  title: string;
  items: StoplightItem[];
}) {
  return (
    <div className="rounded-xl border border-sky-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      <div className="mt-2 divide-y divide-sky-100">
        {items.map((item) => (
          <StoplightRow key={item.label} item={item} />
        ))}
      </div>
    </div>
  );
}
