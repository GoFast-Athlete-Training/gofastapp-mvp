import type { ActiveCommitmentSnapshot } from "@/lib/sponsorship/commitment-service";

type ProfileContainerSponsorshipBlockProps = {
  commitment: ActiveCommitmentSnapshot;
};

export function ProfileContainerSponsorshipBlock({
  commitment,
}: ProfileContainerSponsorshipBlockProps) {
  if (!commitment.creativeUrl && !commitment.ctaUrl) return null;

  return (
    <section
      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
      aria-label="Brand partnership"
    >
      <div className="flex items-center gap-2">
        {commitment.brandLogoUrlSnapshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={commitment.brandLogoUrlSnapshot}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          {commitment.brandNameSnapshot?.trim() || "Brand partner"}
        </p>
      </div>
      {commitment.creativeUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={commitment.creativeUrl}
          alt={commitment.brandNameSnapshot ?? "Brand partnership creative"}
          className="mt-3 w-full rounded-xl object-cover"
        />
      ) : null}
      {commitment.ctaUrl ? (
        <a
          href={commitment.ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Learn more
        </a>
      ) : null}
    </section>
  );
}
