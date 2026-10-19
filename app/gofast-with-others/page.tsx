import { redirect } from 'next/navigation';
import { CONTENT_BUILDER_PATH } from '@/lib/athlete/community-nav';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

/** Legacy URL — bookmarks and old links keep working. */
export default async function LegacyGoFastWithOthersRedirect({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  redirect(qs ? `${CONTENT_BUILDER_PATH}?${qs}` : CONTENT_BUILDER_PATH);
}
