import logging
from rest_framework import serializers
from .models import RateHistory

logger = logging.getLogger("jewellosoft.api")

VALID_METAL_TYPES = ['gold24k', 'gold22k', 'gold18k', 'silver999', 'silver925']


class RateHistorySerializer(serializers.ModelSerializer):
    """
    Validates rate submissions: positive rates, valid metal types.
    shop is optional — defaults to 1 if not provided (demo convenience).
    """

    class Meta:
        model = RateHistory
        fields = '__all__'
        extra_kwargs = {
            'shop': {'required': False},
            'source': {'required': False, 'allow_blank': True},
        }

    def validate_rate_per_10gm(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Rate per 10gm must be a positive number.")
        return value

    def validate_making_per_10gm(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Making charge cannot be negative.")
        return value

    def validate_metal_type(self, value):
        if value not in VALID_METAL_TYPES:
            raise serializers.ValidationError(
                f"Invalid metal type '{value}'. Must be one of: {', '.join(VALID_METAL_TYPES)}"
            )
        return value

    def create(self, validated_data):
        if 'shop' not in validated_data or validated_data['shop'] is None:
            request = self.context.get('request')
            if request and hasattr(request, 'shop') and request.shop:
                validated_data['shop'] = request.shop
            else:
                from apps.accounts.models import Shop
                try:
                    validated_data['shop'] = Shop.objects.first()
                except Shop.DoesNotExist:
                    raise serializers.ValidationError({"shop": "No shop exists. Create a shop first."})
        return super().create(validated_data)
