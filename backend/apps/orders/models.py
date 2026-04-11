from django.db import models
from apps.core.models import BaseModel
from apps.accounts.models import Shop

ITEM_STATUS_CHOICES = [
    ("created", "Created"),
    ("processing", "Processing"),
    ("karigar_assigned", "Karigar Assigned"),
    ("in_progress", "In Progress"),
    ("hallmarking", "Hallmarking"),
    ("ready", "Ready"),
    ("complete", "Complete"),
    ("cancelled", "Cancelled"),
]

ORDER_STATUS_CHOICES = [
    ("pending", "Pending"),
    ("in_progress", "In Progress"),
    ("completed", "Completed"),
    ("delivered", "Delivered"),
    ("cancelled", "Cancelled"),
]

class Order(BaseModel):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE)
    order_no = models.CharField(max_length=50, unique=True)
    customer = models.ForeignKey("customers.Customer", on_delete=models.CASCADE)

    order_status = models.CharField(max_length=20, choices=ORDER_STATUS_CHOICES, default="pending")
    order_type = models.CharField(max_length=20, choices=[("invoice", "Invoice"), ("estimate", "Estimate")], default="invoice")
    
    metal_type = models.CharField(max_length=10)
    metal_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    priority = models.CharField(max_length=20, default="normal")
    worker = models.CharField(max_length=255, blank=True, null=True)
    design_notes = models.TextField(blank=True, null=True)

    weight_total = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    making_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    old_weight = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    old_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    advance = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    cgst = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    sgst = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    hallmark = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    others = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    round_off = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    PAYMENT_CHOICES = [
        ("cash", "Cash"),
        ("upi", "UPI"),
        ("card", "Card"),
    ]
    payment_method = models.CharField(max_length=10, choices=PAYMENT_CHOICES, blank=True, null=True)

    delivery_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

class OrderItem(BaseModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")

    inventory_item = models.ForeignKey("inventory.ProductInventory", on_delete=models.SET_NULL, null=True, blank=True)
    
    product_name = models.CharField(max_length=255)
    design_remarks = models.TextField(blank=True)
    size = models.CharField(max_length=50, null=True, blank=True)

    metal_type = models.CharField(max_length=10, default="gold")
    expected_weight = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    metal_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    making_charge = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    status = models.CharField(max_length=20, choices=ITEM_STATUS_CHOICES, default="created")

class OrderImage(BaseModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="products/orders/")
    
    def __str__(self):
        return f"Image for {self.order.order_no}"