-- Plan-frozen ladder step for Intervals/Tempo (ordinal % 4 at generate time); matches planWeeks -iN suffix.
ALTER TABLE "workouts" ADD COLUMN "planLadderIndex" INTEGER;
