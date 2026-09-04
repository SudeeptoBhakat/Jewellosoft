from django.db import models
from apps.core.models import BaseModel
from apps.accounts.models import Shop

class DueEntry(BaseModel):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('partially_paid', 'Partially Paid'),
        ('cleared', 'Cleared'),
    ]

    BILL_TYPE_CHOICES = [
        ('none', 'None'),
        ('invoice', 'Invoice'),
        ('estimate', 'Estimate'),
    ]

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name='due_entries')
    customer = models.ForeignKey('customers.Customer', on_delete=models.CASCADE, related_name='manual_due_entries')
    due_amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bill_type = models.CharField(max_length=20, choices=BILL_TYPE_CHOICES, default='none')
    invoice = models.ForeignKey('billing.Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='manual_dues')
    estimate = models.ForeignKey('billing.Estimate', on_delete=models.SET_NULL, null=True, blank=True, related_name='manual_dues')
    bill_number = models.CharField(max_length=100, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    due_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-created_at']

    @property
    def remaining_amount(self):
        return max(float(self.due_amount) - float(self.paid_amount), 0.0)

    def __str__(self):
        return f"Due #{self.id} - {self.customer.name} - ₹{self.due_amount}"