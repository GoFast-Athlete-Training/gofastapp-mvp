'use client';

import Link from 'next/link';

type ClubProfileSetupCardProps = {
  coreComplete: boolean;
  socialsComplete: boolean;
  href: string;
};

function StoplightRow({
  label,
  complete,
  href,
}: {
  label: string;
  complete: boolean;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`h-3 w-3 shrink-0 rounded-full ${
            complete ? 'bg-emerald-500' : 'bg-red-500'
          }`}
          aria-hidden
        />
        <span className="text-sm font-semibold text-gray-900">{label}</span>
        <span className="text-xs text-gray-500">{complete ? 'Done' : 'Needs fix'}</span>
      </div>
      <Link
        href={href}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
          complete
            ? 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            : 'bg-orange-500 text-white hover:bg-orange-600'
        }`}
      >
        {complete ? 'Edit' : 'Fix'}
      </Link>
    </div>
  );
}

export default function ClubProfileSetupCard({
  coreComplete,
  socialsComplete,
  href,
}: ClubProfileSetupCardProps) {
  return (
    <div className="rounded-xl border border-orange-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900">Club profile</h3>
      <div className="mt-2 divide-y divide-gray-100">
        <StoplightRow label="Core" complete={coreComplete} href={href} />
        <StoplightRow label="Socials" complete={socialsComplete} href={href} />
      </div>
    </div>
  );
}
