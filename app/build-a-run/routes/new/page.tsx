'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import TopNav from '@/components/shared/TopNav';
import AthleteSidebar from '@/components/athlete/AthleteSidebar';
import BuildRouteForm from '@/components/runs/BuildRouteForm';

export default function BuildRoutePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden min-w-0">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto min-w-0 pb-24 lg:pb-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            <Link
              href="/build-a-run"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Run hub
            </Link>
            <BuildRouteForm />
          </div>
        </main>
      </div>
    </div>
  );
}
