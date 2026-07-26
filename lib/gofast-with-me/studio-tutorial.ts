import { GOFAST_WITH_ME_STUDIO_TUTORIAL_SLUG } from '@/lib/gofast-with-me/program-config';

export type StudioTutorialStep = {
  id: string;
  title: string;
  instruction: string;
  sortOrder: number;
};

export type StudioTutorialPayload = {
  slug: string;
  name: string;
  summary: string | null;
  steps: StudioTutorialStep[];
};

export const STUDIO_TUTORIAL_FALLBACK: StudioTutorialPayload = {
  slug: GOFAST_WITH_ME_STUDIO_TUTORIAL_SLUG,
  name: 'GoFast With Me Studio',
  summary:
    'Surface what you are training for, publish your GoFast plan, and invite others to follow your journey — goal, plan strip, messages, followers.',
  steps: [
    {
      id: 'door',
      title: 'My Page — the door',
      instruction:
        'Your public landing where strangers see who you are and What I\'m training for before they follow.',
      sortOrder: 0,
    },
    {
      id: 'plan',
      title: 'Surface my plan',
      instruction:
        'Publish your GoFast plan so followers see the plan strip — your training week — in the hub.',
      sortOrder: 1,
    },
    {
      id: 'messages',
      title: 'Messages',
      instruction: 'Journey announcements — race updates, milestones, what is next on the plan.',
      sortOrder: 2,
    },
    {
      id: 'followers',
      title: 'Followers',
      instruction: 'Who joined your GoFast With Me hub to train alongside you.',
      sortOrder: 3,
    },
  ],
};

export async function fetchStudioTutorial(
  slug = GOFAST_WITH_ME_STUDIO_TUTORIAL_SLUG
): Promise<StudioTutorialPayload | null> {
  try {
    const res = await fetch(`/api/user-tutorial-public/by-slug/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.success || !data?.tutorial) return null;
    const t = data.tutorial;
    return {
      slug: t.slug,
      name: t.name,
      summary: t.summary ?? null,
      steps: (t.steps ?? []).map(
        (s: { id: string; title: string; instruction: string; sortOrder: number }) => ({
          id: s.id,
          title: s.title,
          instruction: s.instruction,
          sortOrder: s.sortOrder,
        })
      ),
    };
  } catch {
    return null;
  }
}
