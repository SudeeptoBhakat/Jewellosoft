#
# JewelloSoft Community Edition
# Copyright (c) 2026 Sudeepta Bhakat
# Licensed under the JewelloSoft Community License.
#
from rest_framework import serializers
from decimal import Decimal
from .models import CreditNote, CreditNoteUsage, BillingItem
from apps.customers.models import Customer


class BasicCustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'address']


class BillingItemDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillingItem
        fields = [
            'id', 'product_name', 'metal_type', 'purity',
            'net_weight', 'metal_value', 'making_charge', 'total',
        ]


class CreditNoteUsageSerializer(serializers.ModelSerializer):
    invoice_no = serializers.SerializerMethodField()
    estimate_no = serializers.SerializerMethodField()

    class Meta:
        model = CreditNoteUsage
        fields = [
            'id', 'amount_used', 'note',
            'applied_to_invoice', 'invoice_no',
            'applied_to_estimate', 'estimate_no',
            'created_at',
        ]

    def get_invoice_no(self, obj):
        return obj.applied_to_invoice.invoice_no if obj.applied_to_invoice else None

    def get_estimate_no(self, obj):
        return obj.applied_to_estimate.estimate_no if obj.applied_to_estimate else None


class CreditNoteSerializer(serializers.ModelSerializer):
    remaining_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    is_expired = serializers.BooleanField(read_only=True)
    customer_detail = BasicCustomerSerializer(source='customer', read_only=True)
    source_invoice_no = serializers.SerializerMethodField()
    source_invoice_detail = serializers.SerializerMethodField()
    usages = CreditNoteUsageSerializer(many=True, read_only=True)

    class Meta:
        model = CreditNote
        fields = [
            'id', 'credit_note_no', 'shop', 'customer', 'customer_detail',
            'source_invoice', 'source_invoice_no', 'source_invoice_detail',
            'reason', 'notes',
            'credit_amount', 'used_amount', 'remaining_amount',
            'status', 'is_expired', 'expires_at',
            'usages',
            'created_at', 'updated_at',
        ]

    def get_source_invoice_no(self, obj):
        return obj.source_invoice.invoice_no if obj.source_invoice else None

    def get_source_invoice_detail(self, obj):
        inv = obj.source_invoice
        if not inv:
            return None

        items = BillingItemDetailSerializer(inv.items.all(), many=True).data

        advance_payments = []
        try:
            if inv.order:
                for ap in inv.order.advance_payments.filter(status='active'):
                    advance_payments.append({
                        'id': ap.id,
                        'amount': str(ap.amount),
                        'payment_mode': ap.payment_mode,
                        'receipt_no': ap.receipt_no,
                        'payment_date': ap.payment_date.isoformat() if ap.payment_date else None,
                        'status': ap.status,
                        'is_refund': ap.is_refund,
                        'notes': ap.notes,
                    })
        except Exception:
            pass

        purchase_voucher = None
        if inv.old_purchase_voucher:
            pv = inv.old_purchase_voucher
            purchase_voucher = {
                'id': pv.id,
                'voucher_no': pv.voucher_no,
                'metal_type': getattr(pv, 'metal_type', None),
                'weight': str(getattr(pv, 'weight', None) or ''),
                'rate_used': inv.old_voucher_rate_used,
            }

        credit_note_usages = []
        try:
            for u in inv.credit_note_usages.all():
                credit_note_usages.append({
                    'id': u.id,
                    'credit_note_id': u.credit_note.id,
                    'credit_note_no': u.credit_note.credit_note_no,
                    'amount_used': str(u.amount_used),
                    'reason': u.credit_note.reason,
                    'created_at': u.created_at.isoformat() if u.created_at else None,
                })
        except Exception:
            pass

        return {
            'id': inv.id,
            'invoice_no': inv.invoice_no,
            'metal_type': inv.metal_type,
            'metal_rate': str(inv.metal_rate),
            'making_rate': str(inv.making_rate) if inv.making_rate is not None else None,
            'weight_total': str(inv.weight_total),
            'making_total': str(inv.making_total),
            'subtotal': str(inv.subtotal),
            'old_settlement_mode': inv.old_settlement_mode,
            'old_weight': str(inv.old_weight),
            'old_amount': str(inv.old_amount),
            'old_value_direct': str(inv.old_value_direct),
            'old_metal_raw_value': str(inv.old_metal_raw_value),
            'old_deduct_percent': str(inv.old_deduct_percent),
            'old_deduct_amount': str(inv.old_deduct_amount),
            'old_voucher_rate_used': inv.old_voucher_rate_used,
            'advance': str(inv.advance),
            'cgst': str(inv.cgst),
            'sgst': str(inv.sgst),
            'igst': str(inv.igst),
            'hallmark': str(inv.hallmark),
            'others': str(inv.others),
            'discount': str(inv.discount),
            'round_off': str(inv.round_off),
            'grand_total': str(inv.grand_total),
            'credit_applied': str(inv.credit_applied),
            'payment_method': inv.payment_method,
            'is_paid': inv.is_paid,
            'transaction_type': inv.transaction_type,
            'created_at': inv.created_at.isoformat() if inv.created_at else None,
            'items': items,
            'advance_payments': advance_payments,
            'purchase_voucher': purchase_voucher,
            'credit_note_usages': credit_note_usages,
        }


class CreditNoteWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditNote
        fields = [
            'shop', 'customer', 'source_invoice',
            'reason', 'notes',
            'credit_amount', 'expires_at',
        ]

    def validate_credit_amount(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError("Credit amount must be greater than zero.")
        return value

    def validate(self, data):
        source = data.get('source_invoice')
        if source:
            if source.shop_id != data['shop'].id:
                raise serializers.ValidationError(
                    {"source_invoice": "Invoice belongs to a different shop."}
                )
            if source.customer_id != data['customer'].id:
                raise serializers.ValidationError(
                    {"source_invoice": "Invoice belongs to a different customer."}
                )
        return data


class ApplyCreditNoteSerializer(serializers.Serializer):
    invoice_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    note = serializers.CharField(required=False, allow_blank=True, default='')