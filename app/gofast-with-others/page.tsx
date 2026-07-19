import AthleteAppShell from '@/components/athlete/AthleteAppShell';
import GoFastWithOthersDashboard from '@/components/gofast-with-me/GoFastWithOthersDashboard';

export const dynamic = 'force-dynamic';

export default function GoFastWithOthersPage() {
  return (
    <AthleteAppShell>
      <div className="px-4 sm:px-6 py-6">
        <GoFastWithOthersDashboard />
      </div>
    </AthleteAppShell>
  );
}
