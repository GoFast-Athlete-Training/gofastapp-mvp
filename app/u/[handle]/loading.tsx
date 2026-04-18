export default function LoadingProfile() {
  return (
    <div className="min-h-screen bg-stone-50 animate-pulse">
      <div className="w-full aspect-[16/9] sm:aspect-[16/7] bg-stone-200" />
      <div className="max-w-2xl mx-auto px-5 sm:px-6">
        <div className="flex items-end gap-4 -mt-10 sm:-mt-12">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-stone-300 ring-4 ring-white" />
          <div className="flex-1 pb-2 space-y-2">
            <div className="h-6 bg-stone-300 rounded w-2/3" />
            <div className="h-3 bg-stone-200 rounded w-1/3" />
          </div>
        </div>
        <div className="mt-3 h-3 bg-stone-200 rounded w-1/2" />
      </div>

      <div className="max-w-2xl mx-auto px-5 sm:px-6 mt-8 space-y-6">
        <div className="h-32 rounded-2xl bg-orange-100/50 border border-orange-200" />
        <div className="h-28 rounded-2xl bg-white border border-stone-200" />
        <div className="space-y-3">
          <div className="h-5 w-40 bg-stone-200 rounded" />
          <div className="h-40 rounded-2xl bg-white border border-stone-200" />
          <div className="h-32 rounded-2xl bg-white border border-stone-200" />
        </div>
      </div>
    </div>
  );
}
