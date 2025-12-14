'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Copy, Check, Link as LinkIcon } from 'lucide-react';

function RunCrewSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Get crew data from URL params or localStorage
  const crewId = searchParams?.get('crewId');
  const [crewData, setCrewData] = useState<any>(null);

  useEffect(() => {
    // Try to get crew data from localStorage first
    const storedCrew = localStorage.getItem('currentCrew');
    if (storedCrew) {
      try {
        setCrewData(JSON.parse(storedCrew));
      } catch (e) {
        console.error('Error parsing stored crew:', e);
      }
    }
  }, []);

  const crewCode = crewData?.joinCode || crewData?.crewCode || 'CODE123';
  const crewName = crewData?.name || 'Your Crew';

  // Generate custom invite URL
  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';
  const inviteUrl = `${BASE_URL}/runcrew/join?code=${crewCode}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      alert('Failed to copy link');
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(crewCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      alert('Failed to copy code');
    }
  };

  const handleGoToCentral = () => {
    if (crewId) {
      router.push(`/runcrew/${crewId}/admin`);
    } else if (crewData?.id) {
      router.push(`/runcrew/${crewData.id}/admin`);
    } else {
      router.push('/athlete-home');
    }
  };

  const createShareMessage = () => {
    return `You've been invited to join ${crewName} on GoFast!\n\nJoin here: ${inviteUrl}`;
  };

  const handleCopyMessage = async () => {
    try {
      const message = createShareMessage();
      await navigator.clipboard.writeText(message);
      alert('Share message copied to clipboard!');
    } catch (err) {
      alert('Failed to copy message');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto px-6 py-4">
          <div className="flex items-center justify-center">
            <Image 
              src="/logo.jpg" 
              alt="GoFast" 
              width={24}
              height={24}
              className="w-6 h-6 rounded-full"
            />
            <span className="text-xl font-bold text-gray-900 ml-3">GoFast</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-6 py-8">
        <div className="text-center">
          {/* Success Animation */}
          <div className="mb-8">
            <div className="w-24 h-24 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-6xl">✅</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Crew Created!</h1>
            <p className="text-gray-600">
              Congratulations! Your running crew is ready to go.
            </p>
          </div>

          {/* Invite Link Section - PRIMARY */}
          <div className="bg-gradient-to-br from-sky-50 to-sky-100 rounded-xl p-6 mb-6 border-2 border-sky-200">
            <div className="flex items-center justify-center mb-4">
              <LinkIcon className="w-6 h-6 text-sky-600 mr-2" />
              <h2 className="text-xl font-bold text-gray-900">Your Invite Link</h2>
            </div>
            <div className="bg-white rounded-lg p-4 mb-4 border-2 border-sky-300">
              <p className="text-sm font-mono text-sky-700 break-all text-center">
                {inviteUrl}
              </p>
            </div>
            <button
              onClick={handleCopyLink}
              className="w-full bg-sky-600 hover:bg-sky-700 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 shadow-md"
            >
              {copiedLink ? (
                <>
                  <Check className="w-5 h-5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  <span>Copy Invite Link</span>
                </>
              )}
            </button>
            <p className="text-xs text-gray-600 text-center mt-3">
              Share this link — friends can join with one click!
            </p>
          </div>

          {/* Share Message Section */}
          <div className="bg-orange-50 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Or Share This Message</h2>
            <div className="bg-white rounded-lg p-4 mb-4 border-2 border-orange-200">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {createShareMessage()}
              </p>
            </div>
            <button
              onClick={handleCopyMessage}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <Copy className="w-4 h-4" />
              <span>Copy Message</span>
            </button>
          </div>

          {/* Join Code (Fallback) */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Join Code (if needed)</p>
                <p className="text-lg font-mono font-bold text-gray-900">{crewCode}</p>
              </div>
              <button
                onClick={handleCopyCode}
                className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors flex items-center space-x-2"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span className="text-sm">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span className="text-sm">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleGoToCentral}
              className="w-full bg-orange-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-orange-600 transition-colors shadow-lg"
            >
              Go to Run Crew Central
            </button>
            
            <button
              onClick={() => router.push('/athlete-home')}
              className="w-full bg-white border-2 border-orange-200 text-gray-900 py-3 rounded-xl font-medium hover:border-orange-400 transition-colors"
            >
              Go Back to Athlete Central
            </button>
          </div>

          <p className="text-gray-500 text-sm mt-6">
            Your crew is live and ready for members! 🎉
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RunCrewSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <RunCrewSuccessContent />
    </Suspense>
  );
}
