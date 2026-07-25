#
# JewelloSoft Community Edition
# Copyright (c) 2026 Sudeepta Bhakat
# Licensed under the JewelloSoft Community License.
#
from rest_framework import serializers
from decimal import Decimal
from .models import CreditNote, CreditNoteUsage
from apps.customers.models import Customer


class BasicCustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'address']


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
    usages = CreditNoteUsageSerializer(many=True, read_only=True)

    class Meta:
        model = CreditNote
        fields = [
            'id', 'credit_note_no', 'shop', 'customer', 'customer_detail',
            'source_invoice', 'source_invoice_no',
            'reason', 'notes',
            'credit_amount', 'used_amount', 'remaining_amount',
            'status', 'is_expired', 'expires_at',
            'usages',
            'created_at', 'updated_at',
        ]

    def get_source_invoice_no(self, obj):
        return obj.source_invoice.invoice_no if obj.source_invoice else None


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