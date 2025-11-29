'use client';

import { useRouter } from 'next/navigation';

interface ProfileCalloutProps {
  athlete: any;
}

export default function ProfileCallout({ athlete }: ProfileCalloutProps) {
  const router = useRouter();

  return (
    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Complete Your Profile</h3>
          <p className="text-sm text-gray-600">
            Add your name and primary sport to get the most out of GoFast.
          </p>
        </div>
        <button
          onClick={() => router.push('/profile')}
          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold transition whitespace-nowrap"
        >
          Complete Profile →
        </button>
      </div>
    </div>
  );
}

