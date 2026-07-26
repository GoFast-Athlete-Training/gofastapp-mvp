'use client';

export type ContainerHubTab = 'feed' | 'runs' | 'community';

export const CONTAINER_HUB_TABS: { id: ContainerHubTab; label: string }[] = [
  { id: 'feed', label: 'Feed' },
  { id: 'runs', label: 'Runs' },
  { id: 'community', label: 'Community' },
];

type Props = {
  activeTab: ContainerHubTab;
  onTabChange: (tab: ContainerHubTab) => void;
};

export default function ContainerHubTabNav({ activeTab, onTabChange }: Props) {
  return (
    <nav
      className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1"
      aria-label="Member hub sections"
    >
      {CONTAINER_HUB_TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              active
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export function parseContainerHubTab(hash: string): ContainerHubTab | null {
  const value = hash.replace(/^#/, '').trim();
  if (value === 'feed' || value === 'runs' || value === 'community') {
    return value;
  }
  return null;
}
