"use client";

import Link from "next/link";
import { MapPin, Camera, AtSign, FileText } from "lucide-react";

export default function ProfileDiscoverabilityPage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Findability</h1>
      <p className="text-sm text-gray-600 mb-6">
        Help other athletes find you: photo, bio, location, and your GoFast handle show up across the
        app and in crews.
      </p>

      <ul className="space-y-3 mb-8">
        {[
          { icon: Camera, text: "Profile photo" },
          { icon: FileText, text: "Bio and social links" },
          { icon: MapPin, text: "City and state" },
          { icon: AtSign, text: "GoFast handle" },
        ].map(({ icon: Icon, text }) => (
          <li
            key={text}
            className="flex items-center gap-3 text-gray-800 bg-white rounded-lg border border-gray-200 px-4 py-3"
          >
            <Icon className="h-5 w-5 text-orange-500 shrink-0" />
            {text}
          </li>
        ))}
      </ul>

      <Link
        href="/athlete-edit-profile"
        className="inline-flex items-center justify-center px-5 py-2.5 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
      >
        Edit findability fields
      </Link>
    </div>
  );
}
