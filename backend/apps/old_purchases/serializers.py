#
# JewelloSoft Community Edition
# Copyright (c) 2026 Sudeepta Bhakat
# Licensed under the JewelloSoft Community License.
#
from rest_framework import serializers
from .models import OldPurchaseVoucher
from apps.customers.models import Customer


class BasicCustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "name", "phone", "address"]


class OldPurchaseVoucherSerializer(serializers.ModelSerializer):
    customer_detail = BasicCustomerSerializer(source="customer", read_only=True)

    # Expose adjusted bill/estimate number in a unified field
    adjusted_doc_no = serializers.SerializerMethodField()

    class Meta:
        model = OldPurchaseVoucher
        fields = "__all__"
        read_only_fields = [
            "voucher_no",
            "status",
            "adjusted_invoice_no",
            "adjusted_estimate_no",
            "adjusted_at",
            "created_at",
            "updated_at",
        ]

    def get_adjusted_doc_no(self, obj):
        return obj.adjusted_invoice_no or obj.adjusted_estimate_no or None

    def validate(self, data):
        from decimal import Decimal
        # Auto-compute amount from net_weight × rate if not explicitly supplied
        net_weight = data.get("net_weight", getattr(self.instance, "net_weight", Decimal("0")))
        rate = data.get("rate_per_10gm", getattr(self.instance, "rate_per_10gm", Decimal("0")))
        if "amount" not in data or data["amount"] == 0:
            data["amount"] = round(Decimal(str(net_weight)) * Decimal(str(rate)) / Decimal("10"), 2)
        return data
