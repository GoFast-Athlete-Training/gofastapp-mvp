type Props = {
  totalMiles?: number | null;
  pace?: string | null;
  /** Shorter padding for hub route thumb card */
  compact?: boolean;
};

/**
 * Labeled distance + pace — never bare "8:30–9:00" without context.
 */
export default function RunMilesPaceStrip({
  totalMiles,
  pace,
  compact = false,
}: Props) {
  const hasMiles =
    totalMiles != null && Number.isFinite(Number(totalMiles));
  const paceLine = pace?.trim() || null;
  if (!hasMiles && !paceLine) return null;

  const pad = compact ? 'px-2.5 py-2' : 'px-3 py-2.5';
  const cols = hasMiles && paceLine ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <div className={`grid gap-2 ${cols}`}>
      {hasMiles ? (
        <div className={`rounded-lg border border-gray-100 bg-gray-50 ${pad}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Miles
          </p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-gray-900">
            {totalMiles}
          </p>
        </div>
      ) : null}
      {paceLine ? (
        <div className={`rounded-lg border border-gray-100 bg-gray-50 ${pad}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Pace
          </p>
          <p className="mt-0.5 text-base font-semibold text-gray-900">{paceLine}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
            Planned pace for this run (min/mi)
          </p>
        </div>
      ) : null}
    </div>
  );
}
