import logging
from rest_framework import viewsets
from .models import RateHistory
from .serializers import RateHistorySerializer

logger = logging.getLogger("jewellosoft.api")


class RateHistoryViewSet(viewsets.ModelViewSet):
    """CRUD for rate history entries. Ordered by newest-first."""
    serializer_class = RateHistorySerializer

    def get_queryset(self):
        queryset = RateHistory.objects.all().order_by('-created_at')
        shop_id = self.request.query_params.get('shop', None)
        if shop_id:
            queryset = queryset.filter(shop_id=shop_id)
        return queryset

    def perform_create(self, serializer):
        logger.info("Rate entry created: %s = %s",
                     serializer.validated_data.get('metal_type'),
                     serializer.validated_data.get('rate_per_10gm'))
        serializer.save()
