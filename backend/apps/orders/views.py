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

    from django.db import transaction

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        credit_apps = request.data.get('credit_note_applications', [])
        response = super().create(request, *args, **kwargs)
        if response.status_code == status.HTTP_201_CREATED:
            order_id = response.data.get('id')
            if order_id and credit_apps:
                from apps.billing.services.credit_note_service import apply_credit_note_to_order
                from decimal import Decimal
                for app in credit_apps:
                    cn_id = app.get("credit_note_id") or app.get("id")
                    cn_amt = Decimal(str(app.get("amount", 0)))
                    if cn_id and cn_amt > 0:
                        apply_credit_note_to_order(
                            credit_note_id=cn_id,
                            order_id=order_id,
                            amount_to_apply=cn_amt,
                            note=f"Applied to Order {response.data.get('order_no')}"
                        )
                # Fetch fresh updated order instance and serialize it
                order_instance = Order.objects.get(id=order_id)
                serializer = self.get_serializer(order_instance)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
        return response

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

