from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
import logging

from .models import Invoice, Estimate, CreditNote
from .serializers import InvoiceSerializer, EstimateSerializer
from .serializers_credit import CreditNoteSerializer, CreditNoteWriteSerializer, ApplyCreditNoteSerializer
from .services.invoice_service import create_invoice, convert_estimate_to_invoice, create_estimate
from .services.credit_note_service import create_credit_note, apply_credit_note, get_customer_credit_balance, get_customer_open_credit_notes

logger = logging.getLogger("jewellosoft")

class InvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    
    filterset_fields = ['shop', 'customer']
    search_fields = ['invoice_no', 'customer__name', 'customer__phone']

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
import logging

from .models import Invoice, Estimate, CreditNote
from .serializers import InvoiceSerializer, EstimateSerializer
from .serializers_credit import CreditNoteSerializer, CreditNoteWriteSerializer, ApplyCreditNoteSerializer
from .services.invoice_service import create_invoice, convert_estimate_to_invoice, create_estimate
from .services.credit_note_service import create_credit_note, apply_credit_note, get_customer_credit_balance, get_customer_open_credit_notes

logger = logging.getLogger("jewellosoft")

class InvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    
    filterset_fields = ['shop', 'customer']
    search_fields = ['invoice_no', 'customer__name', 'customer__phone']

    def get_queryset(self):
        shop = self.request.shop
        if not shop:
            return Invoice.objects.none()
        return Invoice.objects.filter(shop=shop)

    def create(self, request, *args, **kwargs):
        try:
            if not request.shop:
                return Response({"detail": "Shop not configured for this user."}, status=status.HTTP_400_BAD_REQUEST)
            payload = request.data.copy()
            payload["shop_id"] = request.shop.id
                
            invoice_obj = create_invoice(payload)
            serializer = self.get_serializer(invoice_obj)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error("Error creating invoice: %s", str(e), exc_info=True)
            return Response({"detail": "An error occurred while creating the invoice."}, status=status.HTTP_400_BAD_REQUEST)

    def perform_destroy(self, instance):
        if instance.old_purchase_voucher:
            from apps.old_purchases.services import release_voucher
            release_voucher(instance.old_purchase_voucher)
        instance.delete()

class EstimateViewSet(viewsets.ModelViewSet):
    serializer_class = EstimateSerializer
    
    filterset_fields = ['shop', 'customer']
    search_fields = ['estimate_no', 'customer__name', 'customer__phone']

    def get_queryset(self):
        shop = self.request.shop
        if not shop:
            return Estimate.objects.none()
        return Estimate.objects.filter(shop=shop)

    def create(self, request, *args, **kwargs):
        try:
            if not request.shop:
                return Response({"detail": "Shop not configured for this user."}, status=status.HTTP_400_BAD_REQUEST)
            payload = request.data.copy()
            payload["shop_id"] = request.shop.id
                
            estimate_obj = create_estimate(payload)
            serializer = self.get_serializer(estimate_obj)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error("Error creating estimate: %s", str(e), exc_info=True)
            return Response({"detail": "An error occurred while creating the estimate."}, status=status.HTTP_400_BAD_REQUEST)

    def perform_destroy(self, instance):
        if instance.old_purchase_voucher:
            from apps.old_purchases.services import release_voucher
            release_voucher(instance.old_purchase_voucher)
        instance.delete()

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

    def create(self, request):
        if not request.shop:
            return Response({"detail": "Shop not configured for this user."}, status=status.HTTP_400_BAD_REQUEST)

        from .services.billing_engine import BillingEngine
        from decimal import Decimal

        items_data = request.data.get('items', [])
        rate_10gm = request.data.get('rate_10gm', 0)
        making_per_gm = request.data.get('making_per_gm', 0)
        extra = request.data.get('extra', {})

        engine = BillingEngine(items_data, rate_10gm, making_per_gm, extra)
        result = engine.calculate()

        serialized = {}
        for k, v in result.items():
            if isinstance(v, Decimal):
                serialized[k] = float(round(v, 2))
            else:
                serialized[k] = v

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


class CreditNoteViewSet(viewsets.ModelViewSet):
    filterset_fields = ['shop', 'customer', 'status']
    search_fields = ['credit_note_no', 'customer__name', 'customer__phone', 'source_invoice__invoice_no']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return CreditNoteWriteSerializer
        return CreditNoteSerializer

    def get_queryset(self):
        shop = self.request.shop
        if not shop:
            return CreditNote.objects.none()
        return CreditNote.objects.filter(shop=shop)

    def create(self, request, *args, **kwargs):
        try:
            if not request.shop:
                return Response({"detail": "Shop not configured for this user."}, status=status.HTTP_400_BAD_REQUEST)
            payload = request.data.copy()
            payload["shop_id"] = request.shop.id

            cn_obj = create_credit_note(payload)
            serializer = CreditNoteSerializer(cn_obj)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error("Error creating credit note: %s", str(e), exc_info=True)
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def lookup(self, request):
        shop = request.shop
        if not shop:
            return Response({"detail": "Shop not configured."}, status=status.HTTP_400_BAD_REQUEST)
        cn_no = request.query_params.get('no')
        if not cn_no:
            return Response({"detail": "Credit note number 'no' is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            cn = CreditNote.objects.get(shop=shop, credit_note_no__iexact=cn_no.strip())
            # Auto-expire check
            from datetime import date
            if cn.status in ('open', 'partial') and cn.expires_at and cn.expires_at < date.today():
                cn.status = 'expired'
                cn.save(update_fields=['status'])
            
            serializer = CreditNoteSerializer(cn)
            return Response(serializer.data)
        except CreditNote.DoesNotExist:
            return Response({"detail": f"Credit Note '{cn_no}' not found."}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'])
    def customer_balance(self, request):
        shop = request.shop
        if not shop:
            return Response({"detail": "Shop not configured."}, status=status.HTTP_400_BAD_REQUEST)
        customer_id = request.query_params.get('customer_id')
        if not customer_id:
            return Response({"detail": "customer_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        balance = get_customer_credit_balance(shop, customer_id)
        open_notes_qs = get_customer_open_credit_notes(shop, customer_id)
        open_notes_data = CreditNoteSerializer(open_notes_qs, many=True).data

        return Response({
            "balance": float(balance),
            "open_notes": open_notes_data
        })

    @action(detail=True, methods=['post'])
    def apply(self, request, pk=None):
        try:
            cn = self.get_object()
            serializer = ApplyCreditNoteSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            usage = apply_credit_note(
                credit_note_id=cn.id,
                invoice_id=serializer.validated_data['invoice_id'],
                amount_to_apply=serializer.validated_data['amount'],
                note=serializer.validated_data.get('note', '')
            )
            return Response({"status": "success", "usage_id": usage.id})
        except Exception as e:
            logger.error("Error applying credit note: %s", str(e), exc_info=True)
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
