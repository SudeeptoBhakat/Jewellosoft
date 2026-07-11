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


def generate_voucher_no(shop):
    """
    Generates a unique Purchase Voucher number using the dynamic current year.
    Format: PV-{YYYY}-{NNN}  e.g.  PV-2026-001
    """
    from apps.accounts.models import NumberingSequence
    year = date.today().year
    next_num = NumberingSequence.get_next_number(shop, f"purchase_voucher_{year}")
    return f"PV-{year}-{next_num:03d}"


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
