export default function LoadingProfile() {
  return (
    <div className="min-h-screen bg-stone-50 animate-pulse">
      <div className="bg-sky-300 h-28" />
      <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-5">
        <div className="w-full aspect-[16/9] rounded-2xl bg-stone-200" />
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
