"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useRunManageAuth } from "@/components/runmanage/RunManageProviders";

export function RunManageShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, session, signOutRunManage } = useRunManageAuth();
  const isAuthSurface =
    pathname === "/runmanage/signin" ||
    pathname === "/runmanage/no-access" ||
    pathname === "/welcome-runmanage";

  if (isAuthSurface) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/runmanage/runs" className="text-lg font-semibold text-sky-700">
              Run Manage
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link
                href="/runmanage/runs"
                className={
                  pathname === "/runmanage/runs" || pathname === "/runmanage/runs/"
                    ? "font-medium text-sky-700"
                    : "text-gray-600 hover:text-gray-900"
                }
              >
                Dashboard
              </Link>
              <Link
                href="/runmanage/runs/new"
                className={
                  pathname?.startsWith("/runmanage/runs/new")
                    ? "font-medium text-sky-700"
                    : "text-gray-600 hover:text-gray-900"
                }
              >
                Create run
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            {user?.email ? <span className="hidden sm:inline">{user.email}</span> : null}
            <button
              type="button"
              onClick={() => void signOutRunManage()}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
