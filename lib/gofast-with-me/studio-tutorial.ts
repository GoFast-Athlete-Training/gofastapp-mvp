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
    'Four places: My Page is your public door. My Community is your member room. My Plan publishes your training week. My Content is for tips, routes, and blog posts.',
  steps: [
    {
      id: 'page',
      title: 'My Page — the door',
      instruction:
        'Your public landing where strangers see who you are and What I\'m training for before they follow.',
      sortOrder: 0,
    },
    {
      id: 'community',
      title: 'My Community — the room',
      instruction:
        'Your member room — post journey messages and see who followed you in.',
      sortOrder: 1,
    },
    {
      id: 'plan',
      title: 'My Plan — publish',
      instruction:
        'Publish your GoFast plan so followers see your training week in the hub.',
      sortOrder: 2,
    },
    {
      id: 'content',
      title: 'My Content — cms',
      instruction:
        'Tips, routes, and blog posts that hydrate your public landing (editors coming soon).',
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
