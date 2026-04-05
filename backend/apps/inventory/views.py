import logging
from rest_framework import viewsets
from .models import ProductInventory
from .serializers import ProductInventorySerializer

logger = logging.getLogger("jewellosoft.api")


class ProductInventoryViewSet(viewsets.ModelViewSet):
    """Full CRUD for inventory products. Ordered to prevent pagination warnings."""
    serializer_class = ProductInventorySerializer

    filterset_fields = ['shop', 'status', 'metal_type', 'purity']
    search_fields = ['name', 'huid', 'barcode']
    ordering_fields = ['created_at', 'name', 'net_weight']

    def get_queryset(self):
        return ProductInventory.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        logger.info("Creating inventory item: %s", serializer.validated_data.get('name'))
        serializer.save()

    def perform_destroy(self, instance):
        logger.info("Deleting inventory item: %s (id=%s)", instance.name, instance.id)
        instance.delete()
