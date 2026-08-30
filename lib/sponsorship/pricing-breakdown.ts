export function extractCpmAmountFromBreakdown(pricingBreakdownJson: unknown): number {
  if (!pricingBreakdownJson || typeof pricingBreakdownJson !== "object") {
    return 0;
  }

  const breakdown = pricingBreakdownJson as Record<string, unknown>;
  if (typeof breakdown.impressionQty === "number" && breakdown.impressionQty > 0) {
    return breakdown.impressionQty;
  }

  return 0;
}
