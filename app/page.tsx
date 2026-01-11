'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Image from 'next/image';

export default function RootPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      // Show logo for 2 seconds, then route
      const timer = setTimeout(() => {
        if (isAuthenticated) {
          router.replace('/welcome');
        } else {
          router.replace('/explainer');
        }
      }, 1500); // Logo shows for 1.5 seconds, then route

      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-white rounded-full mx-auto mb-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
      <div className="animate-fade-in">
        <Image 
          src="/logo.jpg" 
          alt="GoFast Logo" 
          width={192}
          height={192}
          className="w-48 h-48 rounded-full shadow-2xl mx-auto"
          priority
        />
      </div>
    </div>
  );
}
