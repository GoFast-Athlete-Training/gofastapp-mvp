"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import CityRunPostRunContainer from "@/components/runs/CityRunPostRunContainer";
import { useCityRunPageLoad } from "@/components/runs/useCityRunPageLoad";
export default function RunCompletePage() {
  const params = useParams();
  const runId = params.runId as string;
  const { run, loading, error, myCheckin, checkins } = useCityRunPageLoad(runId);

  const miles =
    run?.totalMiles != null
      ? `${run.totalMiles} mi`
      : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden min-w-0">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto min-w-0 pb-24 lg:pb-0">
          {loading ? (
            <div className="flex justify-center py-24">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
            </div>
          ) : error || !run ? (
            <div className="max-w-2xl mx-auto px-6 py-12 text-center">
              <p className="text-gray-800">{error || "Run not found"}</p>
              <Link href="/gorun" className="mt-4 inline-block text-orange-600 font-semibold">
                ← Back to Run
              </Link>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
              <Link href="/gorun" className="text-sm font-semibold text-gray-600 hover:text-gray-900">
                ← Back to Run
              </Link>
              <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                  See how the run went
                </p>
                <h1 className="mt-2 text-2xl font-bold text-gray-900">{run.title}</h1>
                {run.plannedWorkout?.title &&
                run.plannedWorkout.title.trim() !== run.title.trim() ? (
                  <p className="mt-1 text-sm text-gray-600">{run.plannedWorkout.title}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-700">
                  {miles ? <span>{miles}</span> : null}
                  {run.pace ? <span>{run.pace}</span> : null}
                </div>
              </header>
              <CityRunPostRunContainer
                run={run}
                myCheckin={myCheckin}
                allCheckins={checkins}
                hostRecapMode
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
