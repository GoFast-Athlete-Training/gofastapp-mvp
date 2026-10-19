import { redirect } from 'next/navigation';
import { gofastWithLegacyRedirectUrl } from '@/lib/gofast-with-me/gofast-with-legacy-redirect';

type Props = { params: Promise<{ handle: string }> };

/** Legacy route — public landing is runner domain/slug. */
export default async function FollowRedirectPage({ params }: Props) {
  const { handle } = await params;
  redirect(gofastWithLegacyRedirectUrl(handle));
}
