"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import api from "@/lib/api";

const SUGGESTIONS = [
  "Questions about my plan",
  "Injury advice",
  "Race prep",
];

export default function AskCoachPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) router.replace("/signup");
    });
    return () => unsub();
  }, [router]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setReply(null);
    try {
      const { data } = await api.post<{ reply: string }>("/ask-coach", { message: trimmed });
      setReply(data.reply ?? "");
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string; details?: string } } };
      setError(ax.response?.data?.details || ax.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(message);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Ask Reiki</h1>
            <p className="text-gray-600 text-sm mb-2">Your AI-powered coach assistant</p>
            <p className="text-gray-500 text-sm mb-8">
              Questions about your plan, injury, or race prep? Ask away — Reiki responds with practical
              running guidance (not medical advice).
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setMessage(s);
                    void send(s);
                  }}
                  disabled={loading}
                  className="text-sm px-3 py-1.5 rounded-full border border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mb-8">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Ask about your training, injury, race prep…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !message.trim()}
                className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? "Reiki is thinking…" : "Ask Reiki"}
              </button>
            </form>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm mb-6">
                {error}
              </div>
            )}

            {loading && !reply && (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-gray-500 animate-pulse">Reiki is thinking…</p>
              </div>
            )}

            {reply != null && reply !== "" && (
              <div className="rounded-xl border border-orange-100 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-orange-700 mb-3">Reiki</h2>
                <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">{reply}</div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
