import { redirect } from "next/navigation";

export default async function RunManageClubHubPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  redirect(`/runmanage/series?clubId=${encodeURIComponent(clubId.trim())}`);
}
