'use client';

import { Calendar, MapPin, Users } from 'lucide-react';

export interface ClubEvent {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  visibility: string;
  rsvpCount: number;
  myRsvpStatus: string | null;
}

interface ClubEventsListProps {
  events: ClubEvent[];
}

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatEventType(eventType: string) {
  return eventType.replace(/_/g, ' ');
}

export default function ClubEventsList({ events }: ClubEventsListProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
        No club events scheduled yet. Socials, clinics, and sponsor activations will show up here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <article
          key={event.id}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium capitalize text-sky-700">
                  {formatEventType(event.eventType)}
                </span>
                {event.visibility === 'members' ? (
                  <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                    Members only
                  </span>
                ) : null}
              </div>
              <h3 className="mt-2 text-base font-semibold text-gray-900">{event.title}</h3>
              {event.description ? (
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{event.description}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {formatEventDate(event.startsAt)}
                </span>
                {event.location ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {event.location}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {event.rsvpCount} going
                </span>
              </div>
            </div>
            {event.myRsvpStatus === 'going' ? (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                You&apos;re going
              </span>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
