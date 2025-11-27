'use client';

interface AnnouncementCardProps {
  announcement: {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    author: {
      firstName: string;
      lastName: string;
    };
  };
}

export default function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold">{announcement.title}</h3>
        <span className="text-xs text-gray-500">
          {new Date(announcement.createdAt).toLocaleDateString()}
        </span>
      </div>
      <p className="text-gray-700 mb-2">{announcement.content}</p>
      <div className="text-sm text-gray-500">
        — {announcement.author.firstName} {announcement.author.lastName}
      </div>
    </div>
  );
}

