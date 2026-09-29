"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import runmanageApi from "@/lib/runmanage/api-client";
import {
  clearStaffSession,
  normalizeStaffSession,
  writeStaffSession,
} from "@/lib/runmanage/staff-session";

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/runmanage") || value.startsWith("//")) {
    return "/runmanage/runs";
  }
  return value;
}

async function resolveStaffAfterSignIn(user: User): Promise<void> {
  const res = await runmanageApi.post("/api/runmanage/staff/bootstrap");
  if (!res.data?.success) {
    if (res.data?.error === "not_invited") {
      await signOut(auth);
      throw Object.assign(new Error("not_invited"), { code: "not_invited" });
    }
    throw new Error(res.data?.error || "Failed to verify staff access");
  }
  const staff = normalizeStaffSession(res.data.staff);
  if (!staff) throw new Error("Staff not found");
  writeStaffSession(user.uid, staff);
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setChecking(false);
        return;
      }
      try {
        await resolveStaffAfterSignIn(user);
        router.replace(nextPath);
      } catch {
        clearStaffSession();
        setChecking(false);
      }
    });
    return () => unsub();
  }, [router, nextPath]);

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await resolveStaffAfterSignIn(cred.user);
      router.replace(nextPath);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "not_invited") {
        setError("This workspace is invite-only. Contact GoFast if you need access.");
      } else {
        setError(e.message || "Sign-in failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await resolveStaffAfterSignIn(cred.user);
      router.replace(nextPath);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "not_invited") {
        setError("This workspace is invite-only. Contact GoFast if you need access.");
      } else {
        setError(e.message || "Sign-in failed");
      }
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Checking session…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Run Manage</h1>
      <p className="mb-8 text-gray-600">Staff sign-in for prod run authoring.</p>

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => void handleGoogle()}
        className="mb-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
      >
        Continue with Google
      </button>

      <form onSubmit={(e) => void handleEmail(e)} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
          placeholder="Email"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
          placeholder="Password"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}

export default function RunManageSignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-gray-500">Loading…</p>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
