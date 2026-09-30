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
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";

export type RunManageSession = {
  athleteId: string;
  staffGeneratedId: string | null;
  hasAccess: boolean;
};

type RunManageAuth = {
  user: User | null;
  session: RunManageSession | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  signOutRunManage: () => Promise<void>;
};

const RunManageAuthContext = createContext<RunManageAuth | null>(null);

export function useRunManageAuth(): RunManageAuth {
  const ctx = useContext(RunManageAuthContext);
  if (!ctx) {
    throw new Error("useRunManageAuth must be used within RunManageProviders");
  }
  return ctx;
}

async function hydrateAthleteId(user: User): Promise<string | null> {
  let athleteId = LocalStorageAPI.getAthleteId();
  if (athleteId) return athleteId;
  const meRes = await api.get("/athlete/me");
  if (meRes.data?.success && meRes.data?.athleteId) {
    athleteId = meRes.data.athleteId as string;
    LocalStorageAPI.setAthleteId(athleteId);
    return athleteId;
  }
  return null;
}

async function loadRunManageSession(_user: User): Promise<RunManageSession | null> {
  const athleteId = await hydrateAthleteId(_user);
  if (!athleteId) return null;

  const accessRes = await api.get("/me/run-manage-access");
  const hasAccess = Boolean(accessRes.data?.hasAccess);
  return {
    athleteId,
    staffGeneratedId: (accessRes.data?.staffGeneratedId as string | null) ?? null,
    hasAccess,
  };
}

export function RunManageProviders({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<RunManageSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) {
      setSession(null);
      return;
    }
    try {
      const resolved = await loadRunManageSession(u);
      setSession(resolved);
    } catch {
      setSession(null);
    }
  }, []);

  const signOutRunManage = useCallback(async () => {
    LocalStorageAPI.clearRunManageMode();
    setSession(null);
    await signOut(auth);
    router.replace("/welcome-runmanage");
  }, [router]);

  useEffect(() => {
    LocalStorageAPI.setRunManageMode(true);

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setSession(null);
        setLoading(false);
        return;
      }
      try {
        const resolved = await loadRunManageSession(nextUser);
        setSession(resolved);
      } catch {
        setSession(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const isPublic =
    pathname === "/runmanage/no-access" ||
    pathname === "/runmanage/signin" ||
    pathname === "/welcome-runmanage";

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      router.replace(
        `/signup?mode=run-manage&auth=signin&redirect=${encodeURIComponent(pathname || "/runmanage/runs")}`
      );
      return;
    }
    if (user && session && !session.hasAccess && !isPublic) {
      router.replace("/runmanage/no-access");
    }
  }, [loading, user, session, pathname, router, isPublic]);

  const value = useMemo(
    () => ({ user, session, loading, refreshSession, signOutRunManage }),
    [user, session, loading, refreshSession, signOutRunManage]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!isPublic && (!user || !session?.hasAccess)) {
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
