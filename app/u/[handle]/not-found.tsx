import Link from 'next/link';
import { User } from 'lucide-react';

export default function ProfileNotFound() {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4">
      <User className="w-12 h-12 text-stone-300 mb-3" />
      <p className="text-stone-600 text-center">This profile is not available.</p>
      <Link
        href="/welcome"
        className="mt-4 text-orange-600 hover:text-orange-700 text-sm font-medium"
      >
        Go to GoFast
      </Link>
    </div>
  );
}
