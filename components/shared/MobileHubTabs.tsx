"use client";

import type { ReactNode } from "react";

export type MobileHubTab = {
  id: string;
  label: string;
  icon: ReactNode;
};

type MobileHubTabsProps = {
  tabs: MobileHubTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: ReactNode;
  /** Extra bottom padding when a fixed tab bar is shown. */
  contentClassName?: string;
};

export default function MobileHubTabs({
  tabs,
  activeTab,
  onTabChange,
  children,
  contentClassName = "pb-24",
}: MobileHubTabsProps) {
  return (
    <div className="lg:hidden flex flex-col min-h-0">
      <div className={`min-h-0 ${contentClassName}`}>{children}</div>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90"
        aria-label="Hub sections"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] font-semibold transition-colors ${
                  active
                    ? "text-orange-600 bg-orange-50"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                <span className={active ? "text-orange-600" : "text-gray-400"}>{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
