"use client";

import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  MapPin,
  Sparkles,
  Target,
  Timer,
  Trophy,
  User,
  Footprints,
} from "lucide-react";
import { getGoFastAppPublicUrl } from "@/lib/gofast-app-public-url";

export type GoFastPageAthlete = {
  gofastHandle: string | null;
  firstName: string | null;
  lastName: string | null;
  photoURL: string | null;
  myBestRunPhotoURL?: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  primarySport: string | null;
};

export type GoFastPageRace = {
  id: string;
  name: string;
  slug: string | null;
  raceDate: string;
  city: string | null;
  state: string | null;
  distanceMiles: number;
  raceType: string;
};

export type GoFastPageLastRun = {
  activityName: string | null;
  startTime: string | null;
  distanceMiles: number | null;
  durationSeconds: number | null;
  activityType: string | null;
};

export type GoFastPagePayload = {
  success: boolean;
  athlete: GoFastPageAthlete | null;
  trainingSummary: {
    planName: string;
    startDate: string;
    totalWeeks: number;
    raceName: string | null;
  } | null;
  primaryChasingGoal: {
    id: string;
    name: string | null;
    distance: string;
    goalTime: string | null;
    targetByDate: string;
    raceName: string | null;
    raceSlug: string | null;
  } | null;
  lastRun?: GoFastPageLastRun | null;
  signedUpRaces: GoFastPageRace[];
  upcomingWorkouts: {
    id: string;
    title: string;
    workoutType: string;
    date: string | null;
  }[];
  upcomingRuns: {
    id: string;
    slug: string | null;
    title: string;
    date: string;
    gofastCity: string;
    meetUpPoint: string;
    startTimeHour: number | null;
    startTimeMinute: number | null;
    startTimePeriod: string | null;
    gorunPath: string;
  }[];
  isGoFastContainer?: boolean;
  hostAthleteId?: string;
  containerMemberCount?: number;
  containerRecentMembers?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    photoURL: string | null;
    gofastHandle: string | null;
  }[];
  containerMessagesPreview?: {
    id: string;
    body: string;
    createdAt: string;
    authorDisplay: string;
  }[];
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(sec: number | null): string {
  if (sec == null || sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function GoFastPagePreviewCard({
  data,
}: {
  data: GoFastPagePayload;
}) {
  const appBase = getGoFastAppPublicUrl();
  const { athlete } = data;

  if (!athlete) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 text-zinc-100">
        <User className="w-12 h-12 text-zinc-600 mb-3" />
        <p className="text-zinc-400 text-center">This GoFast Page is not available.</p>
        <Link
          href="/"
          className="mt-4 text-amber-400 hover:text-amber-300 text-sm font-medium"
        >
          Back to GoFast
        </Link>
      </div>
    );
  }

  const displayName =
    [athlete.firstName, athlete.lastName].filter(Boolean).join(" ") ||
    (athlete.gofastHandle ? `@${athlete.gofastHandle}` : "Runner");

  const location =
    athlete.city && athlete.state
      ? `${athlete.city}, ${athlete.state}`
      : athlete.city || athlete.state || null;

  const signupUrl = `${appBase.replace(/\/$/, "")}/signup`;
  const heroSrc =
    athlete.myBestRunPhotoURL?.trim() || athlete.photoURL?.trim() || null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      <section className="relative min-h-[48vh] md:min-h-[52vh] flex flex-col justify-end overflow-hidden isolate">
        {heroSrc ? (
          <>
            <img
              src={heroSrc}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-center"
              decoding="async"
              fetchPriority="high"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-zinc-950/25"
              aria-hidden
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-orange-600/10 mix-blend-overlay"
              aria-hidden
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950" />
        )}

        {athlete.photoURL && heroSrc !== athlete.photoURL ? (
          <div className="absolute bottom-28 left-5 z-20 sm:bottom-32">
            <img
              src={athlete.photoURL}
              alt=""
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-4 border-zinc-950 shadow-xl"
            />
          </div>
        ) : null}

        <div className="relative z-10 max-w-3xl mx-auto px-5 pb-10 pt-20 w-full">
          <div className="flex items-center gap-2 text-amber-400/90 text-xs font-semibold uppercase tracking-[0.2em] mb-3">
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            GoFast Page
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white drop-shadow-lg">
            {displayName}
          </h1>
          {athlete.gofastHandle ? (
            <p className="mt-2 text-xl text-amber-300/95 font-medium">
              @{athlete.gofastHandle}
            </p>
          ) : null}
          {location ? (
            <p className="mt-3 text-zinc-200 flex items-center gap-2 text-sm sm:text-base">
              <MapPin className="w-4 h-4 shrink-0 text-amber-400/80" />
              {location}
              {athlete.primarySport ? (
                <span className="text-zinc-400">
                  · <span className="capitalize">{athlete.primarySport}</span>
                </span>
              ) : null}
            </p>
          ) : athlete.primarySport ? (
            <p className="mt-3 text-zinc-300 capitalize text-sm sm:text-base">
              {athlete.primarySport}
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={signupUrl}
              className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-500/25 hover:bg-amber-400 transition-colors"
            >
              {data.isGoFastContainer ? "Join & train with GoFast" : "Train with GoFast"}
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-5 space-y-10 -mt-2 relative z-20">
        {data.isGoFastContainer && athlete.gofastHandle ? (
          <section className="rounded-2xl border border-violet-500/35 bg-zinc-900/85 p-5 shadow-lg shadow-violet-950/20">
            <h2 className="text-lg font-semibold text-white mb-1">Community</h2>
            <p className="text-sm text-zinc-400 mb-4">
              Join {displayName}&apos;s GoFast Container — upcoming runs below, chatter in the app.
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <a
                href={`${appBase.replace(/\/$/, "")}/container/${encodeURIComponent(athlete.gofastHandle)}`}
                className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-400 transition-colors"
              >
                Join community
                <ChevronRight className="w-4 h-4" />
              </a>
              <span className="text-sm text-zinc-400">
                {data.containerMemberCount ?? 0} member
                {(data.containerMemberCount ?? 0) !== 1 ? "s" : ""}
              </span>
            </div>
            {(data.containerRecentMembers?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-2 mb-4">
                {data.containerRecentMembers!.slice(0, 8).map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-950/50 px-2 py-1 text-xs text-zinc-300"
                  >
                    {m.photoURL ? (
                      <img src={m.photoURL} alt="" className="h-5 w-5 rounded-full object-cover" />
                    ) : null}
                    {[m.firstName, m.lastName].filter(Boolean).join(" ") || m.gofastHandle || "Member"}
                  </span>
                ))}
              </div>
            ) : null}
            {(data.containerMessagesPreview?.length ?? 0) > 0 ? (
              <div className="border-t border-zinc-800 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                  Recent chatter
                </p>
                <ul className="space-y-2">
                  {data.containerMessagesPreview!.map((msg) => (
                    <li key={msg.id} className="text-sm text-zinc-300">
                      <span className="text-amber-400/90 font-medium">{msg.authorDisplay}</span>
                      <span className="text-zinc-600"> · </span>
                      <span className="text-zinc-400">{msg.body}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={`${appBase.replace(/\/$/, "")}/container/${encodeURIComponent(athlete.gofastHandle)}`}
                  className="mt-3 inline-block text-xs font-semibold text-amber-400 hover:text-amber-300"
                >
                  Open full feed in the app →
                </a>
              </div>
            ) : (
              <a
                href={`${appBase.replace(/\/$/, "")}/container/${encodeURIComponent(athlete.gofastHandle)}`}
                className="inline-block text-xs font-semibold text-amber-400 hover:text-amber-300"
              >
                Say hi in the app →
              </a>
            )}
          </section>
        ) : null}

        {data.upcomingRuns.length > 0 ? (
          <section>
            <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-amber-400" />
              Join their run
            </h2>
            <p className="text-sm text-zinc-500 mb-4">
              RSVP in the GoFast app — meet this runner on the road.
            </p>
            <ul className="space-y-3">
              {data.upcomingRuns.map((r) => {
                const runUrl = `${appBase.replace(/\/$/, "")}${r.gorunPath.startsWith("/") ? r.gorunPath : `/${r.gorunPath}`}`;
                return (
                  <li key={r.id}>
                    <a
                      href={runUrl}
                      className="block rounded-xl border border-amber-500/30 bg-zinc-900/70 px-4 py-4 hover:border-amber-400/60 hover:bg-zinc-900 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-zinc-100 group-hover:text-amber-200 transition-colors">
                            {r.title}
                          </p>
                          <p className="text-sm text-zinc-400 mt-1">
                            {formatWhen(r.date)} · {r.gofastCity}
                          </p>
                          <p className="text-sm text-zinc-500 mt-0.5">{r.meetUpPoint}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-amber-500/90 text-zinc-950 text-xs font-semibold px-3 py-1.5">
                          Join run
                        </span>
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {(data.trainingSummary || data.primaryChasingGoal) && (
          <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-zinc-900/90 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-400" />
              Training for
            </h2>
            {data.trainingSummary ? (
              <div className="space-y-2 text-zinc-200">
                <p className="font-medium text-white">{data.trainingSummary.planName}</p>
                {data.trainingSummary.raceName ? (
                  <p className="text-sm text-amber-200/90">{data.trainingSummary.raceName}</p>
                ) : null}
                <p className="text-sm text-zinc-400">
                  {data.trainingSummary.totalWeeks} weeks · started{" "}
                  {formatDateOnly(data.trainingSummary.startDate)}
                </p>
              </div>
            ) : data.primaryChasingGoal ? (
              <div className="space-y-2 text-zinc-200">
                <p className="font-medium text-white">
                  {data.primaryChasingGoal.name ||
                    data.primaryChasingGoal.raceName ||
                    data.primaryChasingGoal.distance}
                </p>
                {data.primaryChasingGoal.raceName && data.primaryChasingGoal.name ? (
                  <p className="text-sm text-amber-200/90">{data.primaryChasingGoal.raceName}</p>
                ) : null}
                {data.primaryChasingGoal.goalTime ? (
                  <p className="text-sm text-zinc-300">Goal: {data.primaryChasingGoal.goalTime}</p>
                ) : null}
                <p className="text-sm text-zinc-400">
                  Target {formatDateOnly(data.primaryChasingGoal.targetByDate)}
                </p>
              </div>
            ) : null}
          </section>
        )}

        {data.lastRun?.startTime ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Footprints className="w-5 h-5 text-amber-400" />
              Last run
            </h2>
            <p className="text-zinc-100 font-medium">
              {data.lastRun.activityName || data.lastRun.activityType || "Run"}
            </p>
            <p className="text-sm text-zinc-400 mt-1">
              {formatDateOnly(data.lastRun.startTime)}
              {data.lastRun.distanceMiles != null && data.lastRun.distanceMiles > 0
                ? ` · ${data.lastRun.distanceMiles.toFixed(1)} mi`
                : ""}
              {data.lastRun.durationSeconds != null && data.lastRun.durationSeconds > 0
                ? ` · ${formatDuration(data.lastRun.durationSeconds)}`
                : ""}
            </p>
          </section>
        ) : null}

        {athlete.bio ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm p-6 shadow-xl shadow-black/40">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-3">
              About
            </h2>
            <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap">{athlete.bio}</p>
          </section>
        ) : null}

        {data.signedUpRaces.length > 0 ? (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Races on the calendar
            </h2>
            <ul className="space-y-3">
              {data.signedUpRaces.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div>
                    <p className="font-medium text-zinc-100">{r.name}</p>
                    <p className="text-sm text-zinc-400 mt-0.5">
                      {formatDateOnly(r.raceDate)}
                      {r.city || r.state
                        ? ` · ${[r.city, r.state].filter(Boolean).join(", ")}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-sm text-amber-400/90 font-medium shrink-0">
                    {r.distanceMiles} mi · {r.raceType}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {data.upcomingWorkouts.length > 0 ? (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Timer className="w-5 h-5 text-amber-400" />
              Upcoming workouts
            </h2>
            <ul className="space-y-2">
              {data.upcomingWorkouts.map((w) => (
                <li
                  key={w.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                >
                  <span className="font-medium text-zinc-100">{w.title}</span>
                  <span className="text-sm text-zinc-400">
                    {w.date ? formatDateOnly(w.date) : ""}
                    {w.workoutType ? ` · ${w.workoutType}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="pt-8 text-center text-zinc-600 text-sm border-t border-zinc-800/80">
          <p>Powered by GoFast — running is better together.</p>
        </footer>
      </div>
    </div>
  );
}
