#
# JewelloSoft Community Edition
# Copyright (c) 2026 Sudeepta Bhakat
# Licensed under the JewelloSoft Community License.
#
"""
Service layer for OldPurchaseVoucher — voucher number generation,
atomic application to bills, and safe release on bill deletion.
"""
import logging
from datetime import date
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger("jewellosoft")


def generate_voucher_no(shop, max_retries=100):
    """
    Generates a unique Purchase Voucher number using the dynamic current year.
    Format: PV-{YYYY}-{NNN}  e.g.  PV-2026-001
    """
    from apps.accounts.models import NumberingSequence
    from apps.old_purchases.models import OldPurchaseVoucher
    year = date.today().year
    seq_key = f"purchase_voucher_{year}"
    prefix = f"PV-{year}-"

    existing_nos = OldPurchaseVoucher.objects.filter(voucher_no__istartswith=prefix).values_list('voucher_no', flat=True)
    max_num = 0
    for no in existing_nos:
        try:
            parts = no.split('-')
            if len(parts) >= 3 and parts[2].isdigit():
                max_num = max(max_num, int(parts[2]))
        except Exception:
            pass

    try:
        seq, _ = NumberingSequence.objects.get_or_create(
            shop=shop,
            sequence_type=seq_key,
            defaults={'last_number': max_num}
        )
        if seq.last_number < max_num:
            seq.last_number = max_num
            seq.save(update_fields=['last_number'])
    except Exception:
        pass

    for _ in range(max_retries):
        next_num = NumberingSequence.get_next_number(shop, seq_key)
        candidate = f"PV-{year}-{next_num:03d}"
        if not OldPurchaseVoucher.objects.filter(voucher_no__iexact=candidate).exists():
            return candidate

    max_num += 1
    candidate = f"PV-{year}-{max_num:03d}"
    while OldPurchaseVoucher.objects.filter(voucher_no__iexact=candidate).exists():
        max_num += 1
        candidate = f"PV-{year}-{max_num:03d}"

    return candidate


@transaction.atomic
def apply_voucher(voucher, *, invoice_no=None, estimate_no=None):
    """
    Marks the voucher as adjusted and links it to the given bill/order.

    Must be called inside an outer atomic block (invoice creation).
    Raises ValueError if the voucher is already adjusted.
    """
    # Re-fetch with row-level lock to prevent race conditions
    locked = (
        type(voucher).objects
        .select_for_update()
        .get(pk=voucher.pk)
    )

    if locked.status != "not_adjusted":
        doc_no = locked.adjusted_invoice_no or locked.adjusted_estimate_no or "unknown"
        raise ValueError(
            f"Voucher {locked.voucher_no} is already adjusted against "
            f"{'Invoice' if locked.adjusted_invoice_no else 'Estimate'} {doc_no}. "
            f"Please select a different voucher."
        )

    if invoice_no:
        locked.status = "adjusted_invoice"
        locked.adjusted_invoice_no = invoice_no
    elif estimate_no:
        locked.status = "adjusted_estimate"
        locked.adjusted_estimate_no = estimate_no

    locked.adjusted_at = timezone.now()
    locked.save(update_fields=["status", "adjusted_invoice_no", "adjusted_estimate_no", "adjusted_at"])
    logger.info("Voucher %s adjusted -> %s%s", locked.voucher_no, invoice_no or "", estimate_no or "")
    return locked


@transaction.atomic
def release_voucher(voucher):
    """
    Resets a voucher to 'not_adjusted' when the linked bill/order is deleted.
    Safe to call even if voucher is already not_adjusted (idempotent).
    """
    locked = (
        type(voucher).objects
        .select_for_update()
        .get(pk=voucher.pk)
    )
    if locked.status == "not_adjusted":
        return  # Nothing to do

    logger.info(
        "Releasing voucher %s (was adjusted against %s)",
        locked.voucher_no,
        locked.adjusted_invoice_no or locked.adjusted_estimate_no,
    )
    locked.status = "not_adjusted"
    locked.adjusted_invoice_no = None
    locked.adjusted_estimate_no = None
    locked.adjusted_at = None
    locked.save(update_fields=["status", "adjusted_invoice_no", "adjusted_estimate_no", "adjusted_at"])
