"use client";

import Link from "next/link";
import { Users, Compass, UserSearch } from "lucide-react";

export default function ProfileCommunityPage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Community & pace matching</h1>
      <p className="text-sm text-gray-600 mb-6">
        RunCrews are where you train with others. Your baseline pace (on Training & pace) will help
        match you with similar fitness when we roll out richer matching—set it now so you&apos;re
        ready.
      </p>

      <div className="space-y-4">
        <Link
          href="/my-runcrews"
          className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/50 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
            <Users className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">My RunCrews</p>
            <p className="text-sm text-gray-600">Open a crew you&apos;re in</p>
          </div>
        </Link>
        <Link
          href="/find-runners"
          className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/50 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
            <UserSearch className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Find other runners</p>
            <p className="text-sm text-gray-600">Same goal race, next city run, join in</p>
          </div>
        </Link>
        <Link
          href="/runcrew-discovery"
          className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/50 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <Compass className="h-6 w-6 text-gray-700" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Discover RunCrews</p>
            <p className="text-sm text-gray-600">Browse and join a crew</p>
          </div>
        </Link>
        <Link
          href="/profile/training"
          className="block text-sm text-orange-600 font-medium hover:underline pt-2"
        >
          Set training baseline pace →
        </Link>
      </div>
    </div>
  );
}
