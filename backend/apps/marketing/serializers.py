from rest_framework import serializers
from .models import WhatsAppSession, MessageTemplate, MarketingCampaign, MessageLog


class WhatsAppSessionSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source='shop.name', read_only=True)
    gateway_reachable = serializers.SerializerMethodField()

    def get_gateway_reachable(self, obj):
        return getattr(obj, 'gateway_reachable', True)

    class Meta:
        model = WhatsAppSession
        fields = [
            'id', 'shop', 'shop_name', 'instance_id', 'phone_number',
            'profile_name', 'status', 'qr_code_base64', 'anti_ban_delay_min',
            'anti_ban_delay_max', 'gateway_url', 'api_key', 'gateway_reachable', 'last_connected_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'shop', 'instance_id', 'last_connected_at']


class MessageTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageTemplate
        fields = ['id', 'shop', 'name', 'category', 'message_text', 'media_file', 'created_at']
        read_only_fields = ['id', 'shop', 'created_at']


class MessageLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageLog
        fields = ['id', 'recipient_name', 'phone', 'status', 'error_message', 'sent_at']
        read_only_fields = fields


class MarketingCampaignSerializer(serializers.ModelSerializer):
    logs = MessageLogSerializer(many=True, read_only=True)

    class Meta:
        model = MarketingCampaign
        fields = [
            'id', 'shop', 'title', 'total_recipients', 'sent_count', 'failed_count',
            'status', 'message_text', 'media_file', 'delay_seconds', 'started_at',
            'completed_at', 'created_at', 'logs'
        ]
        read_only_fields = ['id', 'shop', 'sent_count', 'failed_count', 'status', 'started_at', 'completed_at', 'created_at']
