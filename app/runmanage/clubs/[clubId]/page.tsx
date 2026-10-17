import { RunManageClubHub } from "@/components/runmanage/RunManageClubHub";

export default async function RunManageClubHubPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  return <RunManageClubHub clubId={clubId} />;
}
