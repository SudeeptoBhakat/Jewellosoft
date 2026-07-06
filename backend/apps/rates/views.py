import logging
from rest_framework import viewsets
from .models import RateHistory
from .serializers import RateHistorySerializer

logger = logging.getLogger("jewellosoft.api")


class RateHistoryViewSet(viewsets.ModelViewSet):
    """CRUD for rate history entries. Ordered by newest-first."""
    serializer_class = RateHistorySerializer

    def get_queryset(self):
        shop = self.request.shop
        if not shop:
            return RateHistory.objects.none()
        return RateHistory.objects.filter(shop=shop).order_by('-created_at')

    def perform_create(self, serializer):
        logger.info("Rate entry created: %s = %s",
                     serializer.validated_data.get('metal_type'),
                     serializer.validated_data.get('rate_per_10gm'))
        serializer.save(shop=self.request.shop)

    def perform_update(self, serializer):
        serializer.save(shop=self.request.shop)
