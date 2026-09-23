from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    WhatsAppSessionView,
    SingleWhatsAppSendView,
    MarketingCampaignViewSet,
    MessageTemplateViewSet,
)

router = DefaultRouter()
router.register(r'campaigns', MarketingCampaignViewSet, basename='campaigns')
router.register(r'templates', MessageTemplateViewSet, basename='templates')

urlpatterns = [
    path('whatsapp/session/', WhatsAppSessionView.as_view(), name='whatsapp_session'),
    path('whatsapp/send-single/', SingleWhatsAppSendView.as_view(), name='whatsapp_send_single'),
    path('', include(router.urls)),
]
