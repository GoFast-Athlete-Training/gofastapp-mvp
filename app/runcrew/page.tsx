'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function RunCrewPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => router.push('/athlete-home')}
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <Image 
                src="/logo.jpg" 
                alt="GoFast" 
                width={32}
                height={32}
                className="w-8 h-8 rounded-full"
              />
              <span className="text-xl font-bold text-gray-900">GoFast</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Run with Others & Stay Accountable
          </h1>
          <p className="text-xl text-gray-600">
            Join a crew, track runs together, and crush your goals as a team
          </p>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Join a Crew</h3>
              <p className="text-gray-600">Start your own crew or join an existing one with friends</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📱</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Connect Your App</h3>
              <p className="text-gray-600">Link Garmin, Strava, or other running apps to sync automatically</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🏆</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Compete Together</h3>
              <p className="text-gray-600">Track progress, earn points, and stay motivated as a team</p>
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-4">
          <button
            onClick={() => router.push('/runcrew/create')}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 px-8 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Start Your Own Crew
          </button>
          <button
            onClick={() => router.push('/runcrew/join')}
            className="w-full bg-white border-2 border-orange-200 hover:border-orange-400 text-gray-900 py-4 px-8 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Join an Existing Crew
          </button>
        </div>
      </div>
    </div>
  );
}
