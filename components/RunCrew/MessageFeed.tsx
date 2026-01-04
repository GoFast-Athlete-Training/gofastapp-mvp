'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

interface MessageFeedProps {
  crewId: string;
  topics?: string[];
  selectedTopic?: string;
  onTopicChange?: (topic: string) => void;
  isAdmin?: boolean; // If true, can edit/delete any message
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  athlete: {
    id: string;
    firstName: string;
    gofastHandle?: string;
    photoURL?: string;
  };
}

export default function MessageFeed({ crewId, topics = ['#general', '#runs', '#training tips', '#myvictories', '#social'], selectedTopic = '#general', onTopicChange, isAdmin = false }: MessageFeedProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentTopic, setCurrentTopic] = useState(selectedTopic);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    // Get current user ID
    const athlete = LocalStorageAPI.getAthlete();
    setCurrentUserId(athlete?.id || null);
  }, []);

  useEffect(() => {
    loadMessages();
  }, [crewId, currentTopic]);

  const loadMessages = async () => {
    try {
      // Use main hydration endpoint which includes messagesBox
      const response = await api.get(`/runcrew/${crewId}`);
      if (response.data.success && response.data.runCrew?.messagesBox?.messages) {
        // Filter messages by current topic (if topic field exists)
        let allMessages = response.data.runCrew.messagesBox.messages;
        const filtered = allMessages.filter((msg: any) => {
          // If message has topic field, filter by it; otherwise show all (backward compatibility)
          return !msg.topic || msg.topic === currentTopic;
        });
        // Messages come in desc order, reverse to show oldest first
        setMessages([...filtered].reverse());
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
        topic: currentTopic, // Include topic when posting
      });
      
      if (response.data.success) {
        setNewMessage('');
        // Reload messages after posting
        await loadMessages();
      }
    } catch (error) {
      console.error('Error posting message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTopicChange = (topic: string) => {
    setCurrentTopic(topic);
    if (onTopicChange) {
      onTopicChange(topic);
    }
  };

  const handleEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editContent.trim()) return;

    try {
      setLoading(true);
      const response = await api.put(`/runcrew/${crewId}/messages/${messageId}`, {
        content: editContent.trim(),
      });

      if (response.data.success) {
        setEditingMessageId(null);
        setEditContent('');
        await loadMessages();
      }
    } catch (error) {
      console.error('Error updating message:', error);
      alert('Failed to update message');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      setLoading(true);
      const response = await api.delete(`/runcrew/${crewId}/messages/${messageId}`);

      if (response.data.success) {
        await loadMessages();
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Failed to delete message');
    } finally {
      setLoading(false);
    }
  };

  const canEditMessage = (message: Message) => {
    return isAdmin || (currentUserId && message.athlete.id === currentUserId);
  };

  return (
    <div className="space-y-4">
      {/* Topic Selector */}
      {topics.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {topics.map((topic) => (
            <button
              key={topic}
              onClick={() => handleTopicChange(topic)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                currentTopic === topic
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {topic.charAt(0).toUpperCase() + topic.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Messages List */}
      <div className="space-y-3 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4 bg-gray-50">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((message) => {
            const isEditing = editingMessageId === message.id;
            const canEdit = canEditMessage(message);

            return (
              <div key={message.id} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {message.athlete.photoURL ? (
                      <img
                        src={message.athlete.photoURL}
                        alt={message.athlete.gofastHandle ? `@${message.athlete.gofastHandle}` : message.athlete.firstName}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-semibold">
                        {(message.athlete.firstName?.[0] || 'A').toUpperCase()}
                      </div>
                    )}
                    <span className="font-semibold text-sm text-gray-900">
                      {message.athlete.firstName}
                      {message.athlete.gofastHandle && (
                        <span className="text-gray-500 font-normal"> @{message.athlete.gofastHandle}</span>
                      )}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(message.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                      {message.updatedAt && message.updatedAt !== message.createdAt && (
                        <span className="ml-1 italic">(edited)</span>
                      )}
                    </span>
                  </div>
                  {canEdit && !isEditing && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(message)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                        disabled={loading}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(message.id)}
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
                        onClick={() => handleSaveEdit(message.id)}
                        disabled={loading || !editContent.trim()}
                        className="px-3 py-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded text-xs font-semibold"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={loading}
                        className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-700 pl-8">{message.content}</div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Message Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message to your crew..."
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !newMessage.trim()}
          className="px-6 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition"
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}

