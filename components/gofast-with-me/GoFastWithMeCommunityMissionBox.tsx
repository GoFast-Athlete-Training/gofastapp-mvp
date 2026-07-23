import { Users } from 'lucide-react';

type Props = {
  compact?: boolean;
};

export default function GoFastWithMeCommunityMissionBox({ compact }: Props) {
  return (
    <div
      className={`rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-sky-50 shadow-sm ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`shrink-0 rounded-xl bg-white border border-orange-100 shadow-sm flex items-center justify-center ${
            compact ? 'h-11 w-11' : 'h-14 w-14'
          }`}
          aria-hidden
        >
          <Users className={`text-orange-600 ${compact ? 'h-5 w-5' : 'h-7 w-7'}`} />
        </div>
        <div className="min-w-0">
          <h2 className={`font-bold text-gray-900 ${compact ? 'text-base' : 'text-lg'}`}>
            Build Your Community
          </h2>
          <p className={`text-gray-600 mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>
            Your public landing, training, and member hub — one place for people to GoFast with
            you.
          </p>
        </div>
      </div>
    </div>
  );
}
