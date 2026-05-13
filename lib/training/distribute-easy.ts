/**
 * Pass 4c: race miles, then distribute easy miles to fit athlete weekly target.
 * Long run, tempo, and interval miles are set by earlier passes and are not modified here.
 */

import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type DistributeEasyInput = {
  planSchedule: PlanWeekSchedule[];
  weeklyMileageTarget: number;
  minWeeklyMiles: number;
  maxWeeklyMiles?: number | null;
  raceDistanceMiles: number;
  minEasyPerDayMiles?: number;
};

/** Mutates planSchedule in-place */
export function distributeEasyMiles(input: DistributeEasyInput): void {
  const minEasyPerDay =
    input.minEasyPerDayMiles != null && Number.isFinite(input.minEasyPerDayMiles)
      ? Math.max(0, input.minEasyPerDayMiles)
      : 3;

  for (const week of input.planSchedule) {
    let weeklyCap = Math.max(
      input.minWeeklyMiles,
      Math.min(100, input.weeklyMileageTarget)
    );
    if (input.maxWeeklyMiles != null && Number.isFinite(input.maxWeeklyMiles)) {
      weeklyCap = Math.min(weeklyCap, Number(input.maxWeeklyMiles));
    }

    for (const d of week.days.filter((x) => x.workoutType === "Race")) {
      d.miles = round2(Math.max(input.raceDistanceMiles, 0));
    }

    if (week.days.length > 0 && week.days.every((d) => d.workoutType === "Race")) {
      continue;
    }

    const easySlots = week.days.filter((d) => d.workoutType === "Easy");

    const weekSum = (): number => week.days.reduce((s, d) => s + d.miles, 0);

    const easyBudget = Math.max(0, weeklyCap - weekSum());

    if (easyBudget > 0 && easySlots.length > 0) {
      const baseShare =
        Math.floor((easyBudget / easySlots.length) * 100) / 100;
      for (let i = 0; i < easySlots.length; i++) {
        const ep = easySlots[i]!;
        const m =
          i === easySlots.length - 1
            ? round2(easyBudget - baseShare * (easySlots.length - 1))
            : baseShare;
        ep.miles = m < 0.25 ? 0 : m;
      }
      const drift = weeklyCap - weekSum();
      if (Math.abs(drift) > 0.05 && easySlots[easySlots.length - 1]) {
        const last = easySlots[easySlots.length - 1]!;
        last.miles = Math.max(minEasyPerDay, round2(last.miles + drift));
      }
    }

    while (weekSum() > weeklyCap + 0.05) {
      let hit = false;
      for (
        let i = easySlots.length - 1;
        i >= 0 && weekSum() > weeklyCap + 0.05;
        i--
      ) {
        const d = easySlots[i]!;
        const room = d.miles - minEasyPerDay;
        if (room <= 0) continue;
        const shave = Math.min(room, weekSum() - weeklyCap);
        d.miles = round2(d.miles - shave);
        hit = true;
      }
      if (!hit) break;
    }
  }
}
