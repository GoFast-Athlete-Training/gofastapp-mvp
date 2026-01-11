'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Image from 'next/image';

export default function ExplainerPage() {
  const router = useRouter();

  // If user is already authenticated, redirect to welcome
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/welcome');
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-orange-50">
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-20">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <Image 
              src="/logo.jpg" 
              alt="GoFast Logo" 
              width={120}
              height={120}
              className="w-32 h-32 rounded-full shadow-xl"
              priority
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Welcome to GoFast
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            The platform that connects runners, builds communities, and helps you achieve your goals
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-8 border border-gray-200">
          <div className="space-y-8">
            {/* What is GoFast */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">What is GoFast?</h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                GoFast is a running community platform designed to bring runners together. 
                Whether you're training for a race, looking for running buddies, or just want 
                to connect with like-minded athletes, GoFast helps you find your crew and 
                stay motivated.
              </p>
            </section>

            {/* Features */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">What can you do on GoFast?</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-2xl">
                    👥
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Join RunCrews</h3>
                    <p className="text-gray-700">
                      Discover and join running groups in your area. Find crews that match your pace, 
                      goals, and schedule.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center text-2xl">
                    🏃
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Organize Runs</h3>
                    <p className="text-gray-700">
                      Plan group runs, track RSVPs, and coordinate meetups with your crew. 
                      Never run alone again.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-2xl">
                    📊
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Track Activities</h3>
                    <p className="text-gray-700">
                      Connect your devices and track your runs. See your progress and 
                      stay accountable with your crew.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center text-2xl">
                    🎯
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Train Together</h3>
                    <p className="text-gray-700">
                      Train for races with your crew. Share goals, celebrate milestones, 
                      and push each other to new heights.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Community */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Built for Runners, by Runners</h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                GoFast is more than just an app—it's a community. Connect with runners who share 
                your passion, support each other's goals, and build lasting friendships on the road 
                and trails.
              </p>
            </section>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Want to join?</h2>
          <p className="text-lg text-gray-600 mb-8">
            Create a free account and start connecting with runners in your community
          </p>
          <Link
            href="/signup"
            className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition shadow-lg hover:shadow-xl"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}

