'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const FEATURES = [
  { icon: '📋', title: 'Train' },
  { icon: '👥', title: 'Find Others' },
  { icon: '🏁', title: 'Race' },
  { icon: '⏱️', title: 'PR' },
];

const SPLASH_HOLD_MS = 1600;
const TRANSITION_MS = 900;

export default function ExplainerPage() {
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), SPLASH_HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 relative overflow-hidden">
      {/* Splash: centered logo holds, then fades up/out */}
      <div
        className={`fixed inset-0 z-20 flex items-center justify-center pointer-events-none transition-opacity ease-out ${
          revealed ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ transitionDuration: `${TRANSITION_MS}ms` }}
      >
        <Image
          src="/logo.png"
          alt=""
          width={144}
          height={144}
          aria-hidden
          className={`w-36 h-36 rounded-full shadow-xl object-cover transition-all ease-out ${
            revealed ? 'scale-90 -translate-y-10 opacity-0' : 'scale-100 translate-y-0 opacity-100'
          }`}
          style={{ transitionDuration: `${TRANSITION_MS}ms` }}
          priority
        />
      </div>

      {/* Explainer content fades/slides in after splash */}
      <div
        className={`min-h-screen flex items-center justify-center transition-all ease-out ${
          revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
        style={{ transitionDuration: `${TRANSITION_MS}ms` }}
      >
        <div className="max-w-2xl w-full mx-auto px-4 py-12">
          <div className="text-center mb-10">
            <Image
              src="/logo.png"
              alt="GoFast Logo"
              width={128}
              height={128}
              className="w-32 h-32 rounded-full shadow-xl mx-auto mb-6 object-cover"
              priority
            />
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
              Find your pace group.<br />Train hard. PR.
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-5 mb-10">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex flex-col items-center gap-1">
                <span className="text-3xl">{feature.icon}</span>
                <h3 className="text-sm font-bold text-white">{feature.title}</h3>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => router.push('/signup')}
              className="w-full max-w-sm bg-white text-sky-600 px-8 py-4 rounded-xl font-bold text-lg shadow-2xl hover:bg-sky-50 transition transform hover:scale-105"
            >
              Join Now
            </button>
            <p className="text-white/80 text-sm">
              Already have an account?{' '}
              <button
                onClick={() => router.push('/signup')}
                className="text-white font-semibold hover:underline"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
