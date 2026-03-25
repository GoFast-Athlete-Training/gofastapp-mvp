import GoalSetter from "@/components/athlete/GoalSetter";

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ raceRegistryId?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="max-w-6xl mx-auto py-2 px-4 sm:px-0">
      <GoalSetter initialRaceRegistryId={sp.raceRegistryId} />
    </div>
  );
}
