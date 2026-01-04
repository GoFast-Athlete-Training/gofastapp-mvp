'use client';

import { Info, Users, Archive } from 'lucide-react';
import { ReactNode } from 'react';

type SettingsSection = 'info' | 'manager' | 'lifecycle';

interface SettingsAppShellProps {
  children: ReactNode;
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  crewName: string;
  crewGraphic: ReactNode;
}

export default function SettingsAppShell({
  children,
  activeSection,
  onSectionChange,
  crewName,
  crewGraphic,
}: SettingsAppShellProps) {
  const sections = [
    { id: 'info' as SettingsSection, label: 'Info', icon: Info },
    { id: 'manager' as SettingsSection, label: 'Manager', icon: Users },
    { id: 'lifecycle' as SettingsSection, label: 'Page Lifecycle', icon: Archive },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Left Sidebar Navigation */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-screen">
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
                      <Icon className="w-5 h-5" />
                      {section.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1">
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

