import AthleteAppShell from '@/components/athlete/AthleteAppShell';
import AthleteCommunityView from '@/components/gofast-with-me/AthleteCommunityView';

type Props = {
  params: Promise<{ handle: string }>;
};

export default async function AthleteCommunityPage({ params }: Props) {
  const { handle } = await params;
  return (
    <AthleteAppShell>
      <div className="px-4 sm:px-6 py-6">
        <AthleteCommunityView handle={handle?.trim() || ''} />
      </div>
    </AthleteAppShell>
  );
}
