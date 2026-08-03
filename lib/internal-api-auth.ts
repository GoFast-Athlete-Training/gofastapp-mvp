export const INTERNAL_KEY_HEADER = "x-gofast-internal-key";

/** Headers for machine-lane calls to Company (notification triggers, etc.). */
export function internalApiHeaders(extra?: HeadersInit): HeadersInit {
  const key = process.env.GOFAST_INTERNAL_API_KEY?.trim();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(key ? { [INTERNAL_KEY_HEADER]: key } : {}),
    ...extra,
  };
}
