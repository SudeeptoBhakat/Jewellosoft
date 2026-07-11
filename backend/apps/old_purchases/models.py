#
# JewelloSoft Community Edition
# Copyright (c) 2026 Sudeepta Bhakat
# Licensed under the JewelloSoft Community License.
#
"""
OldPurchaseVoucher — standalone model for recording old metal purchases
from customers before they are applied against a bill or order.

Workflow:
  1. Shop purchases old metal → creates a Purchase Voucher (status=not_adjusted).
  2. During billing → lookup voucher by voucher_no → validate not_adjusted.
  3. After bill is saved → voucher is atomically set to adjusted + linked bill no.
  4. If that bill is deleted → voucher is reset to not_adjusted (atomic rollback).
"""
from django.db import models
from django.utils import timezone
from apps.core.models import BaseModel
from apps.accounts.models import Shop


class OldPurchaseVoucher(BaseModel):
    """
    Records a shop's purchase of old/used metal from a customer.
    """

    shop = models.ForeignKey(
        Shop,
        on_delete=models.CASCADE,
        related_name="old_purchase_vouchers",
    )
    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="old_purchase_vouchers",
    )

    voucher_no = models.CharField(max_length=50, unique=True)
    date = models.DateField(default=timezone.now)

    METAL_TYPE_CHOICES = [
        ("gold", "Gold"),
        ("silver", "Silver"),
    ]
    metal_type = models.CharField(max_length=10, choices=METAL_TYPE_CHOICES, default="gold")

    description = models.TextField(blank=True, help_text="Description of old metal article(s)")
    no_of_articles = models.PositiveIntegerField(default=1)
    purity = models.CharField(max_length=20, blank=True, help_text="e.g. 22K, 18K, 925")

    gross_weight = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    net_weight = models.DecimalField(max_digits=10, decimal_places=3, default=0)

    # Rate stored at time of purchase — used as the 'saved rate' for settlement.
    # Stored as rate per 10 grams to match the rest of the system.
    rate_per_10gm = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Computed amount = net_weight × (rate_per_10gm / 10).
    # Stored explicitly so it survives rate changes.
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    STATUS_CHOICES = [
        ("not_adjusted", "Not Adjusted"),
        ("adjusted_invoice", "Adjusted with Invoice"),
        ("adjusted_estimate", "Adjusted with Estimate"),
    ]
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="not_adjusted")

    # Populated when adjusted
    adjusted_invoice_no = models.CharField(max_length=50, blank=True, null=True)
    adjusted_estimate_no = models.CharField(max_length=50, blank=True, null=True)
    adjusted_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Old Purchase Voucher"
        verbose_name_plural = "Old Purchase Vouchers"

    def __str__(self):
        return f"{self.voucher_no} — {self.metal_type.upper()} {self.net_weight}g ({self.status})"

    def save(self, *args, **kwargs):
        if not self.voucher_no:
            from .services import generate_voucher_no
            self.voucher_no = generate_voucher_no(self.shop)
        super().save(*args, **kwargs)

    @property
    def is_adjusted(self):
        return self.status != "not_adjusted"
