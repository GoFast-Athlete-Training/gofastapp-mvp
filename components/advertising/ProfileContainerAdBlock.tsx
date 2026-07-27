import type { ActiveBlockSnapshot } from "@/lib/advertising/block-service";

type ProfileContainerAdBlockProps = {
  block: ActiveBlockSnapshot;
};

export function ProfileContainerAdBlock({ block }: ProfileContainerAdBlockProps) {
  if (!block.brandCampaignCollateralUrl && !block.ctaUrl) return null;

  return (
    <section
      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
      aria-label="Partner placement"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Partner</p>
      {block.brandCampaignCollateralUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.brandCampaignCollateralUrl}
          alt={block.altText ?? block.creativeName ?? "Partner creative"}
          className="mt-3 w-full rounded-xl object-cover"
        />
      ) : null}
      {block.ctaUrl ? (
        <a
          href={block.ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
        >
          {block.ctaLabel || "Learn more"}
        </a>
      ) : null}
    </section>
  );
}
