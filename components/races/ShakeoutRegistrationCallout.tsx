"use client";

import { ExternalLink } from "lucide-react";
import {
  isValidRegistrationUrl,
  normalizeRegistrationUrl,
} from "@/lib/shakeout-registration";

type Props = {
  registrationRequired?: boolean | null;
  registrationUrl?: string | null;
  className?: string;
};

export default function ShakeoutRegistrationCallout({
  registrationRequired,
  registrationUrl,
  className = "",
}: Props) {
  const showRequired = registrationRequired === true;
  const registerHref = normalizeRegistrationUrl(registrationUrl);
  const showRegister = registerHref != null && isValidRegistrationUrl(registerHref);

  if (!showRequired && !showRegister) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      {showRequired ? (
        <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
          Registration Required
        </span>
      ) : null}
      {showRegister ? (
        <a
          href={registerHref!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:text-sky-900 hover:underline"
        >
          Register for Event
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
