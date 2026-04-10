from rest_framework import serializers
from .models import Shop

class ShopSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shop
        fields = [
            'id', 'name', 'owner_name', 'phone', 'email', 'gst_number', 'address',
            'language', 'theme', 'date_format', 'default_gst_rate',
            'decimal_precision', 'hallmark_value', 'supabase_email'
        ]
        read_only_fields = ['id', 'supabase_email']
