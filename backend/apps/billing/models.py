#
# JewelloSoft Community Edition
# Copyright (c) 2026 Sudeepta Bhakat
# Licensed under the JewelloSoft Community License.
#
from django.contrib.contenttypes.fields import GenericRelation
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from apps.core.models import BaseModel
from apps.accounts.models import Shop


class BaseBilling(BaseModel):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE)

    customer = models.ForeignKey("customers.Customer", on_delete=models.CASCADE)

    metal_type = models.CharField(max_length=10)
    metal_rate = models.DecimalField(max_digits=10, decimal_places=2)
    making_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True)

    weight_total = models.DecimalField(max_digits=10, decimal_places=3)
    making_total = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    old_weight = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    old_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    old_value_direct = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    OLD_SETTLEMENT_CHOICES = [
        ('none', 'None'),
        ('weight', 'By Weight'),
        ('value', 'By Direct Value'),
        ('voucher', 'By Purchase Voucher'),
    ]
    old_settlement_mode = models.CharField(max_length=10, choices=OLD_SETTLEMENT_CHOICES, default='none')
    old_metal_raw_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    old_deduct_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    old_deduct_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    old_purchase_voucher = models.ForeignKey(
        'old_purchases.OldPurchaseVoucher',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_settlements'
    )
    old_voucher_rate_used = models.CharField(max_length=10, default='saved') # 'saved' | 'current'

    advance = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    cgst = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    sgst = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    igst = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    hallmark = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    others = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    round_off = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    grand_total = models.DecimalField(max_digits=12, decimal_places=2)

    TRANSACTION_TYPE_CHOICES = [
        ('payable', 'Customer Payable'),
        ('return', 'Return to Customer'),
    ]
    transaction_type = models.CharField(max_length=10, choices=TRANSACTION_TYPE_CHOICES, default='payable')

    PAYMENT_CHOICES = [
        ("cash", "Cash"),
        ("upi", "UPI"),
        ("card", "Card"),
    ]

    payment_method = models.CharField(max_length=10, choices=PAYMENT_CHOICES)

    class Meta:
        abstract = True

class BillingItem(BaseModel):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    billing_object = GenericForeignKey('content_type', 'object_id')

    inventory = models.ForeignKey(
        "inventory.ProductInventory",
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    product_name = models.CharField(max_length=255)
    metal_type = models.CharField(max_length=10)
    purity = models.CharField(max_length=10)

    net_weight = models.DecimalField(max_digits=10, decimal_places=3)

    metal_value = models.DecimalField(max_digits=12, decimal_places=2)
    making_charge = models.DecimalField(max_digits=12, decimal_places=2)

    total = models.DecimalField(max_digits=12, decimal_places=2)

class Estimate(BaseBilling):
    estimate_no = models.CharField(max_length=50, unique=True)

    items = GenericRelation("billing.BillingItem")

    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="estimates"
    )
    is_paid = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']


class Invoice(BaseBilling):
    invoice_no = models.CharField(max_length=50, unique=True)

    items = GenericRelation("billing.BillingItem")

    order = models.OneToOneField(
        "orders.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="final_invoice"
    )

    is_paid = models.BooleanField(default=False)

    credit_applied = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Total credit note amount applied against this invoice"
    )

    class Meta:
        ordering = ['-created_at']


class CreditNote(BaseModel):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('partial', 'Partially Used'),
        ('closed', 'Closed'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled'),
    ]

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE)
    customer = models.ForeignKey(
        'customers.Customer', on_delete=models.CASCADE,
        related_name='credit_notes'
    )
    credit_note_no = models.CharField(max_length=50, unique=True)

    source_invoice = models.ForeignKey(
        Invoice, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='generated_credit_notes'
    )

    reason = models.TextField(help_text="Reason for issuing this credit note")
    credit_amount = models.DecimalField(max_digits=12, decimal_places=2)
    used_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='open')
    notes = models.TextField(blank=True)

    expires_at = models.DateField(
        null=True, blank=True,
        help_text="Optional expiry date. Null means never expires."
    )

    @property
    def remaining_amount(self):
        from decimal import Decimal
        return max(Decimal('0'), self.credit_amount - self.used_amount)

    @property
    def is_expired(self):
        if not self.expires_at:
            return False
        from django.utils import timezone
        return timezone.now().date() > self.expires_at

    def __str__(self):
        return f"{self.credit_note_no} — {self.customer} — ₹{self.credit_amount}"

    class Meta:
        ordering = ['-created_at']


class CreditNoteUsage(BaseModel):
    credit_note = models.ForeignKey(
        CreditNote, on_delete=models.CASCADE,
        related_name='usages'
    )
    applied_to_invoice = models.ForeignKey(
        Invoice, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='credit_note_usages'
    )
    applied_to_estimate = models.ForeignKey(
        'billing.Estimate', on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='credit_note_usages'
    )
    applied_to_order = models.ForeignKey(
        'orders.Order', on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='credit_note_usages',
        help_text="Set when credit note is applied at order booking time"
    )
    amount_used = models.DecimalField(max_digits=12, decimal_places=2)
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['-created_at']