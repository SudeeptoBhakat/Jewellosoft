from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Order, OrderItem
from .serializers import OrderSerializer

class OrderViewSet(viewsets.ModelViewSet):
    """
    Standard CRUD for Orders.
    """
    serializer_class = OrderSerializer
    filterset_fields = ['shop', 'order_status', 'priority']
    search_fields = ['order_no', 'customer__name', 'customer__phone']

    def get_queryset(self):
        shop = self.request.shop
        if not shop:
            return Order.objects.none()
        return Order.objects.filter(shop=shop)

    def create(self, request, *args, **kwargs):
        print("Incoming Order Payload:", request.data)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(shop=self.request.shop)

    def perform_update(self, serializer):
        serializer.save(shop=self.request.shop)

    def perform_destroy(self, instance):
        if instance.old_purchase_voucher:
            from apps.old_purchases.services import release_voucher
            release_voucher(instance.old_purchase_voucher)
        instance.delete()

    @action(detail=True, methods=['patch'], url_path='update-item-status')
    def update_item_status(self, request, pk=None):
        order = self.get_object()
        item_id = request.data.get('item_id')
        new_status = request.data.get('status')
        
        try:
            item = order.items.get(id=item_id)
            item.status = new_status
            item.save()
            return Response({'status': 'status updated', 'item_id': item_id, 'new_status': new_status})
        except OrderItem.DoesNotExist:
            return Response({'error': 'Item not found in this order'}, status=status.HTTP_404_NOT_FOUND)

