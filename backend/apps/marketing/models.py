from django.db import models
from apps.core.models import BaseModel
from apps.accounts.models import Shop
from apps.customers.models import Customer


class WhatsAppSession(BaseModel):
    STATUS_CHOICES = (
        ('disconnected', 'Disconnected'),
        ('qr_ready', 'QR Ready for Scan'),
        ('connecting', 'Connecting'),
        ('connected', 'Connected'),
        ('expired', 'Session Expired'),
    )

    shop = models.OneToOneField(Shop, on_delete=models.CASCADE, related_name="whatsapp_session")
    instance_id = models.CharField(max_length=100, unique=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    profile_name = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='disconnected')
    qr_code_base64 = models.TextField(blank=True, null=True)
    anti_ban_delay_min = models.IntegerField(default=3, help_text="Minimum delay in seconds between messages")
    anti_ban_delay_max = models.IntegerField(default=6, help_text="Maximum delay in seconds between messages")
    gateway_url = models.CharField(max_length=255, default='', blank=True, help_text="Evolution API Server URL")
    api_key = models.CharField(max_length=255, default='', blank=True, help_text="Evolution API Key")
    last_connected_at = models.DateTimeField(blank=True, null=True)

    def get_gateway_url(self):
        from django.conf import settings
        return (self.gateway_url or getattr(settings, 'EVOLUTION_API_URL', 'http://127.0.0.1:8080')).rstrip('/')

    def get_api_key(self):
        from django.conf import settings
        return self.api_key or getattr(settings, 'EVOLUTION_API_KEY', '')

    def __str__(self):
        return f"{self.shop.name} WhatsApp ({self.status})"


class MessageTemplate(BaseModel):
    CATEGORY_CHOICES = (
        ('promotional', 'Promotional Offer'),
        ('festival', 'Festival & Greetings'),
        ('scheme', 'Gold Scheme / Kitty'),
        ('transactional', 'Invoice & Payment'),
        ('custom', 'Custom'),
    )

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="message_templates")
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='promotional')
    message_text = models.TextField(help_text="Supports {name}, {phone}, {shop_name}, {shop_phone}, {total_spent}")
    media_file = models.FileField(upload_to="marketing/templates/", blank=True, null=True)

    def __str__(self):
        return f"{self.name} ({self.category})"


class MarketingCampaign(BaseModel):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('failed', 'Failed'),
    )

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="marketing_campaigns")
    title = models.CharField(max_length=255)
    total_recipients = models.IntegerField(default=0)
    sent_count = models.IntegerField(default=0)
    failed_count = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    message_text = models.TextField()
    media_file = models.FileField(upload_to="marketing/banners/", blank=True, null=True)
    delay_seconds = models.IntegerField(default=3)
    started_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"{self.title} - {self.sent_count}/{self.total_recipients} ({self.status})"


class MessageLog(BaseModel):
    STATUS_CHOICES = (
        ('queued', 'Queued'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
    )

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="message_logs")
    campaign = models.ForeignKey(MarketingCampaign, on_delete=models.CASCADE, related_name="logs", null=True, blank=True)
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True)
    recipient_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued')
    error_message = models.TextField(blank=True, null=True)
    sent_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"{self.recipient_name} ({self.phone}) - {self.status}"
