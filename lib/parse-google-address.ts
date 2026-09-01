/**
 * Google formatted-address parsing — aligned with GoFastCompany lib/utils/parseAddress.ts
 * for CityRun meetup fields (street, city, state, zip, listing slug).
 */

function normalizeCityState(
  city: string | null,
  state: string | null
): { city: string | null; state: string | null } {
  const c = (city ?? "").toLowerCase().trim();
  const s = (state ?? "").toUpperCase().trim();

  const isDC =
    c === "dc" ||
    c === "district of columbia" ||
    ((c === "washington" || c === "washington dc" || c === "washington, dc") && s === "DC");

  if (isDC) return { city: "dc", state: null };
  return { city: city ?? null, state: state ?? null };
}

export type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

function component(
  components: GoogleAddressComponent[],
  ...types: string[]
): GoogleAddressComponent | undefined {
  return components.find((c) => types.some((t) => c.types.includes(t)));
}

/** Prefer Google `address_components` over comma-splitting formatted_address. */
export function parseGoogleAddressFromComponents(
  formattedAddress: string,
  components: GoogleAddressComponent[] | null | undefined
): {
  streetAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
} {
  if (!components?.length) {
    return parseGoogleAddress(formattedAddress);
  }

  const streetNumber = component(components, 'street_number')?.long_name ?? '';
  const route = component(components, 'route')?.long_name ?? '';
  const streetFromParts = [streetNumber, route].filter(Boolean).join(' ').trim();

  const locality =
    component(
      components,
      'locality',
      'postal_town',
      'sublocality',
      'sublocality_level_1',
      'neighborhood'
    )?.long_name ?? null;

  const admin1 = component(components, 'administrative_area_level_1');
  const stateShort = admin1?.short_name?.trim() || admin1?.long_name?.trim() || null;
  const postalCode = component(components, 'postal_code')?.long_name?.trim() || null;
  const country = component(components, 'country')?.long_name?.trim() || null;

  const normalized = normalizeCityState(locality, stateShort);
  const fallback = parseGoogleAddress(formattedAddress);

  return {
    streetAddress: streetFromParts || fallback.streetAddress || formattedAddress,
    city: normalized.city || fallback.city,
    state: normalized.state ?? fallback.state,
    zip: postalCode || fallback.zip,
    country: country || fallback.country,
  };
}

export function parseGoogleAddress(formattedAddress: string): {
  streetAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
} {
  if (!formattedAddress) {
    return { streetAddress: "", city: null, state: null, zip: null, country: null };
  }

  const parts = formattedAddress
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const first = parts[0] || "";
  const looksLikeStreet =
    /\d/.test(first) ||
    /\b(st|street|ave|avenue|blvd|road|rd|dr|drive|ln|lane|way|pkwy|pl|place|ct|court|cir|circle|trl|trail)\b/i.test(
      first
    );
  const streetAddress = looksLikeStreet ? first : "";
  const country = parts.length >= 2 ? parts[parts.length - 1] : null;
  const stateZipPart = parts.length >= 2 ? parts[parts.length - 2] : null;

  let city: string | null = null;
  if (looksLikeStreet) {
    city = parts[1] || null;
  } else {
    city = first || null;
  }

  let state: string | null = null;
  let zip: string | null = null;
  if (stateZipPart) {
    const zipMatch = stateZipPart.match(/(\d{5}(?:-\d{4})?)/);
    if (zipMatch) zip = zipMatch[1];

    const normalizedPart = stateZipPart.toUpperCase();
    if (normalizedPart.includes("DISTRICT OF COLUMBIA") || normalizedPart === "DC") {
      state = "DC";
    } else {
      const stateMatch = normalizedPart.match(/\b([A-Z]{2})\b/);
      if (stateMatch) state = stateMatch[1];
    }
  }

  const normalized = normalizeCityState(city, state);
  return {
    streetAddress,
    city: normalized.city,
    state: normalized.state,
    zip,
    country,
  };
}

export function generateCitySlugFromParts(city: string | null, state: string | null): string {
  if (!city) return "";

  const normalizedCity = city.toLowerCase().trim();
  const normalizedState = (state || "").toUpperCase().trim();

  if (
    normalizedCity === "district of columbia" ||
    normalizedCity === "dc" ||
    ((normalizedCity === "washington" ||
      normalizedCity === "washington dc" ||
      normalizedCity === "washington, dc") &&
      normalizedState === "DC")
  ) {
    return "dc";
  }

  return normalizedCity
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
