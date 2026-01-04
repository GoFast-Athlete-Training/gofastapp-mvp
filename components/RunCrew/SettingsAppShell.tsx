'use client';

import { Info, Users, Archive } from 'lucide-react';
import { ReactNode } from 'react';
import Link from 'next/link';

type SettingsSection = 'info' | 'manager' | 'lifecycle';

interface SettingsAppShellProps {
  children: ReactNode;
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  crewName: string;
  crewGraphic: ReactNode;
  runCrewId: string;
}

export default function SettingsAppShell({
  children,
  activeSection,
  onSectionChange,
  crewName,
  crewGraphic,
  runCrewId,
}: SettingsAppShellProps) {
  const sections = [
    { id: 'info' as SettingsSection, label: 'Info', icon: Info },
    { id: 'manager' as SettingsSection, label: 'Manager', icon: Users },
    { id: 'lifecycle' as SettingsSection, label: 'Page Lifecycle', icon: Archive },
  ];

  return (
    <>
      {/* Fixed Sidebar - matches IgniteBd pattern: fixed left-0 top-14 (below TopNav) */}
      <aside className="w-64 bg-white border-r border-gray-200 h-[calc(100vh-3.5rem)] fixed left-0 top-14 overflow-y-auto z-30">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0">
            {crewGraphic}
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900 truncate">{crewName}</h2>
              <p className="text-sm text-gray-500">Settings</p>
            </div>
          </div>
        </div>
        <nav className="p-4 space-y-6">
          <ul className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <li key={section.id}>
                  <button
                    onClick={() => onSectionChange(section.id)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border border-orange-200 bg-orange-50 text-orange-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">{section.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Main Content Area - with margin for fixed sidebar, matches IgniteBd pattern */}
      <main className="flex-1 ml-64 min-h-[calc(100vh-3.5rem)]">
        {/* Header with Return buttons - sticky below TopNav */}
        <header className="bg-white border-b border-gray-200 sticky top-14 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 min-w-0">
                {crewGraphic}
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-gray-900 truncate">{crewName}</h1>
                  <p className="text-sm text-gray-500">Settings</p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link
                  href={`/runcrew/${runCrewId}/admin`}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition whitespace-nowrap"
                >
                  Return as Manager
                </Link>
                <Link
                  href={`/runcrew/${runCrewId}/member`}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition whitespace-nowrap"
                >
                  Return as Member
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content - flush left with padding */}
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </>
  );
}
