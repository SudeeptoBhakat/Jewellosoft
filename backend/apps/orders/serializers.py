import base64
import uuid
from datetime import date
from django.core.files.base import ContentFile
from rest_framework import serializers
from .models import Order, OrderItem, OrderImage
from django.db import transaction, IntegrityError
from decimal import Decimal

def generate_order_no(shop, order_type='invoice', max_retries=100):
    from apps.orders.models import Order
    from apps.accounts.models import NumberingSequence
    year = date.today().year
    prefix = "ORD-INV" if order_type == "invoice" else "ORD-EST"
    seq_key = f"order_{order_type}_{year}"
    full_prefix = f"{prefix}-{year}-"

    existing_nos = Order.objects.filter(order_no__istartswith=full_prefix).values_list('order_no', flat=True)
    max_num = 0
    for no in existing_nos:
        try:
            parts = no.split('-')
            if len(parts) >= 3 and parts[-1].isdigit():
                max_num = max(max_num, int(parts[-1]))
        except Exception:
            pass

    try:
        seq, _ = NumberingSequence.objects.get_or_create(
            shop=shop,
            sequence_type=seq_key,
            defaults={'last_number': max_num}
        )
        if seq.last_number < max_num:
            seq.last_number = max_num
            seq.save(update_fields=['last_number'])
    except Exception:
        pass

    for _ in range(max_retries):
        next_num = NumberingSequence.get_next_number(shop, seq_key)
        candidate = f"{full_prefix}{next_num:03d}"
        if not Order.objects.filter(order_no__iexact=candidate).exists():
            return candidate

    max_num += 1
    candidate = f"{full_prefix}{max_num:03d}"
    while Order.objects.filter(order_no__iexact=candidate).exists():
        max_num += 1
        candidate = f"{full_prefix}{max_num:03d}"

    return candidate


class OrderImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderImage
        fields = ('id', 'image')


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = '__all__'
        read_only_fields = ('order',)


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)
    images = OrderImageSerializer(many=True, read_only=True)
    design_images = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )
    customer_detail = serializers.SerializerMethodField()
    order_no = serializers.CharField(required=False, allow_blank=True)
    advance_payments = serializers.SerializerMethodField()
    due_amount = serializers.SerializerMethodField()
    credit_note_usages = serializers.SerializerMethodField()

    old_purchase_voucher_no = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = '__all__'

    def get_old_purchase_voucher_no(self, obj):
        return obj.old_purchase_voucher.voucher_no if obj.old_purchase_voucher else None

    def get_advance_payments(self, obj):
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
            for ap in obj.advance_payments.filter(status='active')
        ]

    def get_due_amount(self, obj):
        from apps.payments.models import AdvancePayment
        receipts = AdvancePayment.objects.filter(order=obj, status='active', is_refund=False)
        refunds  = AdvancePayment.objects.filter(order=obj, status='active', is_refund=True)
        receipt_total = sum(r.amount for r in receipts) - sum(r.amount for r in refunds)
        order_advance = obj.advance or Decimal('0')
        credit_val = getattr(obj, 'credit_applied', Decimal('0')) or Decimal('0')
        due = obj.grand_total - order_advance - receipt_total - credit_val
        return str(max(due, Decimal('0')))

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

    def get_customer_detail(self, obj):
        if obj.customer:
            return {
                "name": obj.customer.name,
                "phone": obj.customer.phone,
                "address": obj.customer.address,
            }
        return None

    def validate(self, data):
        for field in ["cgst", "sgst", "igst", "round_off", "grand_total"]:
            if field in data and data[field] is not None:
                try:
                    data[field] = round(Decimal(str(data[field])), 2)
                except Exception:
                    pass
        order_type = data.get('order_type')
        if not order_type and self.instance:
            order_type = self.instance.order_type
        if order_type == 'estimate':
            data['cgst'] = Decimal('0')
            data['sgst'] = Decimal('0')
            data['igst'] = Decimal('0')
        return data


    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        design_images_data = validated_data.pop('design_images', [])

        advance_amount = validated_data.get('advance', 0) or 0

        order_no = (validated_data.get('order_no') or '').strip()
        from apps.orders.models import Order
        shop = validated_data.get('shop')
        order_type = validated_data.get('order_type', 'invoice')

        if not order_no or Order.objects.filter(order_no__iexact=order_no).exists():
            order_no = generate_order_no(shop, order_type)
            validated_data['order_no'] = order_no

        order = None
        for attempt in range(5):
            try:
                with transaction.atomic():
                    order = Order.objects.create(**validated_data)
                break
            except IntegrityError as ie:
                if 'order_no' in str(ie) and attempt < 4:
                    order_no = generate_order_no(shop, order_type)
                    validated_data['order_no'] = order_no
                else:
                    raise

        if order.old_settlement_mode == 'voucher' and order.old_purchase_voucher:
            from apps.old_purchases.services import apply_voucher
            if order.order_type == 'estimate':
                apply_voucher(order.old_purchase_voucher, estimate_no=order.order_no)
            else:
                apply_voucher(order.old_purchase_voucher, invoice_no=order.order_no)

        shop = order.shop
        customer = order.customer

        if customer:
            from apps.payments.models import LedgerEntry
            LedgerEntry.objects.create(
                shop=shop,
                customer=customer,
                entry_type='debit',
                amount=order.grand_total,
                description=f"Order created: {order.order_no}",
                reference_type='order',
                reference_id=str(order.id),
            )

        if advance_amount and Decimal(str(advance_amount)) > 0:
            from apps.payments.models import LedgerEntry, CashBookEntry
            adv_dec = Decimal(str(advance_amount))
            payment_method = (validated_data.get('payment_method') or 'cash').lower()
            if payment_method not in ['cash', 'upi', 'card', 'bank_transfer', 'cheque']:
                payment_method = 'cash'

            LedgerEntry.objects.create(
                shop=shop,
                customer=customer,
                entry_type='credit',
                amount=adv_dec,
                description=f"Order advance at booking: {order.order_no}",
                reference_type='order_advance',
                reference_id=str(order.id),
            )
            CashBookEntry.objects.create(
                shop=shop,
                entry_type='in',
                amount=adv_dec,
                payment_mode=payment_method,
                reference_number=order.order_no,
                notes=f"Order advance at booking — {order.order_no}",
            )

            order.payment_status = 'partially_paid' if order.grand_total > adv_dec else 'paid'
            order.save(update_fields=['payment_status'])

        for item_data in items_data:
            OrderItem.objects.create(order=order, **item_data)

        for b64 in design_images_data:
            if isinstance(b64, str) and b64.startswith('data:image'):
                format_info, imgstr = b64.split(';base64,')
                ext = format_info.split('/')[-1]
                img_data = ContentFile(base64.b64decode(imgstr), name=f"{uuid.uuid4().hex[:10]}.{ext}")
                OrderImage.objects.create(order=order, image=img_data)

        return order

    @transaction.atomic
    def update(self, instance, validated_data):
        new_status = validated_data.get('order_status', instance.order_status)
        BLOCKED_STATUSES = {'delivered', 'completed'}

        if new_status in BLOCKED_STATUSES and instance.order_status not in BLOCKED_STATUSES:
            shop = instance.shop
            if shop.require_full_payment_for_delivery and instance.payment_status != 'paid':
                balance = instance.grand_total - (instance.advance or 0)
                raise serializers.ValidationError(
                    f"Delivery blocked: outstanding balance ₹{balance:,.2f}. "
                    f"Collect full payment before marking as '{new_status}'."
                )

        validated_data.pop('items', None)
        validated_data.pop('design_images', None)

        return super().update(instance, validated_data)
