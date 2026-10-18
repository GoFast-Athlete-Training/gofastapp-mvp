"use client";

type Props = {
  isPublic: boolean;
  disabled?: boolean;
  onChange: (nextPublic: boolean) => void;
};

export function PlanVisibilityToggle({ isPublic, disabled = false, onChange }: Props) {
  return (
    <div
      className="inline-flex rounded-lg border border-stone-300 bg-white p-0.5"
      role="group"
      aria-label="Plan visibility"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false)}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm ${
          !isPublic ? "bg-stone-800 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
        }`}
        aria-pressed={!isPublic}
      >
        Private
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(true)}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm ${
          isPublic ? "bg-sky-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
        }`}
        aria-pressed={isPublic}
      >
        Public
      </button>
    </div>
  );
}
