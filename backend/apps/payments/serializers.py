from rest_framework import serializers
from .models import Payment, AdvancePayment, LedgerEntry, CashBookEntry

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'

class AdvancePaymentSerializer(serializers.ModelSerializer):
    receipt_no = serializers.CharField(required=False, read_only=True)
    order_detail = serializers.SerializerMethodField(read_only=True)
    received_by_username = serializers.SerializerMethodField(read_only=True)
    cancelled_by_username = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AdvancePayment
        fields = '__all__'

    def get_order_detail(self, obj):
        if obj.order:
            order = obj.order
            customer = order.customer
            return {
                "id": order.id,
                "order_no": order.order_no,
                "order_type": order.order_type,
                "grand_total": str(order.grand_total),
                "advance": str(order.advance or 0),
                "payment_status": order.payment_status,
                "order_status": order.order_status,
                "customer_detail": {
                    "name": customer.name if customer else "Walk-in",
                    "phone": customer.phone if customer else "",
                    "address": customer.address if customer else "",
                } if customer else None,
            }
        return None

    def get_received_by_username(self, obj):
        return obj.received_by.username if obj.received_by else None

    def get_cancelled_by_username(self, obj):
        return obj.cancelled_by.username if obj.cancelled_by else None

    def create(self, validated_data):
        shop = validated_data.get('shop')
        order = validated_data.get('order')
        is_refund = validated_data.get('is_refund', False)
        
        request = self.context.get('request')
        user = None
        if request and request.user and request.user.is_authenticated:
            user = request.user
            
        payment = AdvancePayment.record_payment(
            shop=shop,
            order=order,
            amount=validated_data.get('amount'),
            payment_mode=validated_data.get('payment_mode', 'cash'),
            notes=validated_data.get('notes'),
            reference_number=validated_data.get('reference_number'),
            user=user,
            payment_splits=validated_data.get('payment_splits'),
            is_refund=is_refund
        )
        return payment
