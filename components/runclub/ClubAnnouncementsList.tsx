'use client';

import { Megaphone } from 'lucide-react';

export interface ClubAnnouncement {
  id: string;
  title: string | null;
  body: string;
  visibility: string;
  publishedAt: string;
  author: {
    firstName: string | null;
    lastName: string | null;
    photoURL: string | null;
  };
}

interface ClubAnnouncementsListProps {
  announcements: ClubAnnouncement[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ClubAnnouncementsList({ announcements }: ClubAnnouncementsListProps) {
  if (announcements.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
        No announcements yet. Club leaders can post updates here soon.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {announcements.map((announcement) => {
        const authorName = [announcement.author.firstName, announcement.author.lastName]
          .filter(Boolean)
          .join(' ');

        return (
          <article
            key={announcement.id}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-orange-100 p-2 text-orange-600">
                <Megaphone className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span>{formatDate(announcement.publishedAt)}</span>
                  {authorName ? <span>· {authorName}</span> : null}
                  {announcement.visibility === 'members' ? (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700">
                      Members
                    </span>
                  ) : null}
                </div>
                {announcement.title ? (
                  <h3 className="mt-2 text-base font-semibold text-gray-900">
                    {announcement.title}
                  </h3>
                ) : null}
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">
                  {announcement.body}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
