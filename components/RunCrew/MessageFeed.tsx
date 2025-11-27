'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface MessageFeedProps {
  crewId: string;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  athlete: {
    firstName: string;
    lastName: string;
    photoURL?: string;
  };
}

export default function MessageFeed({ crewId }: MessageFeedProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMessages();
  }, [crewId]);

  const loadMessages = async () => {
    try {
      const response = await api.get(`/runcrew/${crewId}/messages`);
      if (response.data.success) {
        setMessages(response.data.messages.reverse()); // Show oldest first
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      const response = await api.post(`/runcrew/${crewId}/messages`, {
        content: newMessage,
      });
      
      if (response.data.success) {
        setNewMessage('');
        loadMessages();
      }
    } catch (error) {
      console.error('Error posting message:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Messages</h2>
      
      <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
        {messages.map((message) => (
          <div key={message.id} className="border-b pb-3 last:border-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">
                {message.athlete.firstName} {message.athlete.lastName}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(message.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="text-sm text-gray-700">{message.content}</div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-md border-gray-300"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !newMessage.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

