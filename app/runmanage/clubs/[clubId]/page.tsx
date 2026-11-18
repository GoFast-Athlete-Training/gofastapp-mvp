import { RunManageClubHome } from "@/components/runmanage/RunManageClubHome";

export default async function RunManageClubHubPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  return <RunManageClubHome clubId={clubId.trim()} />;
}
