import AdoptThisPlanPanel from '@/components/training/AdoptThisPlanPanel';

type Props = {
  slug: string;
  planTitle: string;
  raceRegistryId: string;
  raceName: string;
  raceDate: string;
  distanceLabel: string | null;
  distanceMeters: number | null;
  sourceAuthorAthleteId: string;
};

export default function PublicPlanAdoptSection(props: Props) {
  return <AdoptThisPlanPanel {...props} />;
}
