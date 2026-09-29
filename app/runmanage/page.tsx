import Link from "next/link";

/** Staff run shell entry — brand picks go through Sponsor Manage via /api/runmanage/brands/* */
export default function RunManageHomePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900">Run manage</h1>
      <p className="mt-3 text-gray-600">
        Staff authoring for prod city runs. Brand ingest and logo updates flow through Sponsor
        Manage; prod keeps a read snap on each run as <code className="text-sm">runBrandId</code>.
      </p>
      <ul className="mt-8 list-disc space-y-2 pl-5 text-gray-700">
        <li>
          Sign in with your Company staff Firebase session (same as HQ run tools).
        </li>
        <li>
          Use HQ run editor or API with <code className="text-sm">runBrandId</code> after picking a
          brand from Sponsor Manage search.
        </li>
      </ul>
      <p className="mt-8">
        <Link href="/signin" className="font-semibold text-sky-700 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
