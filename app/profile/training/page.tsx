"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";

type AthleteRow = {
  firstName: string;
  lastName: string;
  gofastHandle: string;
  birthday: string | Date | null;
  gender: string;
  city: string;
  state: string;
  primarySport: string;
  phoneNumber?: string | null;
  bio?: string | null;
  instagram?: string | null;
  photoURL?: string | null;
  fiveKPace?: string | null;
  weeklyMileage?: number | null;
};

function birthdayToInput(b: string | Date | null | undefined): string {
  if (!b) return "";
  const d = typeof b === "string" ? new Date(b) : b;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

function parseFiveKPaceToParts(raw: string | null | undefined): {
  minutes: string;
  seconds: string;
} {
  const t = (raw ?? "").trim().split("/")[0].trim();
  if (!t) return { minutes: "", seconds: "" };
  const parts = t.split(":");
  if (parts.length === 2) {
    return { minutes: parts[0].trim(), seconds: parts[1].trim() };
  }
  return { minutes: "", seconds: "" };
}

export default function ProfileTrainingPage() {
  const router = useRouter();
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [base, setBase] = useState<AthleteRow | null>(null);
  const [fiveKPaceMinutes, setFiveKPaceMinutes] = useState("");
  const [fiveKPaceSeconds, setFiveKPaceSeconds] = useState("");
  const [weeklyMileage, setWeeklyMileage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const id = LocalStorageAPI.getAthleteId();
    if (!id) {
      router.replace("/welcome");
      return;
    }
    setAthleteId(id);
    api
      .get<{ athlete?: AthleteRow }>(`/athlete/${id}`)
      .then((res) => {
        const a = res.data?.athlete;
        if (!a) {
          router.replace("/welcome");
          return;
        }
        setBase(a);
        const paceParts = parseFiveKPaceToParts(a.fiveKPace);
        setFiveKPaceMinutes(paceParts.minutes);
        setFiveKPaceSeconds(paceParts.seconds);
        setWeeklyMileage(
          a.weeklyMileage != null && Number.isFinite(Number(a.weeklyMileage))
            ? String(a.weeklyMileage)
            : ""
        );
      })
      .catch(() => router.replace("/welcome"))
      .finally(() => setLoading(false));

    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/signup");
    });
    return () => unsub();
  }, [router]);

  const assembledFiveKPace = useMemo(() => {
    if (!fiveKPaceMinutes.trim() || !fiveKPaceSeconds.trim()) return "";
    const m = fiveKPaceMinutes.padStart(2, "0");
    const s = fiveKPaceSeconds.padStart(2, "0");
    return `${m}:${s}`;
  }, [fiveKPaceMinutes, fiveKPaceSeconds]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!athleteId || !base) return;
    const bday = birthdayToInput(base.birthday);
    if (
      !base.firstName ||
      !base.lastName ||
      !base.gofastHandle ||
      !bday ||
      !base.gender ||
      !base.city ||
      !base.state ||
      !base.primarySport
    ) {
      setError("Complete required profile fields on Edit all fields first.");
      return;
    }
    const pm = fiveKPaceMinutes.trim();
    const ps = fiveKPaceSeconds.trim();
    if ((pm && !ps) || (!pm && ps)) {
      setError("Enter both minutes and seconds for 5K pace, or clear both.");
      return;
    }
    if (pm && ps) {
      const mm = parseInt(pm, 10);
      const ss = parseInt(ps, 10);
      if (Number.isNaN(mm) || Number.isNaN(ss) || mm < 0 || mm > 180 || ss < 0 || ss >= 60) {
        setError("Use valid minutes and seconds (seconds under 60).");
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.put(`/athlete/${athleteId}/profile`, {
        firstName: base.firstName,
        lastName: base.lastName,
        phoneNumber: base.phoneNumber ?? "",
        gofastHandle: base.gofastHandle.trim().toLowerCase(),
        birthday: bday,
        gender: base.gender,
        city: base.city,
        state: base.state,
        primarySport: base.primarySport,
        bio: base.bio ?? "",
        instagram: base.instagram ?? "",
        photoURL: base.photoURL ?? null,
        fiveKPace: assembledFiveKPace || null,
        weeklyMileage: (() => {
          const t = weeklyMileage.trim();
          if (!t) return null;
          const n = Number(t);
          return Number.isFinite(n) ? n : null;
        })(),
      });
      setSuccess(true);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string; error?: string } } }).response?.data
              ?.message ||
            (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Save failed";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!base) return null;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Training & pace</h1>
      <p className="text-sm text-gray-600 mb-6">
        Your current 5K pace anchors training zones on your plan (easy, tempo, intervals). It&apos;s
        your fitness baseline—not your race goal.
      </p>

      <form onSubmit={handleSave} className="space-y-5 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Current 5K pace
          </label>
          <div className="flex items-end gap-2 flex-wrap max-w-md">
            <div className="flex-1 min-w-[4rem]">
              <label className="block text-xs text-gray-500 mb-1" htmlFor="profile-fivek-min">
                Minutes
              </label>
              <input
                id="profile-fivek-min"
                type="number"
                min={0}
                max={180}
                value={fiveKPaceMinutes}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  if (val === "" || (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 180)) {
                    setFiveKPaceMinutes(val);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <span className="text-xl text-gray-400 pb-2">:</span>
            <div className="flex-1 min-w-[4rem]">
              <label className="block text-xs text-gray-500 mb-1" htmlFor="profile-fivek-sec">
                Seconds
              </label>
              <input
                id="profile-fivek-sec"
                type="number"
                min={0}
                max={59}
                value={fiveKPaceSeconds}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  if (val === "" || (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 59)) {
                    setFiveKPaceSeconds(val);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <span className="text-sm text-gray-600 font-medium pb-2">/mile</span>
          </div>
          {assembledFiveKPace ? (
            <div className="mt-3 rounded-lg border border-orange-100 bg-orange-50/80 px-3 py-2 text-sm text-gray-800">
              Your 5K pace:{" "}
              <span className="font-mono font-semibold">{assembledFiveKPace}</span> /mile
            </div>
          ) : (
            <p className="mt-2 text-xs text-gray-500">Optional. Use minutes and seconds (e.g. 7 and 30).</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="profile-weekly">
            Weekly mileage
          </label>
          <input
            id="profile-weekly"
            type="number"
            min={0}
            step={1}
            value={weeklyMileage}
            onChange={(e) => setWeeklyMileage(e.target.value)}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-700">Saved.</p>}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <Link
            href="/athlete-edit-profile"
            className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
          >
            Edit full profile
          </Link>
        </div>
      </form>
    </div>
  );
}
