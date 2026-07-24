import GoFastWithMeStudioAppShell from '@/components/gofast-with-me/GoFastWithMeStudioAppShell';
import GoFastWithOthersDashboard from '@/components/gofast-with-me/GoFastWithOthersDashboard';

export const dynamic = 'force-dynamic';

export default function GoFastWithOthersPage() {
  return (
    <GoFastWithMeStudioAppShell>
      <div className="px-4 sm:px-6 py-6">
        <GoFastWithOthersDashboard />
      </div>
    </GoFastWithMeStudioAppShell>
  );
}
