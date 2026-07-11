import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ShareCreatorCardModel } from "@/lib/profile/share-creator-card-logic";

type Props = {
  card: ShareCreatorCardModel;
  icon: LucideIcon;
  accentClass: string;
};

const stateBadge: Record<ShareCreatorCardModel["state"], string> = {
  setup: "bg-gray-100 text-gray-700 border-gray-200",
  share: "bg-violet-100 text-violet-800 border-violet-200",
  manage: "bg-emerald-100 text-emerald-800 border-emerald-200",
  view: "bg-sky-100 text-sky-800 border-sky-200",
};

const stateLabel: Record<ShareCreatorCardModel["state"], string> = {
  setup: "Set up",
  share: "Share",
  manage: "Manage",
  view: "View",
};

export default function ShareCreatorCard({ card, icon: Icon, accentClass }: Props) {
  const secondaryExternal = card.secondaryHref?.startsWith("http");

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col h-full">
      <div className="flex items-start gap-3">
        <div className={`rounded-xl p-2.5 ${accentClass}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">{card.title}</h2>
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${stateBadge[card.state]}`}
            >
              {stateLabel[card.state]}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600 leading-relaxed">{card.description}</p>
          <p className="mt-2 text-xs font-medium text-gray-500">{card.statusLine}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 pt-4">
        <Link
          href={card.primaryHref}
          className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          {card.primaryLabel}
        </Link>
        {card.secondaryHref && card.secondaryLabel ? (
          secondaryExternal ? (
            <a
              href={card.secondaryHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              {card.secondaryLabel}
            </a>
          ) : (
            <Link
              href={card.secondaryHref}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              {card.secondaryLabel}
            </Link>
          )
        ) : null}
      </div>
    </article>
  );
}
