from rest_framework import serializers
from .models import Invoice, Estimate, BillingItem

class BillingItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillingItem
        fields = '__all__'

from apps.customers.models import Customer
class BasicCustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'address']

class InvoiceSerializer(serializers.ModelSerializer):
    items = BillingItemSerializer(many=True, read_only=True)
    customer_detail = BasicCustomerSerializer(source='customer', read_only=True)
    advance_payments = serializers.SerializerMethodField()
    
    old_purchase_voucher_no = serializers.SerializerMethodField()
    credit_note_usages = serializers.SerializerMethodField()
    
    class Meta:
        model = Invoice
        fields = '__all__'

    def get_old_purchase_voucher_no(self, obj):
        return obj.old_purchase_voucher.voucher_no if obj.old_purchase_voucher else None

    def get_advance_payments(self, obj):
        try:
            if obj.order:
                return [
                    {
                        "id": ap.id,
                        "amount": str(ap.amount),
                        "payment_mode": ap.payment_mode,
                        "receipt_no": ap.receipt_no,
                        "payment_date": ap.payment_date.isoformat() if ap.payment_date else None,
                        "status": ap.status,
                        "is_refund": ap.is_refund,
                        "notes": ap.notes,
                    }
                    for ap in obj.order.advance_payments.filter(status='active')
                ]
        except Exception:
            pass
        return []

    def get_credit_note_usages(self, obj):
        try:
            return [
                {
                    "id": u.id,
                    "credit_note_id": u.credit_note.id,
                    "credit_note_no": u.credit_note.credit_note_no,
                    "amount_used": str(u.amount_used),
                    "reason": u.credit_note.reason,
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                }
                for u in obj.credit_note_usages.all()
            ]
        except Exception:
            return []

    def validate(self, data):
        from decimal import Decimal
        for field in ["cgst", "sgst", "igst", "round_off", "grand_total"]:
            if field in data and data[field] is not None:
                try: data[field] = round(Decimal(str(data[field])), 2)
                except: pass
        return data

class EstimateSerializer(serializers.ModelSerializer):
    items = BillingItemSerializer(many=True, read_only=True)
    customer_detail = BasicCustomerSerializer(source='customer', read_only=True)
    advance_payments = serializers.SerializerMethodField()

    old_purchase_voucher_no = serializers.SerializerMethodField()
    credit_note_usages = serializers.SerializerMethodField()

    class Meta:
        model = Estimate
        fields = '__all__'

    def get_old_purchase_voucher_no(self, obj):
        return obj.old_purchase_voucher.voucher_no if obj.old_purchase_voucher else None

    def get_credit_note_usages(self, obj):
        try:
            return [
                {
                    "id": u.id,
                    "credit_note_id": u.credit_note.id,
                    "credit_note_no": u.credit_note.credit_note_no,
                    "amount_used": str(u.amount_used),
                    "reason": u.credit_note.reason,
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                }
                for u in obj.credit_note_usages.all()
            ]
        except Exception:
            return []

    def get_advance_payments(self, obj):
        try:
            if obj.order:
                return [
                    {
                        "id": ap.id,
                        "amount": str(ap.amount),
                        "payment_mode": ap.payment_mode,
                        "receipt_no": ap.receipt_no,
                        "payment_date": ap.payment_date.isoformat() if ap.payment_date else None,
                        "status": ap.status,
                        "is_refund": ap.is_refund,
                        "notes": ap.notes,
                    }
                    for ap in obj.order.advance_payments.filter(status='active')
                ]
        except Exception:
            pass
        return []

    def validate(self, data):
        from decimal import Decimal
        for field in ["cgst", "sgst", "igst", "round_off", "grand_total"]:
            if field in data and data[field] is not None:
                try: data[field] = round(Decimal(str(data[field])), 2)
                except: pass
        data['cgst'] = Decimal('0')
        data['sgst'] = Decimal('0')
        data['igst'] = Decimal('0')
        return data