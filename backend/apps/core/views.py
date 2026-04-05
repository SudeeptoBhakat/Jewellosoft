"""
Core views — Dashboard Stats & Global Search endpoints.
These are app-agnostic aggregations that span multiple modules.
"""
import logging
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Sum, Count, Q
from rest_framework.views import APIView
from rest_framework.response import Response

logger = logging.getLogger("jewellosoft.api")


class DashboardStatsView(APIView):
    """
    GET /api/dashboard/stats/
    Returns aggregated statistics for the Dashboard page.
    """

    def get(self, request):
        from apps.billing.models import Invoice, Estimate
        from apps.orders.models import Order
        from apps.inventory.models import ProductInventory
        from apps.customers.models import Customer
        from apps.rates.models import RateHistory

        today = timezone.now().date()

        # --- Sales Today ---
        today_invoices = Invoice.objects.filter(created_at__date=today)
        today_estimates = Estimate.objects.filter(created_at__date=today)
        today_sales = (
            (today_invoices.aggregate(s=Sum('grand_total'))['s'] or 0) +
            (today_estimates.aggregate(s=Sum('grand_total'))['s'] or 0)
        )

        # --- Pending Orders ---
        pending_orders = Order.objects.filter(
            order_status__in=['pending', 'in_progress']
        ).count()

        # --- Items in Stock ---
        stock_count = ProductInventory.objects.filter(status='available').count()

        # --- Active Customers (have at least one invoice or order) ---
        active_customers = Customer.objects.count()

        # --- Recent Bills (last 10) ---
        recent_invoices = list(
            Invoice.objects.select_related('customer')
            .order_by('-created_at')[:5]
            .values('id', 'invoice_no', 'grand_total', 'created_at',
                    'customer__name', 'payment_method')
        )
        recent_estimates = list(
            Estimate.objects.select_related('customer')
            .order_by('-created_at')[:5]
            .values('id', 'estimate_no', 'grand_total', 'created_at',
                    'customer__name', 'payment_method')
        )

        recent_bills = []
        for inv in recent_invoices:
            recent_bills.append({
                'id': inv['invoice_no'] or f"INV-{inv['id']}",
                'customer': inv['customer__name'] or 'Walk-in',
                'amount': float(inv['grand_total'] or 0),
                'status': 'Paid',
                'type': 'Invoice',
                'date': inv['created_at'].isoformat() if inv['created_at'] else '',
            })
        for est in recent_estimates:
            recent_bills.append({
                'id': est['estimate_no'] or f"EST-{est['id']}",
                'customer': est['customer__name'] or 'Walk-in',
                'amount': float(est['grand_total'] or 0),
                'status': 'Pending',
                'type': 'Estimate',
                'date': est['created_at'].isoformat() if est['created_at'] else '',
            })
        recent_bills.sort(key=lambda x: x['date'], reverse=True)
        recent_bills = recent_bills[:8]

        # --- Latest Rates ---
        latest_rates = {}
        for entry in RateHistory.objects.order_by('-created_at')[:20]:
            if entry.metal_type not in latest_rates:
                latest_rates[entry.metal_type] = {
                    'rate_per_gram': float(entry.rate_per_10gm / 10),
                    'updated_at': entry.created_at.isoformat() if entry.created_at else '',
                }

        return Response({
            'today_sales': float(today_sales),
            'pending_orders': pending_orders,
            'stock_count': stock_count,
            'active_customers': active_customers,
            'recent_bills': recent_bills,
            'rates': latest_rates,
        })


class GlobalSearchView(APIView):
    """
    GET /api/search/?q=<query>
    Searches across Customers, Invoices, Estimates, Orders, and Inventory.
    Returns categorized results.
    """

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response({'results': []})

        from apps.customers.models import Customer
        from apps.billing.models import Invoice, Estimate
        from apps.orders.models import Order
        from apps.inventory.models import ProductInventory

        results = []

        # Customers
        customers = Customer.objects.filter(
            Q(name__icontains=q) | Q(phone__icontains=q)
        )[:5]
        for c in customers:
            results.append({
                'type': 'customer',
                'icon': 'fa-user',
                'title': c.name,
                'subtitle': c.phone or '',
                'url': '/customers',
            })

        # Invoices
        invoices = Invoice.objects.filter(
            Q(invoice_no__icontains=q) | Q(customer__name__icontains=q)
        ).select_related('customer')[:5]
        for inv in invoices:
            results.append({
                'type': 'invoice',
                'icon': 'fa-file-invoice-dollar',
                'title': inv.invoice_no or f"INV-{inv.id}",
                'subtitle': f"{inv.customer.name if inv.customer else 'Walk-in'} • ₹{inv.grand_total}",
                'url': '/billing/list',
            })

        # Estimates
        estimates = Estimate.objects.filter(
            Q(estimate_no__icontains=q) | Q(customer__name__icontains=q)
        ).select_related('customer')[:5]
        for est in estimates:
            results.append({
                'type': 'estimate',
                'icon': 'fa-file-lines',
                'title': est.estimate_no or f"EST-{est.id}",
                'subtitle': f"{est.customer.name if est.customer else 'Walk-in'} • ₹{est.grand_total}",
                'url': '/billing/list',
            })

        # Orders
        orders = Order.objects.filter(
            Q(order_no__icontains=q) | Q(customer__name__icontains=q)
        ).select_related('customer')[:5]
        for o in orders:
            results.append({
                'type': 'order',
                'icon': 'fa-box',
                'title': o.order_no or f"ORD-{o.id}",
                'subtitle': f"{o.customer.name if o.customer else 'Walk-in'} • {o.order_status}",
                'url': '/orders/list',
            })

        # Inventory
        inventory = ProductInventory.objects.filter(
            Q(name__icontains=q) | Q(barcode__icontains=q) | Q(huid__icontains=q)
        )[:5]
        for item in inventory:
            results.append({
                'type': 'inventory',
                'icon': 'fa-gem',
                'title': item.name,
                'subtitle': f"{item.metal_type} • {item.net_weight}g • {item.status}",
                'url': '/inventory',
            })

        return Response({'results': results[:15]})


class LatestRatesView(APIView):
    """
    GET /api/rates/latest/
    Returns the single latest rate per metal_type for fast navbar consumption.
    """

    def get(self, request):
        from apps.rates.models import RateHistory

        latest = {}
        for entry in RateHistory.objects.order_by('-created_at')[:20]:
            if entry.metal_type not in latest:
                latest[entry.metal_type] = {
                    'rate_per_gram': float(entry.rate_per_10gm / 10),
                    'rate_per_10gm': float(entry.rate_per_10gm),
                    'updated_at': entry.created_at.isoformat() if entry.created_at else '',
                }
        return Response(latest)


class ApplicationHealthView(APIView):
    """
    GET /api/health/
    Lightweight health check for Electron to verify Django is fully booted.
    """
    # This is the one endpoint that actually needs AllowAny so Electron can check health
    permission_classes = []

    def get(self, request):
        return Response({"status": "ok", "message": "JewelloSoft Backend Ready"})
