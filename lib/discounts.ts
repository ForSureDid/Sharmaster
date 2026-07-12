// Single source of truth for the discount tiers advertised on /discounts.
// Keep in sync with the marketing copy there — the page imports these too.

export type DiscountTier = { percent: number; amount: number };

// "Накопительная скидка" — based on a customer's rolling 30-day order total.
// Not automated yet (requires wholesale-partner approval + order history lookup).
export const CUMULATIVE_DISCOUNT_TIERS: DiscountTier[] = [
  { percent: 5, amount: 10_000 },
  { percent: 10, amount: 20_000 },
  { percent: 12, amount: 60_000 },
  { percent: 14, amount: 100_000 },
  { percent: 16, amount: 150_000 },
  { percent: 17, amount: 200_000 },
  { percent: 18, amount: 300_000 },
  { percent: 20, amount: 400_000 },
];

// "Прогрессивная скидка (разовая)" — based on this cart/order's own subtotal.
// Automated: applied live in the cart and re-verified server-side at checkout.
export const ONE_TIME_DISCOUNT_TIERS: DiscountTier[] = [
  { percent: 10, amount: 30_000 },
  { percent: 14, amount: 100_000 },
  { percent: 17, amount: 200_000 },
  { percent: 20, amount: 400_000 },
];

function percentForAmount(tiers: DiscountTier[], amount: number): number {
  let percent = 0;
  for (const tier of tiers) {
    if (amount >= tier.amount) percent = tier.percent;
  }
  return percent;
}

export function getOneTimeDiscountPercent(subtotal: number): number {
  return percentForAmount(ONE_TIME_DISCOUNT_TIERS, subtotal);
}

// First tier the customer hasn't reached yet — used for "add N ₸ more" nudges.
export function nextOneTimeTier(subtotal: number): DiscountTier | null {
  return ONE_TIME_DISCOUNT_TIERS.find(t => subtotal < t.amount) ?? null;
}
