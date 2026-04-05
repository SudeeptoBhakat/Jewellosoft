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
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    
    filterset_fields = ['shop', 'order_status', 'priority']
    search_fields = ['order_no', 'customer__name', 'customer__phone']

    def create(self, request, *args, **kwargs):
        print("Incoming Order Payload:", request.data)
        return super().create(request, *args, **kwargs)

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

