import { prisma } from '../prisma';

/**
 * Generate a simple unique ID (cuid-like format)
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

/**
 * Calculate the next occurrence date for a recurring run
 * @param currentDate - The current/previous run date
 * @param dayOfWeek - Day of week (e.g., "Monday", "Tuesday")
 * @returns Next occurrence date
 */
function getNextOccurrenceDate(currentDate: Date, dayOfWeek: string): Date {
  const dayMap: { [key: string]: number } = {
    'Sunday': 0,
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6,
  };

  const targetDay = dayMap[dayOfWeek];
  if (targetDay === undefined) {
    throw new Error(`Invalid dayOfWeek: ${dayOfWeek}`);
  }

  const nextDate = new Date(currentDate);
  const currentDay = nextDate.getDay();
  
  // Calculate days until next occurrence
  let daysToAdd = (targetDay - currentDay + 7) % 7;
  // If it's the same day, add 7 days to get next week
  if (daysToAdd === 0) {
    daysToAdd = 7;
  }
  
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  return nextDate;
}

/**
 * Generate the next instance of a recurring run
 * Creates a new run record for the next occurrence
 * @param recurringRun - The recurring run to generate next instance for
 * @returns The newly created run instance, or null if endDate exceeded or error
 */
export async function generateNextRecurringRunInstance(recurringRun: {
  id: string;
  title: string;
  dayOfWeek: string;
  startDate: Date;
  date: Date;
  endDate: Date | null;
  citySlug: string;
  runCrewId: string | null;
  runClubSlug: string | null;
  staffGeneratedId: string | null;
  athleteGeneratedId: string | null;
  meetUpPoint: string;
  meetUpAddress: string | null;
  meetUpStreetAddress: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  meetUpZip: string | null;
  meetUpPlaceId: string | null;
  meetUpLat: number | null;
  meetUpLng: number | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  timezone: string | null;
  endPoint: string | null;
  endStreetAddress: string | null;
  endCity: string | null;
  endState: string | null;
  totalMiles: number | null;
  pace: string | null;
  stravaMapUrl: string | null;
  description: string | null;
}) {
  try {
    // Calculate next occurrence date
    const nextDate = getNextOccurrenceDate(recurringRun.date, recurringRun.dayOfWeek);

    // Check if we've exceeded endDate (if set)
    if (recurringRun.endDate && nextDate > recurringRun.endDate) {
      console.log(`⏹️ Recurring run ${recurringRun.id} has reached endDate, no more instances`);
      return null;
    }

    // Check if next instance already exists (prevent duplicates)
    // We check by title, dayOfWeek, meetUpPoint, and date proximity
    const existingNextRun = await prisma.city_runs.findFirst({
      where: {
        title: recurringRun.title,
        dayOfWeek: recurringRun.dayOfWeek,
        meetUpPoint: recurringRun.meetUpPoint,
        isRecurring: true,
        date: {
          gte: new Date(nextDate.getTime() - 24 * 60 * 60 * 1000), // Within 1 day
          lte: new Date(nextDate.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    if (existingNextRun) {
      console.log(`✅ Next instance already exists for recurring run ${recurringRun.id}`);
      return existingNextRun;
    }

    // Create next instance
    const nextRun = await prisma.city_runs.create({
      data: {
        id: generateId(),
        citySlug: recurringRun.citySlug,
        runCrewId: recurringRun.runCrewId,
        runClubSlug: recurringRun.runClubSlug,
        staffGeneratedId: recurringRun.staffGeneratedId,
        athleteGeneratedId: recurringRun.athleteGeneratedId,
        title: recurringRun.title,
        isRecurring: true, // Still a recurring run instance
        dayOfWeek: recurringRun.dayOfWeek,
        startDate: nextDate,
        date: nextDate, // Sync with startDate
        endDate: recurringRun.endDate,
        startTimeHour: recurringRun.startTimeHour,
        startTimeMinute: recurringRun.startTimeMinute,
        startTimePeriod: recurringRun.startTimePeriod,
        timezone: recurringRun.timezone,
        meetUpPoint: recurringRun.meetUpPoint,
        meetUpAddress: recurringRun.meetUpAddress,
        meetUpStreetAddress: recurringRun.meetUpStreetAddress,
        meetUpCity: recurringRun.meetUpCity,
        meetUpState: recurringRun.meetUpState,
        meetUpZip: recurringRun.meetUpZip,
        meetUpPlaceId: recurringRun.meetUpPlaceId,
        meetUpLat: recurringRun.meetUpLat,
        meetUpLng: recurringRun.meetUpLng,
        endPoint: recurringRun.endPoint,
        endStreetAddress: recurringRun.endStreetAddress,
        endCity: recurringRun.endCity,
        endState: recurringRun.endState,
        totalMiles: recurringRun.totalMiles,
        pace: recurringRun.pace,
        stravaMapUrl: recurringRun.stravaMapUrl,
        description: recurringRun.description,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Generated next instance for recurring run ${recurringRun.id}: ${nextRun.id} on ${nextDate.toISOString()}`);
    return nextRun;
  } catch (error: any) {
    console.error(`❌ Error generating next instance for recurring run ${recurringRun.id}:`, error);
    return null;
  }
}

/**
 * Process all concluded recurring runs and generate next instances
 * Finds recurring runs where the date has passed and creates the next occurrence
 * @returns Number of new instances created
 */
export async function processConcludedRecurringRuns(): Promise<number> {
  try {
    const now = new Date();
    
    // Find recurring runs where the date has passed
    // We look for runs where date < now and isRecurring = true
    const concludedRuns = await prisma.city_runs.findMany({
      where: {
        isRecurring: true,
        date: {
          lt: now, // Date has passed
        },
        // Don't process if endDate has passed
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
      orderBy: {
        date: 'asc',
      },
    });

    console.log(`🔍 Found ${concludedRuns.length} concluded recurring runs to process`);

    let createdCount = 0;
    for (const run of concludedRuns) {
      if (!run.dayOfWeek) {
        console.warn(`⚠️ Skipping recurring run ${run.id} - missing dayOfWeek`);
        continue;
      }

      const nextInstance = await generateNextRecurringRunInstance({
        id: run.id,
        title: run.title,
        dayOfWeek: run.dayOfWeek,
        startDate: run.startDate,
        date: run.date,
        endDate: run.endDate,
        citySlug: run.citySlug,
        runCrewId: run.runCrewId,
        runClubSlug: run.runClubSlug,
        staffGeneratedId: run.staffGeneratedId,
        athleteGeneratedId: run.athleteGeneratedId,
        meetUpPoint: run.meetUpPoint,
        meetUpAddress: run.meetUpAddress,
        meetUpStreetAddress: run.meetUpStreetAddress,
        meetUpCity: run.meetUpCity,
        meetUpState: run.meetUpState,
        meetUpZip: run.meetUpZip,
        meetUpPlaceId: run.meetUpPlaceId,
        meetUpLat: run.meetUpLat,
        meetUpLng: run.meetUpLng,
        startTimeHour: run.startTimeHour,
        startTimeMinute: run.startTimeMinute,
        startTimePeriod: run.startTimePeriod,
        timezone: run.timezone,
        endPoint: run.endPoint,
        endStreetAddress: run.endStreetAddress,
        endCity: run.endCity,
        endState: run.endState,
        totalMiles: run.totalMiles,
        pace: run.pace,
        stravaMapUrl: run.stravaMapUrl,
        description: run.description,
      });

      if (nextInstance) {
        createdCount++;
      }
    }

    console.log(`✅ Processed ${concludedRuns.length} recurring runs, created ${createdCount} new instances`);
    return createdCount;
  } catch (error: any) {
    console.error('❌ Error processing concluded recurring runs:', error);
    throw error;
  }
}

