import { backfillEligibleContainerCandidates } from "@/lib/sponsorship/candidate-service";

async function main() {
  const result = await backfillEligibleContainerCandidates();
  console.log("Sponsorship candidate backfill complete:", result);
}

main().catch((error) => {
  console.error("Sponsorship candidate backfill failed:", error);
  process.exit(1);
});
