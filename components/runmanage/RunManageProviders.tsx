"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import runmanageApi from "@/lib/runmanage/api-client";
import {
  clearStaffSession,
  normalizeStaffSession,
  readStaffSession,
  writeStaffSession,
  type RunManageStaffSession,
} from "@/lib/runmanage/staff-session";

type RunManageAuth = {
  user: User | null;
  staff: RunManageStaffSession | null;
  loading: boolean;
  refreshStaff: () => Promise<void>;
  signOutStaff: () => Promise<void>;
};

const RunManageAuthContext = createContext<RunManageAuth | null>(null);

export function useRunManageAuth(): RunManageAuth {
  const ctx = useContext(RunManageAuthContext);
  if (!ctx) {
    throw new Error("useRunManageAuth must be used within RunManageProviders");
  }
  return ctx;
}

async function bootstrapStaff(user: User): Promise<RunManageStaffSession> {
  const res = await runmanageApi.post("/api/runmanage/staff/bootstrap");
  const staff = normalizeStaffSession(res.data?.staff);
  if (!staff) {
    throw new Error("Staff not found");
  }
  writeStaffSession(user.uid, staff);
  return staff;
}

export function RunManageProviders({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [staff, setStaff] = useState<RunManageStaffSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStaff = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) {
      setStaff(null);
      return;
    }
    const cached = readStaffSession();
    if (cached && cached.firebaseId === u.uid) {
      setStaff(cached);
      return;
    }
    const resolved = await bootstrapStaff(u);
    setStaff(resolved);
  }, []);

  const signOutStaff = useCallback(async () => {
    clearStaffSession();
    setStaff(null);
    await signOut(auth);
    router.replace("/runmanage/signin");
  }, [router]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setStaff(null);
        setLoading(false);
        return;
      }
      try {
        const cached = readStaffSession();
        if (cached && cached.firebaseId === nextUser.uid) {
          setStaff(cached);
        } else {
          const resolved = await bootstrapStaff(nextUser);
          setStaff(resolved);
        }
      } catch {
        clearStaffSession();
        setStaff(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (loading) return;
    const isPublic =
      pathname === "/runmanage/signin" || pathname === "/runmanage/no-access";
    if (!user && !isPublic) {
      router.replace(`/runmanage/signin?next=${encodeURIComponent(pathname || "/runmanage/runs")}`);
      return;
    }
    if (user && !staff && !isPublic) {
      router.replace("/runmanage/no-access");
    }
  }, [loading, user, staff, pathname, router]);

  const value = useMemo(
    () => ({ user, staff, loading, refreshStaff, signOutStaff }),
    [user, staff, loading, refreshStaff, signOutStaff]
  );

  const isPublic =
    pathname === "/runmanage/signin" || pathname === "/runmanage/no-access";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!isPublic && (!user || !staff)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <RunManageAuthContext.Provider value={value}>{children}</RunManageAuthContext.Provider>
  );
}
