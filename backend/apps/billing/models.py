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

    weight_total = models.DecimalField(max_digits=10, decimal_places=3)
    making_total = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    old_weight = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    old_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    advance = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    cgst = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    sgst = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    hallmark = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    others = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    round_off = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    grand_total = models.DecimalField(max_digits=12, decimal_places=2)

    PAYMENT_CHOICES = [
        ("cash", "Cash"),
        ("upi", "UPI"),
        ("card", "Card"),
    ]

    payment_method = models.CharField(max_length=10, choices=PAYMENT_CHOICES)

    class Meta:
        abstract = True

class BillingItem(BaseModel):
    # 🔥 Generic relation (can point to Invoice OR Estimate)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    billing_object = GenericForeignKey('content_type', 'object_id')

    # Optional inventory link
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

    class Meta:
        ordering = ['-created_at']