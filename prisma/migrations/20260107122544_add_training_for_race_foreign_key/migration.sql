-- AlterTable
ALTER TABLE "run_crews" ADD CONSTRAINT "run_crews_trainingForRace_fkey" FOREIGN KEY ("trainingForRace") REFERENCES "race_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;




