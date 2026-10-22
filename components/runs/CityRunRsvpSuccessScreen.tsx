"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { CityRunDetails } from "@/components/runs/city-run-types";
import { formatRunDate, formatRunTime } from "@/components/runs/city-run-types";
import { cityRunTogetherPath } from "@/lib/city-run/run-nav-paths";

type Props = {
  run: CityRunDetails;
  onContinue: () => void;
  continueHref?: string;
  continueLabel?: string;
};

export default function CityRunRsvpSuccessScreen({
  run,
  onContinue,
  continueHref,
  continueLabel = "Open run hub",
}: Props) {
  const timeLabel = formatRunTime(run.startTimeHour, run.startTimeMinute, run.startTimePeriod);
  const dateLabel = formatRunDate(run.date, true);
  const meetupLine = [run.meetUpPoint?.trim(), run.meetUpCity?.trim()].filter(Boolean).join(" · ");
  const hubHref = continueHref ?? cityRunTogetherPath(run.slug?.trim() || run.id);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 p-8 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" aria-hidden />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">You&apos;re in</h1>
          <p className="mt-2 text-sm text-gray-600">
            You&apos;re on the list for{" "}
            <span className="font-semibold text-gray-900">{run.title?.trim() || "this run"}</span>.
          </p>
          <p className="mt-3 text-sm text-gray-600 leading-relaxed">
            Head to the run hub for meetup updates, who else is in, and chatter with the crew
            before you show up.
          </p>

          <div className="mt-6 rounded-xl bg-gray-50 px-4 py-3 text-left text-sm text-gray-700 space-y-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">When</p>
              <p className="font-medium text-gray-900">{dateLabel}</p>
              {timeLabel ? <p>{timeLabel} meetup time</p> : null}
            </div>
            {meetupLine ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Meet here
                </p>
                <p className="font-medium text-gray-900">{run.meetUpPoint?.trim() || meetupLine}</p>
                {run.meetUpStreetAddress || run.meetUpCity ? (
                  <p className="text-gray-600">
                    {[run.meetUpStreetAddress, run.meetUpCity, run.meetUpState]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {continueHref ? (
            <Link
              href={hubHref}
              onClick={onContinue}
              className="mt-8 block w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition"
            >
              {continueLabel} →
            </Link>
          ) : (
            <button
              type="button"
              onClick={onContinue}
              className="mt-8 w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition"
            >
              {continueLabel} →
            </button>
          )}
          <p className="mt-3 text-xs text-gray-500">
            See who&apos;s in, get updates, and chat with others on this run.
          </p>
        </div>
      </div>
    </div>
  );
}
