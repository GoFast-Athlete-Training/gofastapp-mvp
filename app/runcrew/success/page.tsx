'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Copy, Check, Link as LinkIcon } from 'lucide-react';
import { getRunCrewJoinLink } from '@/lib/domain-runcrew';

function RunCrewSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [copiedLink, setCopiedLink] = useState(false);
  
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

  const crewName = crewData?.name || 'Your Crew';

  // Generate run crew URL using handle (public front door)
  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';
  const handle = crewData?.handle;
  const runCrewUrl = handle 
    ? `${BASE_URL}${getRunCrewJoinLink(handle)}`
    : `${BASE_URL}/runcrew`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(runCrewUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      alert('Failed to copy link');
    }
  };


  const handleGoToCentral = () => {
    if (crewId) {
      router.push(`/runcrew/${crewId}/admin`);
    } else if (crewData?.id) {
      router.push(`/runcrew/${crewData.id}/admin`);
    } else {
      router.push('/runcrew');
    }
  };

  const createShareMessage = () => {
    return `Check out ${crewName} on GoFast!\n\nView here: ${runCrewUrl}`;
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
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto px-4 sm:px-6 py-4">
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
      <div className="max-w-md mx-auto px-4 sm:px-6 py-8 w-full box-border">
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

          {/* Run Crew Link Section - PRIMARY */}
          <div className="bg-gradient-to-br from-sky-50 to-sky-100 rounded-xl p-4 sm:p-6 mb-6 border-2 border-sky-200 w-full box-border">
            <div className="flex items-center justify-center mb-4 flex-wrap">
              <LinkIcon className="w-6 h-6 text-sky-600 mr-2" />
              <h2 className="text-xl font-bold text-gray-900">Your Run Crew Link</h2>
            </div>
            <div className="bg-white rounded-lg p-3 sm:p-4 mb-4 border-2 border-sky-300 w-full overflow-hidden">
              <p className="text-xs sm:text-sm font-mono text-sky-700 break-all text-center">
                {runCrewUrl}
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
                  <span>Copy Run Crew Link</span>
                </>
              )}
            </button>
            <p className="text-xs text-gray-600 text-center mt-3">
              Share this link — friends can view and join your crew!
            </p>
          </div>

          {/* Share Message Section */}
          <div className="bg-orange-50 rounded-xl p-4 sm:p-6 mb-6 w-full box-border">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Or Share This Message</h2>
            <div className="bg-white rounded-lg p-3 sm:p-4 mb-4 border-2 border-orange-200 w-full overflow-hidden">
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-line break-words">
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

          {/* Action Button */}
          <div>
            <button
              onClick={handleGoToCentral}
              className="w-full bg-orange-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-orange-600 transition-colors shadow-lg"
            >
              Head to Your Run Crew
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
