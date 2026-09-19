import logging
from rest_framework import viewsets, status, response, views
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.accounts.models import Shop
from apps.customers.models import Customer
from .models import WhatsAppSession, MessageTemplate, MarketingCampaign, MessageLog
from .serializers import (
    WhatsAppSessionSerializer,
    MessageTemplateSerializer,
    MarketingCampaignSerializer,
    MessageLogSerializer,
)
from .services.whatsapp_service import WhatsAppService

logger = logging.getLogger("jewellosoft.marketing")


class WhatsAppSessionView(views.APIView):
    def get(self, request):
        shop = request.shop or Shop.objects.first()
        if not shop:
            return response.Response({"error": "Shop not found."}, status=status.HTTP_400_BAD_REQUEST)
        
        session = WhatsAppService.get_or_create_session(shop)
        session.status = "connected"
        serializer = WhatsAppSessionSerializer(session)
        return response.Response(serializer.data)

    def post(self, request):
        shop = request.shop or Shop.objects.first()
        if not shop:
            return response.Response({"error": "Shop not found."}, status=status.HTTP_400_BAD_REQUEST)

        action_type = request.data.get('action', 'update_config')
        session = WhatsAppService.get_or_create_session(shop)

        if action_type in ('update_config', 'save'):
            phone = request.data.get('phone')
            name = request.data.get('name')
            if phone:
                session.phone_number = phone.strip()
            if name:
                session.profile_name = name.strip()
            session.save()
            return response.Response(WhatsAppSessionSerializer(session).data)

        return response.Response(WhatsAppSessionSerializer(session).data)


class SingleWhatsAppSendView(views.APIView):
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def post(self, request):
        shop = request.shop or Shop.objects.first()
        if not shop:
            return response.Response({"error": "Shop not found."}, status=status.HTTP_400_BAD_REQUEST)

        customer_id = request.data.get('customer_id')
        phone = request.data.get('phone')
        name = request.data.get('name', 'Customer')
        message_text = request.data.get('message', '').strip()

        customer = None
        if customer_id:
            customer = Customer.objects.filter(shop=shop, id=customer_id).first()
            if customer and not phone:
                phone = customer.phone
            if customer and not name:
                name = customer.name

        if not phone:
            return response.Response({"error": "Phone number is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not message_text:
            return response.Response({"error": "Message text cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        result = WhatsAppService.log_message(
            shop=shop,
            customer=customer,
            phone=phone,
            text=message_text,
        )

        return response.Response(result, status=status.HTTP_200_OK)


class MarketingCampaignViewSet(viewsets.ModelViewSet):
    serializer_class = MarketingCampaignSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_queryset(self):
        shop = self.request.shop or Shop.objects.first()
        if not shop:
            return MarketingCampaign.objects.none()
        return MarketingCampaign.objects.filter(shop=shop).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        shop = request.shop or Shop.objects.first()
        if not shop:
            return response.Response({"error": "Shop not found."}, status=status.HTTP_400_BAD_REQUEST)

        title = request.data.get('title', 'Promotional Broadcast').strip()
        message_text = request.data.get('message_text', '').strip()
        delay_seconds = int(request.data.get('delay_seconds', 3))
        media_file = request.FILES.get('media_file')
        target_mode = request.data.get('target_mode', 'selected') # 'all', 'selected', 'vip'
        customer_ids = request.data.get('customer_ids', [])

        if isinstance(customer_ids, str):
            import json
            try:
                customer_ids = json.loads(customer_ids)
            except:
                customer_ids = [c.strip() for c in customer_ids.split(',') if c.strip()]

        # Resolve target customers
        customers_qs = Customer.objects.filter(shop=shop)
        if target_mode == 'all':
            pass
        elif target_mode == 'vip':
            customers_qs = customers_qs.filter(customer_type='VIP')
        elif customer_ids:
            customers_qs = customers_qs.filter(id__in=customer_ids)
        else:
            return response.Response({"error": "No recipient customers selected."}, status=status.HTTP_400_BAD_REQUEST)

        recipients = list(customers_qs)
        if not recipients:
            return response.Response({"error": "No valid customers found for this broadcast."}, status=status.HTTP_400_BAD_REQUEST)

        # Create Campaign
        campaign = MarketingCampaign.objects.create(
            shop=shop,
            title=title,
            total_recipients=len(recipients),
            message_text=message_text,
            media_file=media_file,
            delay_seconds=delay_seconds,
            status='pending',
        )

        # Enqueue Message Logs
        logs_to_create = []
        for cust in recipients:
            if not cust.phone:
                continue
            logs_to_create.append(
                MessageLog(
                    shop=shop,
                    campaign=campaign,
                    customer=cust,
                    recipient_name=cust.name,
                    phone=WhatsAppService.format_phone(cust.phone),
                    status='queued',
                )
            )
        MessageLog.objects.bulk_create(logs_to_create)

        # Kick off background broadcast worker
        WhatsAppService.start_campaign_broadcast(campaign.id)

        serializer = self.get_serializer(campaign)
        return response.Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def progress(self, request, pk=None):
        campaign = self.get_object()
        return response.Response({
            "id": campaign.id,
            "status": campaign.status,
            "total_recipients": campaign.total_recipients,
            "sent_count": campaign.sent_count,
            "failed_count": campaign.failed_count,
            "percentage": int((campaign.sent_count / campaign.total_recipients * 100)) if campaign.total_recipients > 0 else 0,
        })


class MessageTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = MessageTemplateSerializer
    pagination_class = None

    def get_queryset(self):
        shop = self.request.shop or Shop.objects.first()
        if not shop:
            return MessageTemplate.objects.none()
        
        # Auto-seed default jewelry templates if empty
        qs = MessageTemplate.objects.filter(shop=shop)
        if not qs.exists():
            self._seed_default_templates(shop)
            qs = MessageTemplate.objects.filter(shop=shop)
        return qs.order_by('name')

    def perform_create(self, serializer):
        shop = self.request.shop or Shop.objects.first()
        serializer.save(shop=shop)

    def _seed_default_templates(self, shop):
        defaults = [
            {
                "name": "Festive Gold Offer (20% Off)",
                "category": "promotional",
                "message_text": "✨ Dear {name},\n\nCelebrate the auspicious festival with {shop_name}!\n\n🌟 Flat 20% OFF on Making Charges for all Gold & Diamond Jewellery.\n💎 Free 1-gram Silver coin on purchases above ₹50,000.\n\nVisit our showroom today or contact us at {shop_phone}.\n\nWarm regards,\n{shop_name}",
            },
            {
                "name": "Old Gold Exchange Mega Fair",
                "category": "promotional",
                "message_text": "🪙 Dear {name},\n\nGet 100% full value on your Old Gold Exchange at {shop_name} this week!\nUpgrade your old jewellery to the latest 916 Hallmark bridal & daily wear designs.\n\n📍 Visit {shop_name} today! Call: {shop_phone}",
            },
            {
                "name": "Jewellery Savings Scheme Reminder",
                "category": "scheme",
                "message_text": "🔔 Dear {name},\n\nThis is a friendly reminder regarding your monthly Swarna Samriddhi gold savings installment at {shop_name}.\n\nPay on time to enjoy your bonus maturity benefits! Call {shop_phone} for assistance.",
            },
        ]
        for t in defaults:
            MessageTemplate.objects.create(shop=shop, **t)
