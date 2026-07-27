import { backfillEligibleContainerCandidates } from "@/lib/advertising/candidate-service";

async function main() {
  const result = await backfillEligibleContainerCandidates();
  console.log("Advertising candidate backfill complete:", result);
}

main().catch((error) => {
  console.error("Advertising candidate backfill failed:", error);
  process.exit(1);
});
