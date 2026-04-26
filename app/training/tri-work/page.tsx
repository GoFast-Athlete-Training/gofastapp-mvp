import Link from "next/link";

export default function TriWorkOverviewPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">TriWork</h1>
      <p className="text-gray-600 text-sm leading-relaxed mb-6">
        Multi-sport workouts live outside your running plan: structured bike intervals with power
        (watts), tri session shells that stack bike + run (and swim later), and the same run
        builder you use for road workouts.
      </p>
      <ul className="space-y-3 text-sm">
        <li>
          <Link href="/training/tri-work/bike" className="font-medium text-orange-600 hover:text-orange-700">
            Bike workouts
          </Link>
          <span className="text-gray-600"> — time-based steps, push to Garmin as CYCLING.</span>
        </li>
        <li>
          <Link
            href="/training/tri-work/tri-sessions"
            className="font-medium text-orange-600 hover:text-orange-700"
          >
            Tri sessions
          </Link>
          <span className="text-gray-600">
            {" "}
            — link existing bike and run workouts; push each leg on the same day.
          </span>
        </li>
        <li>
          <Link href="/workouts/create" className="font-medium text-orange-600 hover:text-orange-700">
            Run workout builder
          </Link>
          <span className="text-gray-600"> — pace segments and plan integration.</span>
        </li>
        <li>
          <Link href="/training" className="font-medium text-orange-600 hover:text-orange-700">
            My Training
          </Link>
          <span className="text-gray-600"> — calendar, plan, and today&apos;s run focus.</span>
        </li>
      </ul>
    </div>
  );
}
