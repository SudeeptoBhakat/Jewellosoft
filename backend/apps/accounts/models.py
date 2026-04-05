from django.db import models
from apps.core.models import BaseModel
from django.conf import settings

class Shop(BaseModel):
    """
    Central tenant model — one Shop per authenticated local User.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='shop',
        null=True, blank=True
    )

    # ── Business Info ─────────────────────────────────────────────
    name = models.CharField(max_length=255)
    owner_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=15)
    email = models.EmailField(blank=True, null=True)
    gst_number = models.CharField(max_length=50, blank=True, null=True)
    address = models.TextField()

    # Settings
    language = models.CharField(max_length=20, default='English')
    theme = models.CharField(max_length=20, default='System Default')
    date_format = models.CharField(max_length=20, default='DD/MM/YYYY')
    default_gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=3.0)
    decimal_precision = models.IntegerField(default=2)
    hallmark_value = models.DecimalField(max_digits=10, decimal_places=2, default=53.0)

    def __str__(self):
        return self.name