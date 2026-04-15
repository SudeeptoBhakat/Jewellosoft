from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
import logging

from .models import Invoice, Estimate
from .serializers import InvoiceSerializer, EstimateSerializer
from .services.invoice_service import create_invoice, convert_estimate_to_invoice, create_estimate

logger = logging.getLogger(__name__)

class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    
    filterset_fields = ['shop', 'customer']
    search_fields = ['invoice_no', 'customer__name', 'customer__phone']

    def create(self, request, *args, **kwargs):
        # Transaction safely wrapped via service layer
        try:
            invoice_obj = create_invoice(request.data)
            serializer = self.get_serializer(invoice_obj)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error("Error creating invoice: %s", str(e), exc_info=True)
            return Response({"detail": "An error occurred while creating the invoice."}, status=status.HTTP_400_BAD_REQUEST)

class EstimateViewSet(viewsets.ModelViewSet):
    queryset = Estimate.objects.all()
    serializer_class = EstimateSerializer
    
    filterset_fields = ['shop', 'customer']
    search_fields = ['estimate_no', 'customer__name', 'customer__phone']

    def create(self, request, *args, **kwargs):
        # Handle custom frontend estimate payload safely
        try:
            estimate_obj = create_estimate(request.data)
            serializer = self.get_serializer(estimate_obj)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error("Error creating estimate: %s", str(e), exc_info=True)
            return Response({"detail": "An error occurred while creating the estimate."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def convert(self, request, pk=None):
        try:
            estimate = self.get_object()
            invoice_obj = convert_estimate_to_invoice(estimate.id, request.data.get('rate_override'))
            return Response({"status": "success", "invoice_id": invoice_obj.id})
        except Exception as e:
            logger.error("Error converting estimate to invoice: %s", str(e), exc_info=True)
            return Response({"detail": "An error occurred while converting the estimate."}, status=status.HTTP_400_BAD_REQUEST)

class BillingPreviewViewSet(viewsets.ViewSet):
    """
    Stateless endpoint to preview calculations using BillingEngine before commit.
    """

    def create(self, request):
        from .services.billing_engine import BillingEngine
        from decimal import Decimal

        items_data = request.data.get('items', [])
        rate_10gm = request.data.get('rate_10gm', 0)
        making_per_gm = request.data.get('making_per_gm', 0)
        extra = request.data.get('extra', {})

        engine = BillingEngine(items_data, rate_10gm, making_per_gm, extra)
        result = engine.calculate()

        # Convert all Decimal values to float for JSON serialization
        serialized = {}
        for k, v in result.items():
            if isinstance(v, Decimal):
                serialized[k] = float(round(v, 2))
            else:
                serialized[k] = v

        # Process items for UI display
        rate_per_g = Decimal(str(rate_10gm)) / Decimal(10) if rate_10gm else Decimal(0)
        processed_items = []
        for item in items_data:
            wt = Decimal(str(item.get("weight", 0)))
            mk = Decimal(str(item.get("making", 0))) or (wt * Decimal(str(making_per_gm)))
            mv = wt * rate_per_g
            tot = mv + mk
            processed_item = item.copy()
            processed_item.update({
                "metalValue": float(round(mv, 2)),
                "total": float(round(tot, 2))
            })
            processed_items.append(processed_item)

        serialized["items"] = processed_items

        return Response(serialized)
