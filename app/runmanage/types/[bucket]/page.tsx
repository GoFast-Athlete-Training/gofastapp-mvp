import { notFound } from "next/navigation";
import { RunManageTypeInstanceList } from "@/components/runmanage/RunManageTypeInstanceList";
import { isCockpitBucket } from "@/lib/runmanage/run-cockpit-buckets";

export default async function RunManageTypePage({
  params,
}: {
  params: Promise<{ bucket: string }>;
}) {
  const { bucket } = await params;
  if (!isCockpitBucket(bucket)) {
    notFound();
  }
  return <RunManageTypeInstanceList bucket={bucket} />;
}
