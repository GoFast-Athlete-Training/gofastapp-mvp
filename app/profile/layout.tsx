import ProfileHubShell from '@/components/profile/ProfileHubShell';

export const dynamic = 'force-dynamic';

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProfileHubShell>{children}</ProfileHubShell>;
}
