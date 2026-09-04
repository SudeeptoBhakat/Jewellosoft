from decimal import Decimal
from django.db.models import Q, Sum
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import DueEntry
from .serializers import DueEntrySerializer
from apps.billing.models import Invoice, Estimate

class DueEntryViewSet(viewsets.ModelViewSet):
    serializer_class = DueEntrySerializer

    def get_queryset(self):
        shop = self.request.shop
        if not shop:
            return DueEntry.objects.none()

        qs = DueEntry.objects.filter(shop=shop).select_related('customer', 'invoice', 'estimate')

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(customer__name__icontains=search) |
                Q(customer__phone__icontains=search) |
                Q(customer__customer_code__icontains=search) |
                Q(bill_number__icontains=search) |
                Q(notes__icontains=search)
            )

        status_param = self.request.query_params.get('status', 'all').strip()
        if status_param and status_param != 'all':
            qs = qs.filter(status=status_param)

        filter_type = self.request.query_params.get('filter_type', 'all').strip()
        if filter_type == 'customer_only':
            qs = qs.filter(invoice__isnull=True, estimate__isnull=True)
        elif filter_type == 'bill_only':
            qs = qs.filter(Q(invoice__isnull=False) | Q(estimate__isnull=False))
        elif filter_type == 'customer_and_bill':
            qs = qs.filter(customer__isnull=False).filter(Q(invoice__isnull=False) | Q(estimate__isnull=False))

        customer_id = self.request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(shop=self.request.shop)

    def perform_update(self, serializer):
        serializer.save(shop=self.request.shop)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        qs = self.get_queryset()
        total_due = sum([float(x.due_amount) for x in qs])
        total_paid = sum([float(x.paid_amount) for x in qs])
        total_remaining = max(total_due - total_paid, 0.0)
        pending_count = qs.exclude(status='cleared').count()

        return Response({
            'total_due': round(total_due, 2),
            'total_paid': round(total_paid, 2),
            'total_remaining': round(total_remaining, 2),
            'pending_count': pending_count,
            'total_count': qs.count()
        })

    @action(detail=False, methods=['get'], url_path='check-customer')
    def check_customer(self, request):
        customer_id = request.query_params.get('customer_id')
        if not customer_id:
            return Response({'has_dues': False, 'total_due': 0, 'count': 0, 'entries': []})

        shop = request.shop
        if not shop:
            return Response({'has_dues': False, 'total_due': 0, 'count': 0, 'entries': []})

        pending_dues = DueEntry.objects.filter(
            shop=shop,
            customer_id=customer_id
        ).exclude(status='cleared')

        total_pending = sum([float(d.due_amount) - float(d.paid_amount) for d in pending_dues])

        return Response({
            'has_dues': pending_dues.exists(),
            'total_due': round(total_pending, 2),
            'count': pending_dues.count(),
            'entries': DueEntrySerializer(pending_dues, many=True).data
        })

    @action(detail=False, methods=['get'], url_path='search-bills')
    def search_bills(self, request):
        shop = request.shop
        if not shop:
            return Response([])

        q = request.query_params.get('q', '').strip()
        customer_id = request.query_params.get('customer_id')

        invoices = Invoice.objects.filter(shop=shop)
        estimates = Estimate.objects.filter(shop=shop)

        if customer_id:
            invoices = invoices.filter(customer_id=customer_id)
            estimates = estimates.filter(customer_id=customer_id)

        if q:
            invoices = invoices.filter(Q(invoice_no__icontains=q) | Q(customer__name__icontains=q) | Q(customer__phone__icontains=q))
            estimates = estimates.filter(Q(estimate_no__icontains=q) | Q(customer__name__icontains=q) | Q(customer__phone__icontains=q))

        results = []
        for inv in invoices.order_by('-created_at')[:20]:
            results.append({
                'type': 'invoice',
                'id': inv.id,
                'bill_number': inv.invoice_no,
                'date': inv.created_at.strftime('%Y-%m-%d'),
                'customer_id': inv.customer_id,
                'customer_name': inv.customer.name if inv.customer else 'Walk-in',
                'customer_phone': inv.customer.phone if inv.customer else '',
                'grand_total': float(inv.grand_total)
            })

        for est in estimates.order_by('-created_at')[:20]:
            results.append({
                'type': 'estimate',
                'id': est.id,
                'bill_number': est.estimate_no,
                'date': est.created_at.strftime('%Y-%m-%d'),
                'customer_id': est.customer_id,
                'customer_name': est.customer.name if est.customer else 'Walk-in',
                'customer_phone': est.customer.phone if est.customer else '',
                'grand_total': float(est.grand_total)
            })

        return Response(results)

    @action(detail=True, methods=['post'], url_path='delink-bill')
    def delink_bill(self, request, pk=None):
        due_entry = self.get_object()
        due_entry.invoice = None
        due_entry.estimate = None
        due_entry.bill_type = 'none'
        due_entry.bill_number = ''
        due_entry.save()
        return Response(self.get_serializer(due_entry).data)
