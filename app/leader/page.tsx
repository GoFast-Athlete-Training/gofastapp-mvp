import { redirect } from 'next/navigation';
import { clubManagerHubPath } from '@/lib/club-manager-paths';

export default function LegacyLeaderHubRedirect() {
  redirect(clubManagerHubPath());
}
