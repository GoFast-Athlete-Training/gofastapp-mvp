"use client";

import Link from "next/link";
import { useRunManageAuth } from "@/components/runmanage/RunManageProviders";

export default function RunManageNoAccessPage() {
  const { signOutRunManage } = useRunManageAuth();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12 text-center">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">No access</h1>
      <p className="mb-8 text-gray-600">
        This GoFast athlete account does not have Run Manage access yet. Ask a founder to assign you
        in Admin Manage.
      </p>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => void signOutRunManage()}
          className="rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-700"
        >
          Sign out
        </button>
        <Link href="/welcome-runmanage" className="text-sm text-sky-700 hover:underline">
          Try another account
        </Link>
      </div>
    </div>
  );
}
