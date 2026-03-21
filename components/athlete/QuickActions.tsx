"use client";

import Link from "next/link";
import { PlusCircle, BookOpen, MessageCircle } from "lucide-react";

export default function QuickActions() {
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick actions</h2>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/workouts/create"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          Add workout
        </Link>
        <Link
          href="/activities"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-gray-200 text-gray-800 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <BookOpen className="h-4 w-4" />
          Training journal
        </Link>
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-gray-200 text-gray-800 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          Ask a coach
        </Link>
      </div>
    </div>
  );
}
