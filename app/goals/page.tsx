import { redirect } from "next/navigation";

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ raceRegistryId?: string }>;
}) {
  const sp = await searchParams;
  if (sp.raceRegistryId) {
    redirect(
      `/profile?goalRace=${encodeURIComponent(sp.raceRegistryId)}#goal`
    );
  }
  redirect("/profile#goal");
}
