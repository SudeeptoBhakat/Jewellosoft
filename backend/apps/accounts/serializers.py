from rest_framework import serializers
from .models import Shop


class ShopSerializer(serializers.ModelSerializer):
    """
    Serializer for the Shop model.
    - supabase_user_id and supabase_email are read-only (set by system, never by user).
    - All business fields are writable.
    """

    class Meta:
        model = Shop
        fields = [
            'id',
            'user',
            'name',
            'owner_name',
            'phone',
            'email',
            'gst_number',
            'address',
            'language',
            'theme',
            'date_format',
            'default_gst_rate',
            'decimal_precision',
            'hallmark_value',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
