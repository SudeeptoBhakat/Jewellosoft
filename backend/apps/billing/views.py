from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
import logging

from .models import Invoice, Estimate
from .serializers import InvoiceSerializer, EstimateSerializer
from .services.invoice_service import create_invoice, convert_estimate_to_invoice, create_estimate

logger = logging.getLogger(__name__)

class InvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [AllowAny]  # TODO: switch to IsAuthenticated in production

    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [AllowAny]  # TODO: switch to IsAuthenticated in production
    
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
    serializer_class = EstimateSerializer
    permission_classes = [AllowAny]  # TODO: switch to IsAuthenticated in production

    queryset = Estimate.objects.all()
    serializer_class = EstimateSerializer
    permission_classes = [AllowAny]  # TODO: switch to IsAuthenticated in production
    
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
    permission_classes = [AllowAny]  # TODO: switch to IsAuthenticated in production

    def create(self, request):
        from .services.billing_engine import BillingEngine
        from decimal import Decimal
        
        items_data = request.data.get('items', [])
        rate_10gm = request.data.get('rate_10gm', 0)
        making_per_gm = request.data.get('making_per_gm', 0)
        extra = request.data.get('extra', {})
        
        engine = BillingEngine(items_data, rate_10gm, making_per_gm, extra)
        result = engine.calculate()

        # UI Detailed Breakdown (Does not affect Business Logic, just maps variables)
        rate_per_g = Decimal(rate_10gm) / Decimal(10) if rate_10gm else Decimal(0)
        old_weight = Decimal(extra.get("old_weight", 0))
        old_less_percent = Decimal(extra.get("old_less_percent", 0))
        
        oldMV = old_weight * rate_per_g
        oldDeductAmt = oldMV * (old_less_percent / Decimal(100))
        oldValue = oldMV - oldDeductAmt
        
        hallmark_charges = Decimal(extra.get("hallmark_charges", 0))
        other_charges = Decimal(extra.get("other_charges", 0))
        advance = Decimal(extra.get("advance", 0))
        discount = Decimal(extra.get("discount", 0))
        
        # Adjust final amount by subtracting discount and extracting round off
        preRound = result['subtotal'] + other_charges + hallmark_charges + result['cgst'] + result['sgst'] - oldValue - advance - discount
        finalAmt = round(preRound)
        roundOffVal = finalAmt - preRound

        def numToWords(n):
            if n == 0: return 'Zero'
            o = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
                 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
            t = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
            def c(num):
                if num == 0: return ''
                if num < 20: return o[num] + ' '
                if num < 100: return t[num // 10] + (' ' + o[num % 10] if num % 10 else '') + ' '
                if num < 1000: return o[num // 100] + ' Hundred ' + c(num % 100)
                if num < 100000: return c(num // 1000).strip() + ' Thousand ' + c(num % 1000)
                if num < 10000000: return c(num // 100000).strip() + ' Lakh ' + c(num % 100000)
                return c(num // 10000000).strip() + ' Crore ' + c(num % 10000000)
            return (c(int(abs(n))).replace('  ', ' ').strip() + ' Rupees Only')

        # Items mapping logic for UI (Calculating Metal Value & Total dynamically to reflect array items accurately)
        processed_items = []
        for item in items_data:
            wt = Decimal(item.get("weight", 0))
            mk = Decimal(item.get("making", 0)) or (wt * Decimal(making_per_gm))
            mv = wt * rate_per_g
            tot = mv + mk
            processed_item = item.copy()
            processed_item.update({
                "metalValue": float(round(mv, 2)),
                "total": float(round(tot, 2))
            })
            processed_items.append(processed_item)

        result.update({
            "items": processed_items,
            "oldMV": float(round(oldMV, 2)),
            "oldDeductAmt": float(round(oldDeductAmt, 2)),
            "oldValue": float(round(oldValue, 2)),
            "hallmarkAmt": float(round(hallmark_charges, 2)),
            "otherChargesVal": float(round(other_charges, 2)),
            "advanceVal": float(round(advance, 2)),
            "discountVal": float(round(discount, 2)),
            "preRound": float(round(preRound, 2)),
            "roundOffVal": float(round(roundOffVal, 2)),
            "finalAmt": float(finalAmt),
            "amountInWords": numToWords(finalAmt)
        })

        return Response(result)
