#
# JewelloSoft Community Edition
# Copyright (c) 2026 Sudeepta Bhakat
# Licensed under the JewelloSoft Community License.
#

from django.db import models
from apps.core.models import BaseModel
from apps.accounts.models import Shop

METAL_CHOICES = [
    ("gold", "Gold"),
    ("silver", "Silver"),
]

class ProductInventory(BaseModel):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE)

    barcode = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255)

    metal_type = models.CharField(max_length=10, choices=METAL_CHOICES)
    purity = models.CharField(max_length=10)  # 22K, 18K, 925

    huid = models.CharField(max_length=50, blank=True, null=True)

    net_weight = models.DecimalField(max_digits=10, decimal_places=3)

    image = models.ImageField(upload_to="products/", blank=True, null=True)

    status = models.CharField(
        max_length=20,
        choices=[("available", "Available"), ("sold", "Sold")],
        default="available"
    )

    location = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return self.name