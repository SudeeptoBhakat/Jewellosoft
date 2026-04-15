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
    owner_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=15, blank=True)
    email = models.EmailField(blank=True, null=True)
    gst_number = models.CharField(max_length=50, blank=True, null=True)
    address = models.TextField(blank=True)

    # Settings
    language = models.CharField(max_length=20, default='English')
    theme = models.CharField(max_length=30, default='default')
    pdf_template = models.CharField(
        max_length=30, default='classic',
        help_text='Selected PDF invoice template: classic | standard'
    )
    watermark_logo = models.ImageField(
        upload_to='watermarks/', null=True, blank=True,
        help_text='Custom logo image used as watermark on billing PDFs'
    )
    pan_number = models.CharField(max_length=20, blank=True, help_text='PAN card number for invoices')
    date_format = models.CharField(max_length=20, default='DD/MM/YYYY')
    default_gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=3.0)
    decimal_precision = models.IntegerField(default=2)
    hallmark_value = models.DecimalField(max_digits=10, decimal_places=2, default=53.0)

    # Supabase Tracking
    supabase_email = models.EmailField(max_length=254, unique=True, db_index=True, null=True, blank=True, help_text='Supabase login email')
    supabase_user_id = models.CharField(max_length=255, unique=True, db_index=True, null=True, blank=True, help_text='Supabase auth.users.id (UUID)')

    def __str__(self):
        return self.name

class SyncQueue(models.Model):
    """
    Tracks database operations that need to be synchronized with Supabase.
    """
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('failed', 'Failed'),
        ('synced', 'Synced'),
    )

    id = models.AutoField(primary_key=True)
    model_name = models.CharField(max_length=100, help_text="E.g., 'Shop', 'Customer'")
    object_id = models.CharField(max_length=50, help_text="Local ID of the object")
    action = models.CharField(max_length=20, choices=(('create', 'Create'), ('update', 'Update'), ('delete', 'Delete')))
    payload = models.JSONField(blank=True, null=True, help_text="Data to push (for create/update if needed)")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    attempts = models.IntegerField(default=0)
    last_error = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.action} {self.model_name} {self.object_id} ({self.status})"
