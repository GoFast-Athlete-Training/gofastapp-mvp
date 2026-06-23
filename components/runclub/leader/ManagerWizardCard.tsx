'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

type ManagerWizardCardProps = {
  title: string;
  description: string;
  href?: string;
  statusLabel?: string;
  statusTone?: 'complete' | 'attention' | 'neutral' | 'future';
  detail?: string;
  disabled?: boolean;
  priority?: 'primary' | 'secondary' | 'future';
};

const toneClasses: Record<NonNullable<ManagerWizardCardProps['statusTone']>, string> = {
  complete: 'bg-emerald-100 text-emerald-800',
  attention: 'bg-amber-100 text-amber-900',
  neutral: 'bg-gray-100 text-gray-700',
  future: 'bg-gray-100 text-gray-500',
};

const priorityClasses: Record<NonNullable<ManagerWizardCardProps['priority']>, string> = {
  primary: 'border-orange-200 bg-white shadow-sm hover:shadow-md',
  secondary: 'border-gray-200 bg-gray-50/80',
  future: 'border-dashed border-gray-300 bg-gray-50 opacity-80',
};

export default function ManagerWizardCard({
  title,
  description,
  href,
  statusLabel,
  statusTone = 'neutral',
  detail,
  disabled = false,
  priority = 'primary',
}: ManagerWizardCardProps) {
  const inner = (
    <div
      className={`rounded-xl border p-5 transition ${priorityClasses[priority]} ${
        disabled ? 'cursor-not-allowed' : href ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`text-lg font-bold ${
                priority === 'future' ? 'text-gray-500' : 'text-gray-900'
              }`}
            >
              {title}
            </h3>
            {statusLabel ? (
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClasses[statusTone]}`}
              >
                {statusLabel}
              </span>
            ) : null}
          </div>
          <p
            className={`mt-2 text-sm ${priority === 'future' ? 'text-gray-400' : 'text-gray-600'}`}
          >
            {description}
          </p>
          {detail ? <p className="mt-2 text-xs text-gray-500">{detail}</p> : null}
        </div>
        {href && !disabled ? (
          <ChevronRight className="h-5 w-5 shrink-0 text-orange-500 mt-1" aria-hidden />
        ) : null}
      </div>
    </div>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }

  return inner;
}
