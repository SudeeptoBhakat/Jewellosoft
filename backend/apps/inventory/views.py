import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import ProductInventory
from .serializers import ProductInventorySerializer
from .services import generate_unique_barcode

logger = logging.getLogger("jewellosoft.api")


class ProductInventoryViewSet(viewsets.ModelViewSet):
    """Full CRUD for inventory products. Ordered to prevent pagination warnings."""
    serializer_class = ProductInventorySerializer

    filterset_fields = ['shop', 'status', 'metal_type', 'purity']
    search_fields = ['name', 'huid', 'barcode']
    ordering_fields = ['created_at', 'name', 'net_weight']

    def get_queryset(self):
        shop = self.request.shop
        if not shop:
            return ProductInventory.objects.none()
        return ProductInventory.objects.filter(shop=shop).order_by('-created_at')

    def perform_create(self, serializer):
        logger.info("Creating inventory item: %s", serializer.validated_data.get('name'))
        barcode = serializer.validated_data.get('barcode')
        if not barcode:
            barcode = generate_unique_barcode(self.request.shop)
            logger.info("Auto-generated barcode %s for new inventory item", barcode)
        serializer.save(shop=self.request.shop, barcode=barcode)

    def perform_update(self, serializer):
        serializer.save(shop=self.request.shop)

    def perform_destroy(self, instance):
        logger.info("Deleting inventory item: %s (id=%s)", instance.name, instance.id)
        instance.delete()

    @action(detail=False, methods=['get'], url_path='scan')
    def scan(self, request):
        code = (request.query_params.get('barcode') or '').strip()
        if not code:
            return Response({"detail": "barcode query param is required."}, status=status.HTTP_400_BAD_REQUEST)

        product = self.get_queryset().filter(barcode__iexact=code).first()
        if not product:
            return Response({"found": False, "detail": f"No product with barcode '{code}'."},
                            status=status.HTTP_404_NOT_FOUND)
        if product.status != "available":
            return Response({"found": True, "available": False,
                             "detail": f"'{product.name}' ({product.barcode}) is already sold / out of stock.",
                             "product": ProductInventorySerializer(product, context={'request': request}).data},
                            status=status.HTTP_409_CONFLICT)

        return Response({"found": True, "available": True,
                         "product": ProductInventorySerializer(product, context={'request': request}).data})
