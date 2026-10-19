import { redirect } from 'next/navigation';
import { gofastWithLegacyRedirectUrl } from '@/lib/gofast-with-me/gofast-with-legacy-redirect';

type Props = { params: Promise<{ handle: string }> };

export default async function GoFastWithSignupLegacyRedirectPage({ params }: Props) {
  const { handle } = await params;
  redirect(gofastWithLegacyRedirectUrl(handle));
}
