import { upsertDefaultTrainingSchema } from '../lib/training-schema';
import { prisma } from '../lib/prisma';

async function main() {
  try {
    console.log('🚀 Upserting default TrainingSchema...');

    const trainingSchema = await upsertDefaultTrainingSchema();

    console.log('✅ TrainingSchema upserted successfully:');
    console.log(JSON.stringify(trainingSchema, null, 2));
  } catch (error) {
    console.error('❌ Error upserting TrainingSchema:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
