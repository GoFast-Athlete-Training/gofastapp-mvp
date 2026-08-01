import type { ActiveCommitmentSnapshot } from "@/lib/sponsorship/commitment-service";

type ProfileContainerAdBlockProps = {
  block: ActiveCommitmentSnapshot;
};

/** @deprecated Use ProfileContainerSponsorshipBlock */
export function ProfileContainerAdBlock({ block }: ProfileContainerAdBlockProps) {
  const brandName = block.brandNameSnapshot?.trim() || "Brand partner";
  const imageUrl = block.creativeUrl?.trim() || block.brandLogoUrlSnapshot?.trim() || null;
  const ctaUrl = block.ctaUrl?.trim() || null;

  if (!imageUrl && !ctaUrl) return null;

  return (
    <section
      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
      aria-label="Partner placement"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Partner</p>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={brandName} className="mt-3 w-full rounded-xl object-cover" />
      ) : null}
      {ctaUrl ? (
        <a
          href={ctaUrl}
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
