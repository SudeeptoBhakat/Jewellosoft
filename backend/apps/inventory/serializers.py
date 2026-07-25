import logging
from rest_framework import serializers
from .models import ProductInventory

logger = logging.getLogger("jewellosoft.api")


class ProductInventorySerializer(serializers.ModelSerializer):
    """
    Handles validation for all inventory CRUD operations.
    Image is optional on create/update; barcode must be unique.
    """

    class Meta:
        model = ProductInventory
        fields = '__all__'
        extra_kwargs = {
            'image': {'required': False},
            'barcode': {'required': False, 'allow_blank': True},
            'huid': {'required': False, 'allow_blank': True},
            'location': {'required': False, 'allow_blank': True},
        }

    # ── Field-level validation ───────────────────────────────────────
    def validate_net_weight(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Net weight must be a positive number.")
        return value

    def validate_barcode(self, value):
        if not value:
            return self.instance.barcode if self.instance else value
        value = value.strip().upper()
        qs = ProductInventory.objects.filter(barcode=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"Barcode '{value}' already exists.")
        return value

    def validate_huid(self, value):
        if not value:
            return value
        qs = ProductInventory.objects.filter(huid=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"HUID '{value}' already exists.")
        return value

    # ── Object-level validation ──────────────────────────────────────
    def validate(self, data):
        metal_type = data.get('metal_type', '')
        purity = data.get('purity', '')
        if metal_type == 'gold' and purity not in ('24K', '22K', '18K', '14K'):
            raise serializers.ValidationError({
                "purity": f"Invalid purity '{purity}' for Gold. Expected: 24K, 22K, 18K, or 14K."
            })
        if metal_type == 'silver' and purity not in ('999', '925', '900'):
            raise serializers.ValidationError({
                "purity": f"Invalid purity '{purity}' for Silver. Expected: 999, 925, or 900."
            })
        return data
