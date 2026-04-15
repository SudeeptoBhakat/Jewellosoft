/**
 * ═══════════════════════════════════════════════════════════════
 *  JewelloSoft — Shared Billing Calculation Engine
 *  
 *  Single source of truth for all bill & order calculations.
 *  Supports Gold and Silver identically.
 *
 *  Three scenarios:
 *   1. Normal (no old metal)
 *   2. Old Weight < New Weight → Customer pays balance
 *   3. Old Weight > New Weight → Shop returns balance
 *
 *  GST Rule: Always calculated on FULL new product value + hallmark
 *            (never on the net/difference amount)
 * ═══════════════════════════════════════════════════════════════
 */

// ── Safe number parser (prevents NaN propagation) ──
const safe = (v) => {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ── Round to 2 decimal places ──
const r2 = (v) => Math.round(safe(v) * 100) / 100;

/**
 * Main calculation function.
 *
 * @param {Object}  p
 * @param {Array}   p.items            - [{weight, makingCharges}]
 * @param {number}  p.metalRate        - Rate per gram (₹/g)
 * @param {string}  p.oldSettlementMode - 'none' | 'weight' | 'value'
 * @param {number}  p.oldWeight        - Old metal weight (g), used when mode='weight'
 * @param {number}  p.oldDeductPct     - Deduction %, used when mode='weight' AND old>new
 * @param {number}  p.oldValueDirect   - Direct old value (₹), used when mode='value'
 * @param {number}  p.hallmarkCount    - Number of hallmark items
 * @param {number}  p.hallmarkValue    - Cost per hallmark (₹)
 * @param {boolean} p.isInvoice        - Whether GST applies (3% = 1.5 CGST + 1.5 SGST)
 * @param {number}  p.otherCharges     - Other charges (₹)
 * @param {number}  p.advance          - Advance payment (₹)
 * @param {number}  p.discount         - Discount (₹)
 * @param {number}  p.cashAmt          - Cash paid (for billing balance calc, optional)
 * @param {number}  p.onlineAmt        - Online paid (for billing balance calc, optional)
 * @returns {Object} Full calculation breakdown
 */
export function calculateBill(p) {
  // ── 1. Parse all inputs safely ──
  const metalRate      = safe(p.metalRate);
  const hallmarkCount  = Math.floor(safe(p.hallmarkCount));
  const hallmarkValue  = safe(p.hallmarkValue);
  const otherCharges   = safe(p.otherCharges);
  const advance        = safe(p.advance);
  const discount       = safe(p.discount);
  const cashP          = safe(p.cashAmt);
  const onlineP        = safe(p.onlineAmt);
  const isInvoice      = !!p.isInvoice;

  const oldMode        = p.oldSettlementMode || 'none';
  const oldWt          = safe(p.oldWeight);
  const oldDeductPct   = safe(p.oldDeductPct);
  const oldValueDirect = safe(p.oldValueDirect);

  // ── 2. Aggregate item-level values ──
  const items = Array.isArray(p.items) ? p.items : [];
  const totalWeight = r2(items.reduce((s, i) => s + safe(i.weight), 0));
  const totalMaking = r2(items.reduce((s, i) => s + safe(i.makingCharges), 0));
  const totalMetalValue = r2(totalWeight * metalRate);

  // Full new product value = metal + making on FULL new weight
  const newProductValue = r2(totalMetalValue + totalMaking);

  // ── 3. Hallmark ──
  const hallmarkAmt = r2(hallmarkCount * hallmarkValue);

  // ── 4. GST Base — ALWAYS on full new product + hallmark ──
  const gstBase  = r2(newProductValue + hallmarkAmt);
  const cgst     = isInvoice ? r2(gstBase * 0.015) : 0;
  const sgst     = isInvoice ? r2(gstBase * 0.015) : 0;
  const totalGst = r2(cgst + sgst);

  // ── 5. Determine old settlement value ──
  let effectiveOldValue = 0; // The credit value of old metal
  let oldMV = 0;             // Raw old metal value (before deduction)
  let oldDeductAmt = 0;      // Deduction amount
  let hasOld = false;

  if (oldMode === 'value' && oldValueDirect > 0) {
    // Direct value entry — user has pre-calculated the old metal worth
    effectiveOldValue = oldValueDirect;
    oldMV = oldValueDirect;    // For display: treat direct value as the "metal value"
    oldDeductAmt = 0;          // No deduction breakdown available
    hasOld = true;
  } else if (oldMode === 'weight' && oldWt > 0) {
    oldMV = r2(oldWt * metalRate);
    hasOld = true;

    if (oldWt <= totalWeight) {
      // Old < New: no deduction applied — old value = oldWeight × rate
      effectiveOldValue = oldMV;
      oldDeductAmt = 0;
    } else {
      // Old > New: deduction applied on the EXCESS weight only
      // Step 1: excess metal value
      const excessWt = r2(oldWt - totalWeight);
      const excessValue = r2(excessWt * metalRate);
      // Step 2: deduction on excess
      oldDeductAmt = r2(excessValue * (oldDeductPct / 100));
      const afterDeduction = r2(excessValue - oldDeductAmt);
      // effectiveOldValue = afterDeduction + (newWeight portion at full rate, no deduction)
      // But conceptually: return amount = afterDeduction, making is subtracted separately
      // We store the full picture and handle below
      effectiveOldValue = afterDeduction;
      // Recalculate oldMV to represent total old metal value for display
      oldMV = r2(oldWt * metalRate);
    }
  }

  // ── 6. Scenario branching ──
  let subtotal, netTotal, grandTotal, preRound;
  let transactionType = 'payable'; // 'payable' | 'return'

  if (!hasOld) {
    // ═══ SCENARIO 1: Normal (no old metal) ═══
    // Subtotal = newProductValue
    subtotal = newProductValue;
    netTotal = r2(subtotal + hallmarkAmt + totalGst);
    preRound = r2(netTotal + otherCharges - advance - discount);
    transactionType = 'payable';

  } else if (oldMode === 'value') {
    // ═══ DIRECT VALUE MODE ═══
    // Treat identically to old < new logic: subtract old value from product
    subtotal = r2(newProductValue - effectiveOldValue);
    netTotal = r2(subtotal + hallmarkAmt + totalGst);
    preRound = r2(netTotal + otherCharges - advance - discount);
    // If result is negative, customer gets money back
    transactionType = preRound >= 0 ? 'payable' : 'return';

  } else if (oldWt <= totalWeight) {
    // ═══ SCENARIO 2: Old < New (customer pays) ═══
    // Subtotal = newProductValue − oldValue
    subtotal = r2(newProductValue - effectiveOldValue);
    netTotal = r2(subtotal + hallmarkAmt + totalGst);
    preRound = r2(netTotal + otherCharges - advance - discount);
    transactionType = preRound >= 0 ? 'payable' : 'return';

  } else {
    // ═══ SCENARIO 3: Old > New (shop returns to customer) ═══
    // Return amount = afterDeduction (effectiveOldValue already has deduction applied)
    // Making charge is subtracted from the return
    subtotal = r2(effectiveOldValue - totalMaking);

    // Hallmark, GST, Other charges are subtracted from what shop returns
    // Advance and Discount are ADDED back (shop owes less → customer gave advance earlier)
    netTotal = r2(subtotal - hallmarkAmt - totalGst);
    preRound = r2(netTotal - otherCharges + advance + discount);
    transactionType = preRound > 0 ? 'return' : 'payable';
  }

  // ── 7. Rounding ──
  const roundOff = Math.round(preRound);
  const roundOffVal = r2(roundOff - preRound);
  const finalAmt = roundOff;

  // ── 8. Payment balance (for billing UI) ──
  const totalPaid = r2(cashP + onlineP);
  const balance   = r2(Math.abs(finalAmt) - totalPaid);

  // ── 9. Build result ──
  return {
    // Item aggregates
    totalWeight,
    totalMaking,
    totalMetalValue,
    newProductValue,

    // Old settlement
    hasOld,
    oldMode,
    oldWt:          oldMode === 'weight' ? oldWt : 0,
    oldMV,
    oldDeductAmt,
    oldDeductPct:   oldMode === 'weight' ? oldDeductPct : 0,
    effectiveOldValue,
    oldValueDirect: oldMode === 'value' ? oldValueDirect : 0,

    // Charges
    hallmarkAmt,
    gstBase,
    cgst,
    sgst,

    // Totals
    subtotal,
    netTotal,
    otherChargesVal: otherCharges,
    advanceVal:      advance,
    discountVal:     discount,
    preRound,
    roundOffVal,
    finalAmt,

    // Transaction type
    transactionType,

    // Payment
    totalPaid,
    balance,

    // Display helpers
    amountInWords: amountWords(finalAmt),
  };
}


/* ═══ Indian Number-to-Words ═══ */
function numToWords(n) {
  if (n === 0) return 'Zero';
  const o = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const t = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function c(num) {
    if (num === 0) return '';
    if (num < 20) return o[num] + ' ';
    if (num < 100) return t[Math.floor(num / 10)] + (num % 10 ? ' ' + o[num % 10] : '') + ' ';
    if (num < 1000) return o[Math.floor(num / 100)] + ' Hundred ' + c(num % 100);
    if (num < 100000) return c(Math.floor(num / 1000)).trim() + ' Thousand ' + c(num % 1000);
    if (num < 10000000) return c(Math.floor(num / 100000)).trim() + ' Lakh ' + c(num % 100000);
    return c(Math.floor(num / 10000000)).trim() + ' Crore ' + c(num % 10000000);
  }
  return c(Math.abs(Math.floor(n))).replace(/\s+/g, ' ').trim();
}

function amountWords(amt) {
  const absAmt = Math.abs(amt);
  const r = Math.floor(absAmt);
  const p = Math.round((absAmt - r) * 100);
  let s = numToWords(r) + ' Rupees';
  if (p > 0) s += ' and ' + numToWords(p) + ' Paise';
  return s + ' Only';
}

/* ═══ Safe currency formatter ═══ */
export const fmtCurrency = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '₹0.00';
  return '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const fmtInt = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '₹0';
  return '₹' + Math.abs(n).toLocaleString('en-IN');
};
