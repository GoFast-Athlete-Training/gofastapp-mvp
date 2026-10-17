export const COFFEE_FOOD_KINDS = ["COFFEE", "BAGELS", "OTHER"] as const;
export type CoffeeFoodKindValue = (typeof COFFEE_FOOD_KINDS)[number];

export const COFFEE_FOOD_KIND_LABELS: Record<CoffeeFoodKindValue, string> = {
  COFFEE: "Coffee",
  BAGELS: "Bagels",
  OTHER: "Other",
};

export function parseCoffeeFoodKind(value: unknown): CoffeeFoodKindValue | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().toUpperCase();
  if (COFFEE_FOOD_KINDS.includes(raw as CoffeeFoodKindValue)) {
    return raw as CoffeeFoodKindValue;
  }
  return null;
}

export function coffeeFoodKindLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = parseCoffeeFoodKind(value);
  return parsed ? COFFEE_FOOD_KIND_LABELS[parsed] : "—";
}
