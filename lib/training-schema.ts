import { prisma } from './prisma';

const DEFAULT_TRAINING_SCHEMA = {
  name: 'Core Training Fields (MVP1)',
  description: 'Manually curated list of training-related Prisma fields allowed for prompt hydration',
  schemaJson: {
    training_plans: [
      'preferredDays',
      'currentWeeklyMileage',
      'startDate',
      'totalWeeks',
    ],
    race_registry: ['miles', 'date'],
  },
};

/**
 * Upserts the default TrainingSchema record.
 * If a TrainingSchema with the name "Core Training Fields (MVP1)" exists, updates it.
 * Otherwise creates it.
 */
export async function upsertDefaultTrainingSchema() {
  try {
    const trainingSchema = await prisma.trainingSchema.upsert({
      where: { name: DEFAULT_TRAINING_SCHEMA.name },
      update: {
        description: DEFAULT_TRAINING_SCHEMA.description,
        schemaJson: DEFAULT_TRAINING_SCHEMA.schemaJson,
      },
      create: {
        name: DEFAULT_TRAINING_SCHEMA.name,
        description: DEFAULT_TRAINING_SCHEMA.description,
        schemaJson: DEFAULT_TRAINING_SCHEMA.schemaJson,
      },
    });

    return trainingSchema;
  } catch (error) {
    console.error('Error upserting default TrainingSchema:', error);
    throw error;
  }
}
