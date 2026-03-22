"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import api from "@/lib/api";

type JournalEntry = {
  id: string;
  date: string;
  text: string;
  createdAt: string;
};

function formatEntryDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function JournalPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [text, setText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ entries: JournalEntry[] }>("/journal");
      setEntries(data.entries ?? []);
    } catch (e) {
      console.error(e);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) router.replace("/signup");
    });
    return () => unsub();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.post<{ entry: JournalEntry }>("/journal", {
        text: text.trim(),
        date: dateStr ? `${dateStr}T12:00:00.000Z` : undefined,
      });
      if (data.entry) {
        setEntries((prev) => [data.entry, ...prev]);
        setText("");
      }
    } catch (err) {
      console.error(err);
      alert("Could not save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Training journal</h1>
            <p className="text-gray-600 text-sm mb-8">
              Log how you felt, what you did, and notes for your next run.
            </p>

            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-10"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4">New entry</h2>
              <div className="mb-4">
                <label htmlFor="journal-date" className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  id="journal-date"
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="journal-text" className="block text-sm font-medium text-gray-700 mb-1">
                  Entry
                </label>
                <textarea
                  id="journal-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={saving || !text.trim()}
                className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save entry"}
              </button>
            </form>

            <h2 className="text-lg font-semibold text-gray-900 mb-4">Past entries</h2>
            {loading ? (
              <p className="text-gray-500">Loading…</p>
            ) : entries.length === 0 ? (
              <p className="text-gray-500">No entries yet. Write your first one above.</p>
            ) : (
              <ul className="space-y-4">
                {entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
                  >
                    <p className="text-xs font-medium text-orange-600 mb-2">
                      {formatEntryDate(entry.date)}
                    </p>
                    <p className="text-gray-800 whitespace-pre-wrap">{entry.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
