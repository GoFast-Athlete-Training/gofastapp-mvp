'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import api from '@/lib/api';

type Props = {
  cityRunId: string;
  className?: string;
};

export default function CityRunHostActions({ cityRunId, className = '' }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (deleting) return;
    const ok = window.confirm(
      'Delete this run? People with the link will no longer see it.'
    );
    if (!ok) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/me/hosted-run-invites/${encodeURIComponent(cityRunId)}`);
      router.push('/build-a-run');
    } catch (e) {
      console.error(e);
      setDeleteError('Could not delete this run.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Link
        href={`/host-a-run/${encodeURIComponent(cityRunId)}`}
        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
      >
        <Pencil className="h-4 w-4" aria-hidden />
        Edit run
      </Link>
      <button
        type="button"
        disabled={deleting}
        onClick={() => void handleDelete()}
        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        {deleting ? 'Deleting…' : 'Delete'}
      </button>
      {deleteError ? (
        <p className="w-full text-sm text-red-600">{deleteError}</p>
      ) : null}
    </div>
  );
}
