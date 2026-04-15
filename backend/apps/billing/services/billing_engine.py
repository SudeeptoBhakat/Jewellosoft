"""
═══════════════════════════════════════════════════════════════
 JewelloSoft — Backend Billing Calculation Engine
 
 Single source of truth for server-side bill calculations.
 Mirrors the frontend billingCalcEngine.js logic exactly.

 Three scenarios:
  1. Normal (no old metal)
  2. Old Weight ≤ New Weight → Customer pays balance
  3. Old Weight > New Weight → Shop returns balance to customer

 GST Rule: ALWAYS calculated on (totalWeight × rate + totalMaking + hallmark)
           i.e. the FULL new product value + hallmark, never the net amount.
═══════════════════════════════════════════════════════════════
"""
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

ZERO = Decimal('0')
TWO_PLACES = Decimal('0.01')


def _safe(val):
    """Safely convert any input to Decimal, returning 0 on failure."""
    if val is None or val == '':
        return ZERO
    try:
        d = Decimal(str(val))
        if not d.is_finite():
            return ZERO
        return d
    except (InvalidOperation, TypeError, ValueError):
        return ZERO


def _r2(val):
    """Round to 2 decimal places."""
    return _safe(val).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


class BillingEngine:
    """
    Production-grade billing engine for jewellery invoicing.

    Params:
        items: list of dicts with 'weight' and optional 'making'
        rate_10gm: metal rate per 10 grams (divided by 10 internally)
        making_per_gm: default making charge per gram
        extra: dict with settlement and charge details
    """

    def __init__(self, items, rate_10gm, making_per_gm, extra):
        self.items = items or []
        self.rate_per_g = _safe(rate_10gm) / Decimal(10)
        self.making_per_g = _safe(making_per_gm)

        # Old settlement
        self.old_settlement_mode = extra.get('old_settlement_mode', 'none')
        self.old_weight = _safe(extra.get('old_weight', 0))
        self.old_less_percent = _safe(extra.get('old_less_percent', 0))
        self.old_value_direct = _safe(extra.get('old_value_direct', 0))

        # Charges
        self.hallmark = _safe(extra.get('hallmark_charges', 0))
        self.other = _safe(extra.get('other_charges', 0))
        self.advance = _safe(extra.get('advance', 0))
        self.discount = _safe(extra.get('discount', 0))

        # GST rates (percentage values, e.g. 1.5 for 1.5%)
        self.cgst_rate = _safe(extra.get('cgst', 0))
        self.sgst_rate = _safe(extra.get('sgst', 0))

    # ────────────────────────────────────────
    # 1. ITEM AGGREGATION
    # ────────────────────────────────────────
    def calculate_items(self):
        """Sum all item weights and making charges."""
        total_weight = ZERO
        total_making = ZERO

        for item in self.items:
            weight = _safe(item.get('weight', 0))

            if item.get('making') is not None:
                making = _safe(item['making'])
            else:
                making = weight * self.making_per_g

            total_weight += weight
            total_making += making

        return _r2(total_weight), _r2(total_making)

    # ────────────────────────────────────────
    # 2. MAIN CALCULATION
    # ────────────────────────────────────────
    def calculate(self):
        total_weight, total_making = self.calculate_items()

        # Full new product value
        total_metal_value = _r2(total_weight * self.rate_per_g)
        new_product_value = _r2(total_metal_value + total_making)

        # GST base — ALWAYS on full new product + hallmark
        gst_base = _r2(new_product_value + self.hallmark)
        cgst_amt = _r2(gst_base * self.cgst_rate / Decimal(100))
        sgst_amt = _r2(gst_base * self.sgst_rate / Decimal(100))
        total_gst = _r2(cgst_amt + sgst_amt)

        # ── Determine old settlement ──
        effective_old_value = ZERO
        old_mv = ZERO
        old_deduct_amt = ZERO
        has_old = False

        if self.old_settlement_mode == 'value' and self.old_value_direct > 0:
            effective_old_value = self.old_value_direct
            old_mv = self.old_value_direct
            has_old = True

        elif self.old_settlement_mode == 'weight' and self.old_weight > 0:
            old_mv = _r2(self.old_weight * self.rate_per_g)
            has_old = True

            if self.old_weight <= total_weight:
                # Old ≤ New: no deduction
                effective_old_value = old_mv
            else:
                # Old > New: deduction on excess
                excess_wt = _r2(self.old_weight - total_weight)
                excess_value = _r2(excess_wt * self.rate_per_g)
                old_deduct_amt = _r2(excess_value * self.old_less_percent / Decimal(100))
                effective_old_value = _r2(excess_value - old_deduct_amt)

        # ── Scenario branching ──
        if not has_old:
            # SCENARIO 1: Normal
            subtotal = new_product_value
            net_total = _r2(subtotal + self.hallmark + total_gst)
            pre_round = _r2(net_total + self.other - self.advance - self.discount)
            transaction_type = 'payable'

        elif self.old_settlement_mode == 'value':
            # DIRECT VALUE MODE
            subtotal = _r2(new_product_value - effective_old_value)
            net_total = _r2(subtotal + self.hallmark + total_gst)
            pre_round = _r2(net_total + self.other - self.advance - self.discount)
            transaction_type = 'payable' if pre_round >= 0 else 'return'

        elif self.old_weight <= total_weight:
            # SCENARIO 2: Old ≤ New (customer pays)
            subtotal = _r2(new_product_value - effective_old_value)
            net_total = _r2(subtotal + self.hallmark + total_gst)
            pre_round = _r2(net_total + self.other - self.advance - self.discount)
            transaction_type = 'payable' if pre_round >= 0 else 'return'

        else:
            # SCENARIO 3: Old > New (shop returns)
            subtotal = _r2(effective_old_value - total_making)
            net_total = _r2(subtotal - self.hallmark - total_gst)
            pre_round = _r2(net_total - self.other + self.advance + self.discount)
            transaction_type = 'return' if pre_round > 0 else 'payable'

        # Rounding
        final = pre_round.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
        round_off_val = _r2(final - pre_round)

        return {
            'total_weight': total_weight,
            'making_total': total_making,
            'total_metal_value': total_metal_value,
            'new_product_value': new_product_value,
            'subtotal': subtotal,
            'gst_base': gst_base,
            'cgst': cgst_amt,
            'sgst': sgst_amt,
            'hallmark': self.hallmark,
            'other_charges': self.other,
            'advance': self.advance,
            'discount': self.discount,
            'old_mv': old_mv,
            'old_deduct_amt': old_deduct_amt,
            'effective_old_value': effective_old_value,
            'net_total': net_total,
            'pre_round': pre_round,
            'round_off': round_off_val,
            'grand_total': abs(final),
            'transaction_type': transaction_type,
        }
