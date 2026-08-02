'use client';

/**
 * @deprecated Scroll-section pill nav. The community hub now uses the RunCrew /
 * Race Hub tab pattern via AthleteCommunityMobileTabs + desktop grid.
 * Re-exports kept for older imports.
 */
export {
  parseAthleteCommunitySection,
  ATHLETE_COMMUNITY_SECTIONS,
  type AthleteCommunitySection,
} from '@/lib/gofast-with-me/athlete-community-routes';

import {
  ATHLETE_COMMUNITY_SECTIONS,
  type AthleteCommunitySection,
} from '@/lib/gofast-with-me/athlete-community-routes';

type Props = {
  activeSection: AthleteCommunitySection | null;
  onSectionChange: (section: AthleteCommunitySection) => void;
};

/** @deprecated Prefer AthleteCommunityMobileTabs / hub grid. */
export default function AthleteCommunitySectionNav({
  activeSection,
  onSectionChange,
}: Props) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 scrollbar-hide"
      aria-label="Community sections"
    >
      {ATHLETE_COMMUNITY_SECTIONS.map((section) => {
        const active = activeSection === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSectionChange(section.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              active
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
            aria-current={active ? 'true' : undefined}
          >
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}
