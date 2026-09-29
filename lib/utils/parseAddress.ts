/**
 * Normalize city/state for staff-facing address fields.
 * Washington DC is stored as city="Washington DC", state=null — avoids ambiguous plain
 * "Washington" while keeping DC out of the state field. Slug derivation (`dc`) happens
 * separately via generateCitySlugFromParts / toCitySlug at mutation time.
 */
export function normalizeCityState(
  city: string | null,
  state: string | null
): { city: string | null; state: string | null } {
  const c = (city ?? "").toLowerCase().trim();
  const s = (state ?? "").toUpperCase().trim();

  const isDC =
    c === "dc" ||
    c === "district of columbia" ||
    c === "washington dc" ||
    c === "washington, dc" ||
    ((c === "washington" || c === "washington dc" || c === "washington, dc") && s === "DC");

  if (isDC) return { city: "Washington DC", state: null };
  return { city: city ?? null, state: state ?? null };
}

/**
 * Parse Google Maps formatted address into components
 *
 * Google Maps format: "123 Main St, City, State ZIP, Country"
 * Example: "1234 Wilson Blvd, Arlington, VA 22201, USA"
 *
 * Returns: { streetAddress, city, state, zip, country }
 */
export function parseGoogleAddress(formattedAddress: string): {
  streetAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
} {
  if (!formattedAddress) {
    return {
      streetAddress: '',
      city: null,
      state: null,
      zip: null,
      country: null,
    };
  }

  const parts = formattedAddress
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const plusCodePattern = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}\s+/i;
  if (parts[0] && plusCodePattern.test(parts[0])) {
    parts[0] = parts[0].replace(plusCodePattern, "").trim();
  }

  const first = parts[0] || "";
  const looksLikeStreet = /\d/.test(first) || /\b(st|street|ave|avenue|blvd|road|rd|dr|drive|ln|lane|way|pkwy|pl|place|ct|court|cir|circle|trl|trail)\b/i.test(first);
  const streetAddress = looksLikeStreet ? first : "";

  // In US-style Google addresses, country is usually the last segment.
  const countryRaw = parts.length >= 2 ? parts[parts.length - 1] : null;
  const isUsCountry =
    !countryRaw ||
    countryRaw.toUpperCase() === "USA" ||
    countryRaw.toUpperCase() === "US" ||
    countryRaw === "United States";
  const country = countryRaw;
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
    const zipMatch = stateZipPart.match(/(\d{5}(?:-\d{4})?|\b[A-Z0-9]{2,4}\s?\d[A-Z0-9]{2,4}\b)/i);
    if (zipMatch) {
      zip = zipMatch[1];
    }

    if (!isUsCountry) {
      // International: use the segment before country as city+postal; region often embedded in city segment.
      state = null;
    } else {
    const normalized = stateZipPart.toUpperCase();
    const stateNames: Record<string, string> = {
      ALABAMA: "AL",
      ALASKA: "AK",
      ARIZONA: "AZ",
      ARKANSAS: "AR",
      CALIFORNIA: "CA",
      COLORADO: "CO",
      CONNECTICUT: "CT",
      DELAWARE: "DE",
      FLORIDA: "FL",
      GEORGIA: "GA",
      HAWAII: "HI",
      IDAHO: "ID",
      ILLINOIS: "IL",
      INDIANA: "IN",
      IOWA: "IA",
      KANSAS: "KS",
      KENTUCKY: "KY",
      LOUISIANA: "LA",
      MAINE: "ME",
      MARYLAND: "MD",
      MASSACHUSETTS: "MA",
      MICHIGAN: "MI",
      MINNESOTA: "MN",
      MISSISSIPPI: "MS",
      MISSOURI: "MO",
      MONTANA: "MT",
      NEBRASKA: "NE",
      NEVADA: "NV",
      "NEW HAMPSHIRE": "NH",
      "NEW JERSEY": "NJ",
      "NEW MEXICO": "NM",
      "NEW YORK": "NY",
      "NORTH CAROLINA": "NC",
      "NORTH DAKOTA": "ND",
      OHIO: "OH",
      OKLAHOMA: "OK",
      OREGON: "OR",
      PENNSYLVANIA: "PA",
      "RHODE ISLAND": "RI",
      "SOUTH CAROLINA": "SC",
      "SOUTH DAKOTA": "SD",
      TENNESSEE: "TN",
      TEXAS: "TX",
      UTAH: "UT",
      VERMONT: "VT",
      VIRGINIA: "VA",
      WASHINGTON: "WA",
      "WEST VIRGINIA": "WV",
      WISCONSIN: "WI",
      WYOMING: "WY",
    };

    if (normalized.includes("DISTRICT OF COLUMBIA") || normalized === "DC") {
      state = "DC";
    } else if (stateNames[normalized]) {
      state = stateNames[normalized];
    } else {
      const stateMatch = normalized.match(/\b([A-Z]{2})\b/);
      if (stateMatch) {
        state = stateMatch[1];
      }
    }
    }
  }

  const cityStateNorm = normalizeCityState(city, state);
  return {
    streetAddress,
    city: cityStateNorm.city,
    state: cityStateNorm.state,
    zip,
    country,
  };
}

/**
 * Generate city slug from city name
 */
export function generateCitySlug(city: string | null): string {
  return generateCitySlugFromParts(city, null);
}

export function generateCitySlugFromParts(city: string | null, state: string | null): string {
  if (!city) return "";

  const normalizedCity = city.toLowerCase().trim();
  const normalizedState = (state || "").toUpperCase().trim();

  if (
    normalizedCity === "district of columbia" ||
    normalizedCity === "dc" ||
    normalizedCity === "washington dc" ||
    normalizedCity === "washington, dc" ||
    (normalizedCity === "washington" && normalizedState === "DC")
  ) {
    return "dc";
  }

  return normalizedCity
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

