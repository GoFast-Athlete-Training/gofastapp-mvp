import { redirect } from 'next/navigation';

type Props = { params: Promise<{ handle: string }> };

/** Legacy route — redirects to GoFast-with front door. */
export default async function FollowRedirectPage({ params }: Props) {
  const { handle } = await params;
  redirect(`/gofast-with/${encodeURIComponent(handle.trim())}`);
}
