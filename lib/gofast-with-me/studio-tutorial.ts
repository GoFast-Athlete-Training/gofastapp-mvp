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
    'My Community is the studio: Community Management hydrates the whole hub, Messages is the daily feed, Runs & Training shares plans and GoRuns, Tips & Thinking holds durable advice, and Page Settings controls the public front door.',
  steps: [
    {
      id: 'page',
      title: 'Page Settings — public front door',
      instruction:
        'Your public landing where strangers see who you are and What I\'m training for before they follow.',
      sortOrder: 0,
    },
    {
      id: 'community',
      title: 'Messages — daily community',
      instruction:
        'Post journey updates and review Chatter. Manage followers from Community Management.',
      sortOrder: 1,
    },
    {
      id: 'workouts',
      title: 'Runs & Training — plan sharing',
      instruction:
        'Polish your plan title and follower intro, preview the public hub, and build a GoRun With Me when ready.',
      sortOrder: 2,
    },
    {
      id: 'content',
      title: 'Tips & Thinking — durable content',
      instruction:
        'Publish athlete-owned tips that hydrate your public page and community outside the daily update feed.',
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
