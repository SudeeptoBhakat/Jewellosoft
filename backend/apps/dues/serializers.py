from rest_framework import serializers
from .models import DueEntry
from apps.customers.serializers import CustomerSerializer

class DueEntrySerializer(serializers.ModelSerializer):
    customer_detail = CustomerSerializer(source='customer', read_only=True)
    remaining_amount = serializers.FloatField(read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)

    class Meta:
        model = DueEntry
        fields = [
            'id',
            'shop',
            'customer',
            'customer_detail',
            'customer_name',
            'customer_phone',
            'due_amount',
            'paid_amount',
            'remaining_amount',
            'bill_type',
            'invoice',
            'estimate',
            'bill_number',
            'status',
            'due_date',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'shop', 'created_at', 'updated_at']

    def validate(self, attrs):
        due_amt = attrs.get('due_amount', getattr(self.instance, 'due_amount', 0))
        paid_amt = attrs.get('paid_amount', getattr(self.instance, 'paid_amount', 0))
        
        if float(paid_amt) >= float(due_amt) and float(due_amt) > 0:
            attrs['status'] = 'cleared'
        elif float(paid_amt) > 0:
            attrs['status'] = 'partially_paid'
        
        inv = attrs.get('invoice')
        est = attrs.get('estimate')
        if inv:
            attrs['bill_type'] = 'invoice'
            attrs['bill_number'] = inv.invoice_no
        elif est:
            attrs['bill_type'] = 'estimate'
            attrs['bill_number'] = est.estimate_no

        return attrs
