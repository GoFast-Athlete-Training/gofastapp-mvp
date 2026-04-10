"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";

/** Default chatter channels for race hub (stored as message topic strings). */
export const RACE_HUB_DEFAULT_TOPICS = [
  "general",
  "pace-goals",
  "social-meetups",
  "tips",
  "ask-the-community",
] as const;

const TOPIC_LABELS: Record<string, string> = {
  general: "General",
  "pace-goals": "Pace goals",
  "social-meetups": "Social / meetups",
  tips: "Tips",
  "ask-the-community": "Ask the community",
};

interface RaceMessageFeedProps {
  raceRegistryId: string;
  topics?: string[];
  selectedTopic?: string;
  /** Override scroll area height (e.g. taller hub layout). */
  messageListClassName?: string;
}

type ApiAthlete = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  gofastHandle: string | null;
  photoURL: string | null;
};

interface Message {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  topic?: string;
  athlete: ApiAthlete;
}

function normalizeMessage(raw: Record<string, unknown>): Message | null {
  const a = (raw.Athlete ?? raw.athlete) as ApiAthlete | undefined;
  if (!raw.id || typeof raw.content !== "string" || !a?.id) return null;
  return {
    id: String(raw.id),
    content: raw.content,
    createdAt: String(raw.createdAt),
    updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : undefined,
    topic: raw.topic != null ? String(raw.topic) : undefined,
    athlete: a,
  };
}

export default function RaceMessageFeed({
  raceRegistryId,
  topics = [...RACE_HUB_DEFAULT_TOPICS],
  selectedTopic = "general",
  messageListClassName = "max-h-96",
}: RaceMessageFeedProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentTopic, setCurrentTopic] = useState(selectedTopic);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUserId(LocalStorageAPI.getAthleteId());
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const res = await api.get(`/race-hub/${raceRegistryId}/messages`, {
        params: { topic: currentTopic },
      });
      const rawList = res.data?.messages;
      if (!Array.isArray(rawList)) {
        setMessages([]);
        return;
      }
      const normalized = rawList
        .map((m) => normalizeMessage(m as Record<string, unknown>))
        .filter(Boolean) as Message[];
      setMessages(normalized);
    } catch {
      setMessages([]);
    }
  }, [raceRegistryId, currentTopic]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setLoading(true);
    try {
      await api.post(`/race-hub/${raceRegistryId}/messages`, {
        content: newMessage.trim(),
        topic: currentTopic,
      });
      setNewMessage("");
      await loadMessages();
    } catch (err) {
      console.error("Race chatter post:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editContent.trim()) return;
    setLoading(true);
    try {
      await api.patch(`/race-hub/${raceRegistryId}/messages/${messageId}`, {
        content: editContent.trim(),
      });
      setEditingMessageId(null);
      setEditContent("");
      await loadMessages();
    } catch (err) {
      console.error("Race chatter edit:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm("Delete this message?")) return;
    setLoading(true);
    try {
      await api.delete(`/race-hub/${raceRegistryId}/messages/${messageId}`);
      await loadMessages();
    } catch (err) {
      console.error("Race chatter delete:", err);
    } finally {
      setLoading(false);
    }
  };

  const canEditMessage = (message: Message) =>
    Boolean(currentUserId && message.athlete?.id === currentUserId);

  const labelForTopic = (t: string) =>
    TOPIC_LABELS[t] ?? t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, " ");

  return (
    <div className="space-y-4">
      {topics.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {topics.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => setCurrentTopic(topic)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                currentTopic === topic
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {labelForTopic(topic)}
            </button>
          ))}
        </div>
      )}

      <div
        className={`space-y-3 overflow-y-auto border border-gray-200 rounded-lg p-4 bg-gray-50 ${messageListClassName}`}
      >
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No messages yet. Say hello!</p>
        ) : (
          messages.map((message) => {
            const isEditing = editingMessageId === message.id;
            const canEdit = canEditMessage(message);
            const name =
              message.athlete.firstName ||
              (message.athlete.gofastHandle ? `@${message.athlete.gofastHandle}` : "Runner");

            return (
              <div key={message.id} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {message.athlete.photoURL ? (
                      <img
                        src={message.athlete.photoURL}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-semibold">
                        {(name[0] || "R").toUpperCase()}
                      </div>
                    )}
                    <span className="font-semibold text-sm text-gray-900">{name}</span>
                    {message.athlete.gofastHandle ? (
                      <span className="text-gray-500 text-xs">@{message.athlete.gofastHandle}</span>
                    ) : null}
                    <span className="text-xs text-gray-500">
                      {new Date(message.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {canEdit && !isEditing && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMessageId(message.id);
                          setEditContent(message.content);
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700"
                        disabled={loading}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(message.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div className="pl-8 space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      rows={2}
                      disabled={loading}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSaveEdit(message.id)}
                        disabled={loading || !editContent.trim()}
                        className="px-3 py-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded text-xs font-semibold"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMessageId(null);
                          setEditContent("");
                        }}
                        disabled={loading}
                        className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-700 pl-8 whitespace-pre-wrap">{message.content}</div>
                )}
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Message the race crew…"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !newMessage.trim()}
          className="px-6 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition"
        >
          {loading ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
