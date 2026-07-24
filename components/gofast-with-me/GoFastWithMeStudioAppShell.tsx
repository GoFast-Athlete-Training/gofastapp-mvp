'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import TopNav from '@/components/shared/TopNav';

type Props = {
  children: React.ReactNode;
};

export default function GoFastWithMeStudioAppShell({ children }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-white border-r-2 border-gray-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-200">
            <p className="text-lg font-bold text-gray-900">GoFastWithMe Studio</p>
            <p className="text-xs text-gray-500 mt-1">Your public community hub</p>
          </div>
          <nav className="p-2" aria-label="Studio">
            <Link
              href="/athlete-home"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back to home
            </Link>
          </nav>
        </aside>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
