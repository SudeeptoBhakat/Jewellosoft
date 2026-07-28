from django.db import models
from apps.core.models import BaseModel
from apps.accounts.models import Shop
from django.conf import settings

class Payment(BaseModel):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE)

    invoice = models.ForeignKey(
        "billing.Invoice",
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    estimate = models.ForeignKey(
        "billing.Estimate",
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    amount = models.DecimalField(max_digits=12, decimal_places=2)

    PAYMENT_MODE = [
        ("cash", "Cash"),
        ("upi", "UPI"),
        ("card", "Card"),
    ]

    payment_mode = models.CharField(max_length=10, choices=PAYMENT_MODE)
    payment_date = models.DateTimeField(auto_now_add=True)


class AdvancePayment(BaseModel):
    PAYMENT_MODE_CHOICES = [
        ("cash", "Cash"),
        ("upi", "UPI"),
        ("card", "Card"),
        ("bank_transfer", "Bank Transfer"),
        ("cheque", "Cheque"),
        ("mixed", "Mixed"),
    ]
    STATUS_CHOICES = [
        ("active", "Active"),
        ("cancelled", "Cancelled"),
    ]
    
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE)
    order = models.ForeignKey("orders.Order", on_delete=models.CASCADE, related_name="advance_payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_mode = models.CharField(max_length=20, choices=PAYMENT_MODE_CHOICES, default="cash")
    payment_splits = models.JSONField(default=list, blank=True)
    receipt_no = models.CharField(max_length=50, unique=True)
    payment_date = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    
    # Audit trail
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="active")
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="received_advances")
    
    # Cancellation audit
    cancelled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="cancelled_advances")
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True, null=True)
    
    # Refunds
    is_refund = models.BooleanField(default=False)
    refund_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    refund_notes = models.TextField(blank=True, null=True)

    @classmethod
    def generate_receipt_no(cls, shop, is_refund=False, max_retries=100):
        from datetime import date
        from apps.accounts.models import NumberingSequence
        year = date.today().year
        prefix = f"REF-{year}-" if is_refund else f"ADV-RCT-{year}-"
        seq_type = "refund_receipt" if is_refund else "advance_receipt"
        seq_key = f"{seq_type}_{year}"

        existing_nos = cls.objects.filter(receipt_no__istartswith=prefix).values_list('receipt_no', flat=True)
        max_num = 0
        for no in existing_nos:
            try:
                parts = no.split('-')
                if len(parts) >= 3 and parts[-1].isdigit():
                    max_num = max(max_num, int(parts[-1]))
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
            candidate = f"{prefix}{next_num:03d}"
            if not cls.objects.filter(receipt_no__iexact=candidate).exists():
                return candidate

        max_num += 1
        candidate = f"{prefix}{max_num:03d}"
        while cls.objects.filter(receipt_no__iexact=candidate).exists():
            max_num += 1
            candidate = f"{prefix}{max_num:03d}"

        return candidate

    @classmethod
    def record_payment(cls, shop, order, amount, payment_mode, notes=None, reference_number=None, user=None, payment_splits=None, is_refund=False):
        from decimal import Decimal
        from django.db import transaction, IntegrityError
        
        with transaction.atomic():
            receipt_no = cls.generate_receipt_no(shop, is_refund=is_refund)

            payment = None
            for attempt in range(5):
                try:
                    with transaction.atomic():
                        payment = cls.objects.create(
                            shop=shop,
                            order=order,
                            amount=amount,
                            payment_mode=payment_mode,
                            payment_splits=payment_splits or [],
                            receipt_no=receipt_no,
                            notes=notes,
                            reference_number=reference_number,
                            received_by=user,
                            is_refund=is_refund
                        )
                    break
                except IntegrityError as ie:
                    if 'receipt_no' in str(ie) and attempt < 4:
                        receipt_no = cls.generate_receipt_no(shop, is_refund=is_refund)
                    else:
                        raise
            
            # 1. Post Customer Ledger Entry
            LedgerEntry.objects.create(
                shop=shop,
                customer=order.customer,
                entry_type='debit' if is_refund else 'credit',
                amount=amount,
                description=f"Refund issued against receipt {receipt_no}" if is_refund else f"Advance payment received: {receipt_no}",
                reference_type='refund' if is_refund else 'payment',
                reference_id=str(payment.id)
            )
            
            # 2. Post Cash Book Entry
            entry_type = 'out' if is_refund else 'in'
            if payment_mode == 'mixed':
                splits = payment_splits or []
                for split in splits:
                    split_mode = split.get('mode', 'cash')
                    split_amount = split.get('amount', 0)
                    split_amt_dec = Decimal(str(split_amount))
                    if split_amt_dec > 0:
                        CashBookEntry.objects.create(
                            shop=shop,
                            entry_type=entry_type,
                            amount=split_amt_dec,
                            payment_mode=split_mode,
                            reference_number=receipt_no,
                            notes=f"Mixed split {split_mode} for {receipt_no}"
                        )
            else:
                CashBookEntry.objects.create(
                    shop=shop,
                    entry_type=entry_type,
                    amount=amount,
                    payment_mode=payment_mode,
                    reference_number=reference_number or receipt_no,
                    notes=notes
                )
                
            # 3. Recalculate Order State
            order.recalculate_payment_state()
            return payment

    class Meta:
        ordering = ['-payment_date']


class LedgerEntry(BaseModel):
    ENTRY_TYPE_CHOICES = [
        ("debit", "Debit (Owed)"),
        ("credit", "Credit (Paid)"),
    ]
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE)
    customer = models.ForeignKey("customers.Customer", on_delete=models.CASCADE, related_name="ledger_entries")
    entry_type = models.CharField(max_length=10, choices=ENTRY_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField(blank=True, null=True)
    reference_type = models.CharField(max_length=50)  # 'order', 'payment', 'refund', 'cancellation'
    reference_id = models.CharField(max_length=50)

    class Meta:
        ordering = ['-created_at']


class CashBookEntry(BaseModel):
    ENTRY_TYPE_CHOICES = [
        ("in", "Cash In"),
        ("out", "Cash Out"),
    ]
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE)
    entry_type = models.CharField(max_length=5, choices=ENTRY_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_mode = models.CharField(max_length=20)
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-created_at']