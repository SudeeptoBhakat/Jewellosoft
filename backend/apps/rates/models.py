#
# JewelloSoft Community Edition
# Copyright (c) 2026 Sudeepta Bhakat
# Licensed under the JewelloSoft Community License.
#
from django.db import models
from apps.core.models import BaseModel
from apps.accounts.models import Shop

class RateHistory(BaseModel):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE)

    metal_type = models.CharField(max_length=10)
    rate_per_10gm = models.DecimalField(max_digits=10, decimal_places=2)
    making_per_10gm = models.DecimalField(max_digits=10, decimal_places=2)

    source = models.CharField(max_length=100, blank=True, null=True)