/* eslint-disable react/no-unescaped-entities */
'use client';

import Link from 'next/link';

/**
 * Start a Crew - Example Page (React app)
 *
 * Route: /start-crew
 *
 * Purpose: Pure demo of what the crew "container" looks like.
 * The marketing explainer lives in the HTML landing site (`GoFastLanding/start-crew.html`).
 */
export default function StartCrewExamplePage() {
  const fakeCrew = {
    name: 'Downtown Runners',
    description: 'A friendly group of runners who meet every Saturday morning for long runs and coffee',
    icon: '🏃',
    city: 'San Francisco',
    state: 'CA',
    members: [
      { id: '1', firstName: 'Sarah', lastName: 'Chen', role: 'admin' as const },
      { id: '2', firstName: 'Marcus', lastName: 'Johnson', role: 'member' as const },
      { id: '3', firstName: 'Emma', lastName: 'Rodriguez', role: 'member' as const },
      { id: '4', firstName: 'David', lastName: 'Kim', role: 'member' as const },
      { id: '5', firstName: 'Jessica', lastName: 'Williams', role: 'member' as const },
      { id: '6', firstName: 'Alex', lastName: 'Martinez', role: 'member' as const },
      { id: '7', firstName: 'Jordan', lastName: 'Taylor', role: 'member' as const },
      { id: '8', firstName: 'Maya', lastName: 'Patel', role: 'member' as const },
    ],
    announcements: [
      {
        id: 'a1',
        title: 'Welcome to the Crew!',
        content: "Our first group run is this Saturday at 7am. See you there!",
        author: 'Sarah Chen',
        createdAtLabel: 'Mon, Jan 12 - 10:15 AM',
      },
      {
        id: 'a2',
        title: 'New Route This Week',
        content: "We're trying a new 8-mile loop through Golden Gate Park. Should be beautiful!",
        author: 'Sarah Chen',
        createdAtLabel: 'Tue, Jan 13 - 6:42 PM',
      },
    ],
    runs: [
      {
        id: 'r1',
        title: 'Saturday Morning Long Run',
        dateLabel: 'Sat, Jan 18 - 7:00 AM',
        meetUpPoint: 'Golden Gate Park - Stow Lake',
        totalMiles: 8,
        pace: '8:30/mi',
        createdBy: 'Sarah Chen',
        rsvps: 6,
      },
      {
        id: 'r2',
        title: 'Wednesday Tempo Run',
        dateLabel: 'Wed, Jan 22 - 6:15 PM',
        meetUpPoint: 'Embarcadero - Ferry Building',
        totalMiles: 5,
        pace: '7:30/mi',
        createdBy: 'Marcus Johnson',
        rsvps: 4,
      },
    ],
    events: [
      {
        id: 'e1',
        title: 'Post-Run Coffee Social',
        dateLabel: 'Sat, Jan 18 - 9:00 AM',
        location: 'Blue Bottle Coffee',
        description: 'Join us for coffee and conversation after the Saturday run!',
        organizer: 'Sarah Chen',
        rsvps: 8,
      },
    ],
    messages: [
      {
        id: 'm1',
        author: 'David Kim',
        createdAtLabel: '3h ago',
        content: "Can't wait for Saturday! Who else is in?",
      },
      {
        id: 'm2',
        author: 'Jessica Williams',
        createdAtLabel: '2h ago',
        content: "I'll be there! First time joining — excited to meet everyone.",
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-br from-sky-50 to-orange-50 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Example</p>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Crew container demo</h1>
              <p className="text-gray-600 mt-2 max-w-2xl">
                Static preview with fake members, runs, events, announcements, and messages.
              </p>
            </div>
            <Link
              href="/runcrew/create"
              className="inline-flex justify-center items-center px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl shadow hover:bg-orange-600 transition"
            >
              Create your crew →
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {/* Crew header */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-3xl border-2 border-gray-200">
              {fakeCrew.icon}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{fakeCrew.name}</h2>
              <p className="text-gray-600">{fakeCrew.description}</p>
              <p className="text-sm text-gray-500 mt-1">
                📍 {fakeCrew.city}, {fakeCrew.state}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Members */}
          <aside className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Members</h3>
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {fakeCrew.members.length}
                </span>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {fakeCrew.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 p-2 border border-gray-200 rounded hover:bg-gray-50 transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-semibold text-xs">
                      {m.firstName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {m.firstName} {m.lastName}
                        {m.role === 'admin' ? (
                          <span className="text-orange-600 text-xs font-bold ml-1">Admin</span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="lg:col-span-8 space-y-6">
            {/* Announcements */}
            <section className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border-2 border-orange-200 shadow-md p-5 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{fakeCrew.name} Announcements</h3>
                <p className="text-xs text-gray-600 font-medium">Official updates from your crew</p>
              </div>
              <div className="space-y-3">
                {fakeCrew.announcements.map((a) => (
                  <div key={a.id} className="border border-orange-200 rounded-lg px-3 py-2 bg-white shadow-sm">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{a.author}</span>
                      <span>{a.createdAtLabel}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">{a.title}</h4>
                    <p className="text-xs text-gray-800 whitespace-pre-line">{a.content}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Runs */}
            <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Upcoming Runs</h3>
                <p className="text-xs text-gray-500">See what's coming up</p>
              </div>
              <div className="space-y-3">
                {fakeCrew.runs.map((r) => (
                  <div key={r.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">{r.title}</h4>
                    <p className="text-xs text-gray-600 mb-2">Created by {r.createdBy}</p>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>📅 {r.dateLabel}</p>
                      <p>📍 {r.meetUpPoint}</p>
                      <p>⚡ {r.totalMiles} miles • {r.pace} pace</p>
                      <p className="text-orange-600 font-semibold">{r.rsvps} members going</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Events */}
            <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Upcoming Events</h3>
                <p className="text-xs text-gray-500">Social gatherings and meetups</p>
              </div>
              <div className="space-y-3">
                {fakeCrew.events.map((e) => (
                  <div key={e.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">{e.title}</h4>
                    <p className="text-xs text-gray-600 mb-2">Organized by {e.organizer}</p>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>📅 {e.dateLabel}</p>
                      <p>📍 {e.location}</p>
                      <p className="text-gray-700">{e.description}</p>
                      <p className="text-orange-600 font-semibold">{e.rsvps} members going</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Messages */}
            <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">RunCrew Chatter</h3>
                <p className="text-xs text-gray-500">Chat with your crew</p>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4 bg-gray-50">
                {fakeCrew.messages.map((m) => (
                  <div key={m.id} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-gray-900">{m.author}</span>
                      <span className="text-xs text-gray-500">{m.createdAtLabel}</span>
                    </div>
                    <p className="text-sm text-gray-800">{m.content}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}


