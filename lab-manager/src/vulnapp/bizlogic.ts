// Tier-2 Business-Logic target. The checkout endpoint computes a total from
// client-supplied quantity and coupons WITHOUT enforcing the business rules
// (quantity > 0, single-use coupons, total >= 0). So a negative quantity or a
// stacked/reused coupon drives the total to zero or negative — the store pays YOU.
// Stateless synthetic pricing, so no per-user table.
import { emit } from '../telemetry/pipeline.js';

const UNIT_PRICE = 1000; // ₹ per item
const COUPONS: Record<string, number> = { FLAT500: 500, SAVE200: 200 }; // meant single-use

export interface CheckoutResult {
  unitPrice: number;
  quantity: number;
  discount: number;
  total: number;
  exploit: boolean;
  reasons: string[];
}

export async function checkout(userId: string, quantity: unknown, coupons: unknown): Promise<CheckoutResult> {
  const q = Number(quantity);
  const applied = Array.isArray(coupons) ? coupons.map((c) => String(c).toUpperCase()) : [];
  const discount = applied.reduce((s, c) => s + (COUPONS[c] ?? 0), 0);
  const total = UNIT_PRICE * (Number.isFinite(q) ? q : 0) - discount;

  const reasons: string[] = [];
  if (!Number.isFinite(q) || q < 1) reasons.push('quantity < 1 accepted (should be rejected)');
  const seen = new Set<string>();
  let reused = false;
  for (const c of applied) { if (seen.has(c)) reused = true; seen.add(c); }
  if (reused) reasons.push('same coupon applied more than once (should be single-use)');
  if (total <= 0) reasons.push('total is zero or negative — the store would pay you');

  const exploit = reasons.length > 0;
  await emit({ userId, labId: 'business-logic', type: 'exploit_attempt', payload: { q, applied, total }, outcome: 'neutral' });
  if (exploit) {
    await emit({ userId, labId: 'business-logic', type: 'exploit_success', payload: { total, reasons }, outcome: 'success' });
  }
  return { unitPrice: UNIT_PRICE, quantity: q, discount, total, exploit, reasons };
}
