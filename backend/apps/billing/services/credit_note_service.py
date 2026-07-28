#
# JewelloSoft Community Edition
# Copyright (c) 2026 Sudeepta Bhakat
# Licensed under the JewelloSoft Community License.
#
from decimal import Decimal
from django.db import transaction, IntegrityError
from django.utils import timezone
from datetime import date, timedelta

from apps.billing.models import CreditNote, CreditNoteUsage
from apps.payments.models import LedgerEntry
from apps.accounts.models import NumberingSequence
from apps.accounts.models import Shop
from apps.customers.models import Customer
from apps.billing.models import Invoice
from apps.orders.models import Order

def _generate_credit_note_no(shop, max_retries=100):
    year = date.today().year
    seq_key = f'credit_note_{year}'
    prefix = f"CN-{year}-"

    # Find highest numeric suffix among existing credit notes for this year
    existing_nos = CreditNote.objects.filter(credit_note_no__istartswith=prefix).values_list('credit_note_no', flat=True)
    max_num = 0
    for no in existing_nos:
        try:
            parts = no.split('-')
            if len(parts) >= 3 and parts[2].isdigit():
                max_num = max(max_num, int(parts[2]))
        except Exception:
            pass

    # Ensure sequence last_number is at least max_num so get_next_number starts above existing numbers
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
        candidate = f"CN-{year}-{next_num:03d}"
        if not CreditNote.objects.filter(credit_note_no__iexact=candidate).exists():
            return candidate

    # Fallback if candidates are still occupied
    max_num += 1
    candidate = f"CN-{year}-{max_num:03d}"
    while CreditNote.objects.filter(credit_note_no__iexact=candidate).exists():
        max_num += 1
        candidate = f"CN-{year}-{max_num:03d}"

    return candidate


@transaction.atomic
def create_credit_note(payload):
    shop = Shop.objects.get(id=payload['shop_id'])
    customer = Customer.objects.get(id=payload['customer_id'], shop=shop)

    credit_amount = Decimal(str(payload.get('credit_amount', 0)))
    if credit_amount <= Decimal('0'):
        raise ValueError("Credit amount must be greater than zero.")

    reason = (payload.get('reason') or '').strip()
    if not reason:
        raise ValueError("A reason must be provided for the credit note.")

    source_invoice = None
    source_invoice_id = payload.get('source_invoice_id')
    if source_invoice_id:
        source_invoice = Invoice.objects.get(id=source_invoice_id, shop=shop)
        if source_invoice.customer_id != customer.id:
            raise ValueError("Source invoice does not belong to the specified customer.")

    expires_at = None
    validity_days = getattr(shop, 'credit_note_validity_days', 0)
    if validity_days and validity_days > 0:
        expires_at = date.today() + timedelta(days=validity_days)

    credit_note_no = (payload.get('credit_note_no') or '').strip()
    if not credit_note_no or CreditNote.objects.filter(credit_note_no__iexact=credit_note_no).exists():
        credit_note_no = _generate_credit_note_no(shop)

    cn = None
    for attempt in range(5):
        try:
            with transaction.atomic():
                cn = CreditNote.objects.create(
                    shop=shop,
                    customer=customer,
                    credit_note_no=credit_note_no,
                    source_invoice=source_invoice,
                    reason=reason,
                    credit_amount=credit_amount,
                    used_amount=Decimal('0'),
                    status='open',
                    notes=payload.get('notes', ''),
                    expires_at=expires_at,
                )
            break
        except IntegrityError as ie:
            if 'credit_note_no' in str(ie) and attempt < 4:
                credit_note_no = _generate_credit_note_no(shop)
            else:
                raise

    LedgerEntry.objects.create(
        shop=shop,
        customer=customer,
        entry_type='debit',
        amount=credit_amount,
        description=f"Credit Note issued: {credit_note_no} — {reason}",
        reference_type='credit_note',
        reference_id=str(cn.id),
    )

    return cn


@transaction.atomic
def apply_credit_note(credit_note_id, invoice_id, amount_to_apply, note=''):
    cn = CreditNote.objects.select_for_update().get(id=credit_note_id)
    invoice = Invoice.objects.select_for_update().get(id=invoice_id)

    if cn.shop_id != invoice.shop_id:
        raise ValueError("Credit Note and Invoice belong to different shops.")

    if cn.customer_id != invoice.customer_id:
        raise ValueError("Credit Note was issued to a different customer.")

    if cn.status in ('closed', 'cancelled'):
        raise ValueError(f"Credit Note {cn.credit_note_no} is {cn.status} and cannot be applied.")

    if cn.is_expired:
        cn.status = 'expired'
        cn.save(update_fields=['status'])
        raise ValueError(f"Credit Note {cn.credit_note_no} has expired.")

    amount = Decimal(str(amount_to_apply))
    if amount <= Decimal('0'):
        raise ValueError("Amount to apply must be greater than zero.")

    remaining = cn.remaining_amount
    if amount > remaining:
        raise ValueError(
            f"Amount to apply (₹{amount}) exceeds remaining credit (₹{remaining}) on {cn.credit_note_no}."
        )

    # Update CreditNote
    cn.used_amount += amount
    if cn.remaining_amount <= Decimal('0'):
        cn.status = 'closed'
    else:
        cn.status = 'partial'
    cn.save(update_fields=['used_amount', 'status'])

    # Create usage record
    usage = CreditNoteUsage.objects.create(
        credit_note=cn,
        applied_to_invoice=invoice,
        amount_used=amount,
        note=note or f"Applied to Invoice {invoice.invoice_no}",
    )

    # Update invoice credit_applied total
    from django.db.models import F
    Invoice.objects.filter(id=invoice_id).update(
        credit_applied=F('credit_applied') + amount
    )

    LedgerEntry.objects.create(
        shop=cn.shop,
        customer=cn.customer,
        entry_type='credit',
        amount=amount,
        description=f"Credit Note {cn.credit_note_no} applied to Invoice {invoice.invoice_no}",
        reference_type='credit_note_usage',
        reference_id=str(usage.id),
    )

    return usage


@transaction.atomic
def apply_credit_note_to_order(credit_note_id, order_id, amount_to_apply, note=''):
    cn = CreditNote.objects.select_for_update().get(id=credit_note_id)
    order = Order.objects.select_for_update().get(id=order_id)

    if cn.shop_id != order.shop_id:
        raise ValueError("Credit Note and Order belong to different shops.")

    if cn.customer_id != order.customer_id:
        raise ValueError("Credit Note was issued to a different customer.")

    if cn.status in ('closed', 'cancelled'):
        raise ValueError(f"Credit Note {cn.credit_note_no} is {cn.status} and cannot be applied.")

    if cn.is_expired:
        cn.status = 'expired'
        cn.save(update_fields=['status'])
        raise ValueError(f"Credit Note {cn.credit_note_no} has expired.")

    amount = Decimal(str(amount_to_apply))
    if amount <= Decimal('0'):
        raise ValueError("Amount to apply must be greater than zero.")

    remaining = cn.remaining_amount
    if amount > remaining:
        raise ValueError(
            f"Amount to apply (₹{amount}) exceeds remaining credit (₹{remaining}) on {cn.credit_note_no}."
        )

    # Update CreditNote
    cn.used_amount += amount
    if cn.remaining_amount <= Decimal('0'):
        cn.status = 'closed'
    else:
        cn.status = 'partial'
    cn.save(update_fields=['used_amount', 'status'])

    # Create usage record
    usage = CreditNoteUsage.objects.create(
        credit_note=cn,
        applied_to_order=order,
        amount_used=amount,
        note=note or f"Applied to Order {order.order_no}",
    )

    # Update order credit_applied total
    from django.db.models import F
    Order.objects.filter(id=order_id).update(
        credit_applied=F('credit_applied') + amount
    )

    LedgerEntry.objects.create(
        shop=cn.shop,
        customer=cn.customer,
        entry_type='credit',
        amount=amount,
        description=f"Credit Note {cn.credit_note_no} applied to Order {order.order_no}",
        reference_type='credit_note_usage',
        reference_id=str(usage.id),
    )

    # Refresh order and recalculate payment state
    order.refresh_from_db()
    order.recalculate_payment_state()

    return usage


def get_customer_credit_balance(shop, customer):
    today = date.today()
    open_notes = CreditNote.objects.filter(
        shop=shop,
        customer=customer,
        status__in=('open', 'partial'),
    )
    total = Decimal('0')
    for cn in open_notes:
        if cn.expires_at and cn.expires_at < today:
            cn.status = 'expired'
            cn.save(update_fields=['status'])
            continue
        total += cn.remaining_amount
    return total


def get_customer_open_credit_notes(shop, customer_id):
    today = date.today()
    return CreditNote.objects.filter(
        shop=shop,
        customer_id=customer_id,
        status__in=('open', 'partial'),
    ).filter(
        expires_at__isnull=True
    ) | CreditNote.objects.filter(
        shop=shop,
        customer_id=customer_id,
        status__in=('open', 'partial'),
        expires_at__gte=today,
    )