'use client';

import { useState } from 'react';
import api from '@/lib/api';

interface RSVPButtonProps {
  runId: string;
  currentStatus?: 'going' | 'not-going' | null;
  onStatusChange?: (status: 'going' | 'not-going') => void;
}

export default function RSVPButton({ runId, currentStatus, onStatusChange }: RSVPButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleRSVP = async (status: 'going' | 'not-going') => {
    setLoading(true);
    try {
      // TODO: Implement RSVP endpoint
      // const response = await api.post(`/runcrew/runs/${runId}/rsvp`, { status });
      // if (response.data.success) {
      //   onStatusChange?.(status);
      // }
      onStatusChange?.(status);
    } catch (error) {
      console.error('Error RSVPing:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleRSVP('going')}
        disabled={loading}
        className={`px-4 py-2 rounded ${
          currentStatus === 'going'
            ? 'bg-green-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        } disabled:opacity-50`}
      >
        Going
      </button>
      <button
        onClick={() => handleRSVP('not-going')}
        disabled={loading}
        className={`px-4 py-2 rounded ${
          currentStatus === 'not-going'
            ? 'bg-red-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        } disabled:opacity-50`}
      >
        Not Going
      </button>
    </div>
  );
}

