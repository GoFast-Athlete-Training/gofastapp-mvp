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
      {/* Header with Return buttons */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
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

      {/* Fixed Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 fixed left-0 top-[4rem] h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            {crewGraphic}
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900 truncate">{crewName}</h2>
              <p className="text-sm text-gray-500">Settings</p>
            </div>
          </div>
        </div>
        <nav className="p-4">
          <ul className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <li key={section.id}>
                  <button
                    onClick={() => onSectionChange(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="truncate">{section.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Main Content Area - with margin for fixed sidebar, flush left */}
      <main className="ml-64 min-w-0 min-h-[calc(100vh-4rem)]">
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </>
  );
}
