"use client";

import { Plus } from "lucide-react";
import AnnouncementCard from "@/components/RunCrew/AnnouncementCard";
import type { AnnouncementRow } from "@/components/races/race-hub-types";

type RaceHubAnnouncementsSectionProps = {
  announcements: AnnouncementRow[];
  isAdmin: boolean;
  showAnnounceForm: boolean;
  onToggleAnnounceForm: () => void;
  announceTitle: string;
  announceBody: string;
  onAnnounceTitleChange: (value: string) => void;
  onAnnounceBodyChange: (value: string) => void;
  onCancelAnnounceForm: () => void;
  onPostAnnouncement: (e: React.FormEvent) => void;
  postingAnnounce: boolean;
  /** Compact mode hides the section heading (used inside Info tab on mobile). */
  compact?: boolean;
};

export default function RaceHubAnnouncementsSection({
  announcements,
  isAdmin,
  showAnnounceForm,
  onToggleAnnounceForm,
  announceTitle,
  announceBody,
  onAnnounceTitleChange,
  onAnnounceBodyChange,
  onCancelAnnounceForm,
  onPostAnnouncement,
  postingAnnounce,
  compact = false,
}: RaceHubAnnouncementsSectionProps) {
  if (announcements.length === 0 && !isAdmin) {
    return null;
  }

  return (
    <section className="space-y-3">
      {!compact ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900">Announcements</h2>
          {isAdmin ? (
            <button
              type="button"
              onClick={onToggleAnnounceForm}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              <Plus className="w-4 h-4" />
              {showAnnounceForm ? "Cancel" : "New announcement"}
            </button>
          ) : null}
        </div>
      ) : (
        isAdmin ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onToggleAnnounceForm}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              <Plus className="w-4 h-4" />
              {showAnnounceForm ? "Cancel" : "New announcement"}
            </button>
          </div>
        ) : null
      )}

      {isAdmin && showAnnounceForm ? (
        <form
          onSubmit={(e) => void onPostAnnouncement(e)}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3"
        >
          <input
            type="text"
            value={announceTitle}
            onChange={(e) => onAnnounceTitleChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Title"
          />
          <textarea
            value={announceBody}
            onChange={(e) => onAnnounceBodyChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            rows={3}
            placeholder="Details for the group…"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={postingAnnounce || !announceTitle.trim() || !announceBody.trim()}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {postingAnnounce ? "Posting…" : "Publish"}
            </button>
            <button
              type="button"
              onClick={onCancelAnnounceForm}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {announcements.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6">
          No announcements yet.
        </p>
      ) : (
        announcements.map((a) => (
          <AnnouncementCard
            key={a.id}
            announcement={{
              id: a.id,
              title: a.title,
              content: a.content,
              createdAt: a.createdAt,
              author: {
                firstName: a.Athlete?.firstName || "",
                lastName: a.Athlete?.lastName || "",
              },
            }}
          />
        ))
      )}
    </section>
  );
}
