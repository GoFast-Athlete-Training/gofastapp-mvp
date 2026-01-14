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

  // Fake crew data for the "See an Example" section
  const fakeCrew = {
    name: "Downtown Runners",
    description: "A friendly group of runners who meet every Saturday morning for long runs and coffee",
    icon: "🏃",
    city: "San Francisco",
    state: "CA",
    members: [
      { id: '1', firstName: 'Sarah', lastName: 'Chen', photoURL: null, role: 'admin' },
      { id: '2', firstName: 'Marcus', lastName: 'Johnson', photoURL: null, role: 'member' },
      { id: '3', firstName: 'Emma', lastName: 'Rodriguez', photoURL: null, role: 'member' },
      { id: '4', firstName: 'David', lastName: 'Kim', photoURL: null, role: 'member' },
      { id: '5', firstName: 'Jessica', lastName: 'Williams', photoURL: null, role: 'member' },
      { id: '6', firstName: 'Alex', lastName: 'Martinez', photoURL: null, role: 'member' },
      { id: '7', firstName: 'Jordan', lastName: 'Taylor', photoURL: null, role: 'member' },
      { id: '8', firstName: 'Maya', lastName: 'Patel', photoURL: null, role: 'member' },
    ],
    announcements: [
      {
        id: '1',
        title: 'Welcome to the Crew!',
        content: 'Excited to have everyone here. Our first group run is this Saturday at 7am. See you there!',
        athlete: { firstName: 'Sarah', lastName: 'Chen' },
        createdAtLabel: 'Mon, Jan 12 • 10:15 AM',
      },
      {
        id: '2',
        title: 'New Route This Week',
        content: 'We\'re trying a new 8-mile loop through Golden Gate Park. Should be beautiful!',
        athlete: { firstName: 'Sarah', lastName: 'Chen' },
        createdAtLabel: 'Tue, Jan 13 • 6:42 PM',
      },
    ],
    runs: [
      {
        id: '1',
        title: 'Saturday Morning Long Run',
        dateLabel: 'Sat, Jan 18 • 7:00 AM',
        meetUpPoint: 'Golden Gate Park - Stow Lake',
        totalMiles: 8,
        pace: '8:30/mi',
        athlete: { firstName: 'Sarah', lastName: 'Chen' },
        rsvps: 6,
      },
      {
        id: '2',
        title: 'Wednesday Tempo Run',
        dateLabel: 'Wed, Jan 22 • 6:15 PM',
        meetUpPoint: 'Embarcadero - Ferry Building',
        totalMiles: 5,
        pace: '7:30/mi',
        athlete: { firstName: 'Marcus', lastName: 'Johnson' },
        rsvps: 4,
      },
    ],
    events: [
      {
        id: '1',
        title: 'Post-Run Coffee Social',
        dateLabel: 'Sat, Jan 18 • 9:00 AM',
        time: '9:00 AM',
        location: 'Blue Bottle Coffee',
        address: '315 Linden St, San Francisco, CA',
        eventType: 'social',
        description: 'Join us for coffee and conversation after the Saturday run!',
        organizer: { firstName: 'Sarah', lastName: 'Chen' },
        rsvps: 8,
      },
    ],
    messages: [
      {
        id: '1',
        content: 'Can\'t wait for Saturday! Who else is in?',
        athlete: { firstName: 'David', lastName: 'Kim' },
        createdAtLabel: '3h ago',
      },
      {
        id: '2',
        content: 'I\'ll be there! First time joining - excited to meet everyone 🏃',
        athlete: { firstName: 'Jessica', lastName: 'Williams' },
        createdAtLabel: '2h ago',
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-sky-50 to-orange-50 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Example</p>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                What a crew “container” looks like
              </h1>
              <p className="text-gray-600 mt-2 max-w-2xl">
                This is a static demo with fake members, runs, events, announcements, and messages.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/runcrew/create"
                className="inline-flex justify-center items-center px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl shadow hover:bg-orange-600 transition"
              >
                Create your crew →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">

            {/* Crew Header */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-3xl border-2 border-gray-200">
                  {fakeCrew.icon}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{fakeCrew.name}</h3>
                  <p className="text-gray-600">{fakeCrew.description}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    📍 {fakeCrew.city}, {fakeCrew.state}
                  </p>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Sidebar: Members */}
              <aside className="lg:col-span-3">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sticky top-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Members</h3>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {fakeCrew.members.length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {fakeCrew.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 p-2 border border-gray-200 rounded hover:bg-gray-50 transition"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-semibold text-xs">
                          {member.firstName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {member.firstName} {member.lastName}
                            {member.role === 'admin' && (
                              <span className="text-orange-600 text-xs font-bold ml-1">Admin</span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>

              {/* Main Content */}
              <div className="lg:col-span-8 space-y-6">
                {/* Announcements */}
                <section className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border-2 border-orange-200 shadow-md p-5 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {fakeCrew.name} Announcements
                    </h3>
                    <p className="text-xs text-gray-600 font-medium">
                      Official updates from your crew
                    </p>
                  </div>
                  <div className="space-y-3">
                    {fakeCrew.announcements.map((announcement) => (
                      <div
                        key={announcement.id}
                        className="border border-orange-200 rounded-lg px-3 py-2 bg-white shadow-sm"
                      >
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-semibold">
                              {announcement.athlete.firstName[0]}
                            </div>
                            <span>
                              {announcement.athlete.firstName} {announcement.athlete.lastName}
                            </span>
                          </div>
                          <span>{announcement.createdAtLabel}</span>
                        </div>
                        {announcement.title && (
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">
                            {announcement.title}
                          </h4>
                        )}
                        <p className="text-xs text-gray-800 whitespace-pre-line">
                          {announcement.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Upcoming Runs */}
                <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Upcoming Runs</h3>
                    <p className="text-xs text-gray-500">See what's coming up</p>
                  </div>
                  <div className="space-y-3">
                    {fakeCrew.runs.map((run) => (
                      <div
                        key={run.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900 mb-1">
                              {run.title}
                            </h4>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-semibold">
                                {run.athlete.firstName[0]}
                              </div>
                              <span className="text-xs text-gray-500">
                                Created by {run.athlete.firstName} {run.athlete.lastName}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 space-y-1">
                              <p className="flex items-center gap-1">
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>{run.dateLabel}</span>
                              </p>
                              <p className="flex items-center gap-1">
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>{run.meetUpPoint}</span>
                              </p>
                              <p className="flex items-center gap-1">
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <span>
                                  {run.totalMiles} miles • {run.pace} pace
                                </span>
                              </p>
                              <p className="text-orange-600 font-semibold">
                                {run.rsvps} members going
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Social Events */}
                <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Upcoming Events</h3>
                    <p className="text-xs text-gray-500">Social gatherings and meetups</p>
                  </div>
                  <div className="space-y-3">
                    {fakeCrew.events.map((event) => (
                      <div
                        key={event.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900 mb-1">
                              {event.title}
                            </h4>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-semibold">
                                {event.organizer.firstName[0]}
                              </div>
                              <span className="text-xs text-gray-500">
                                Organized by {event.organizer.firstName} {event.organizer.lastName}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 space-y-1">
                              <p className="flex items-center gap-1">
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>{event.dateLabel}</span>
                              </p>
                              <p className="flex items-center gap-1">
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>{event.location}</span>
                              </p>
                              {event.description && (
                                <p className="text-gray-700">{event.description}</p>
                              )}
                              <p className="text-orange-600 font-semibold">
                                {event.rsvps} members going
                              </p>
                            </div>
                          </div>
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
                    {fakeCrew.messages.map((message) => (
                      <div
                        key={message.id}
                        className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-semibold">
                              {message.athlete.firstName[0]}
                            </div>
                            <span className="font-semibold text-sm text-gray-900">
                              {message.athlete.firstName} {message.athlete.lastName}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {message.createdAtLabel}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800">{message.content}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
