from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Sum
from decimal import Decimal
import datetime

from .models import Payment, AdvancePayment, LedgerEntry, CashBookEntry
from .serializers import PaymentSerializer, AdvancePaymentSerializer

class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = []

    def get_queryset(self):
        queryset = Payment.objects.all()
        shop_id = self.request.query_params.get('shop', None)
        if shop_id:
            queryset = queryset.filter(shop_id=shop_id)
        return queryset


class AdvancePaymentViewSet(viewsets.ModelViewSet):
    serializer_class = AdvancePaymentSerializer
    permission_classes = []

    def get_queryset(self):
        queryset = AdvancePayment.objects.all()
        shop_id = self.request.query_params.get('shop', None)
        order_id = self.request.query_params.get('order', None)
        
        if shop_id:
            queryset = queryset.filter(shop_id=shop_id)
        if order_id:
            queryset = queryset.filter(order_id=order_id)
            
        return queryset

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        payment = self.get_object()
        if payment.status == 'cancelled':
            return Response({"detail": "This payment is already cancelled."}, status=status.HTTP_400_BAD_REQUEST)
            
        reason = request.data.get('reason', 'Cancelled by User')
        
        payment.status = 'cancelled'
        payment.cancelled_at = timezone.now()
        payment.cancellation_reason = reason
        if request.user and request.user.is_authenticated:
            payment.cancelled_by = request.user
        payment.save()
        
        # 1. Reversing Customer Ledger Entry
        # Since the original payment is cancelled, we offset the ledger.
        # If it was a refund (Debit), we post a Credit reversing entry.
        # If it was normal payment (Credit), we post a Debit reversing entry.
        reversing_type = 'credit' if payment.is_refund else 'debit'
        LedgerEntry.objects.create(
            shop=payment.shop,
            customer=payment.order.customer,
            entry_type=reversing_type,
            amount=payment.amount,
            description=f"Cancellation reversal for receipt {payment.receipt_no}: {reason}",
            reference_type='cancellation',
            reference_id=str(payment.id)
        )
        
        # 2. Reversing Cash Book Entry
        # If original was refund (out), reversing creates an 'in' cash entry.
        # If original was payment (in), reversing creates an 'out' cash entry.
        reversing_entry_type = 'in' if payment.is_refund else 'out'
        
        if payment.payment_mode == 'mixed':
            splits = payment.payment_splits or []
            for split in splits:
                split_mode = split.get('mode', 'cash')
                split_amount = split.get('amount', 0)
                split_amt_dec = Decimal(str(split_amount))
                if split_amt_dec > 0:
                    CashBookEntry.objects.create(
                        shop=payment.shop,
                        entry_type=reversing_entry_type,
                        amount=split_amt_dec,
                        payment_mode=split_mode,
                        reference_number=payment.receipt_no,
                        notes=f"Mixed split cancellation reversal for {payment.receipt_no}"
                    )
        else:
            CashBookEntry.objects.create(
                shop=payment.shop,
                entry_type=reversing_entry_type,
                amount=payment.amount,
                payment_mode=payment.payment_mode,
                reference_number=payment.receipt_no,
                notes=f"Cancellation reversal for {payment.receipt_no}"
            )
            
        # 3. Recalculate order payment status
        payment.order.recalculate_payment_state()
        
        serializer = self.get_serializer(payment)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='cashbook')
    def cashbook(self, request):
        date_str = request.query_params.get('date', None)
        if date_str:
            try:
                date_val = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({"detail": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            date_val = timezone.now().date()
            
        shop_id = request.query_params.get('shop', 1)
        
        # Opening balance calculation (all entries before date_val)
        opening_in = CashBookEntry.objects.filter(
            shop_id=shop_id, created_at__date__lt=date_val, entry_type='in'
        ).aggregate(sum_val=Sum('amount'))['sum_val'] or Decimal('0.00')
        
        opening_out = CashBookEntry.objects.filter(
            shop_id=shop_id, created_at__date__lt=date_val, entry_type='out'
        ).aggregate(sum_val=Sum('amount'))['sum_val'] or Decimal('0.00')
        
        opening_balance = opening_in - opening_out
        
        # Entries for the selected day
        day_entries = CashBookEntry.objects.filter(
            shop_id=shop_id, created_at__date=date_val
        ).order_by('created_at')
        
        entries_data = []
        total_in = Decimal('0.00')
        total_out = Decimal('0.00')
        
        # Mode-wise summaries for the day
        modes = ['cash', 'upi', 'card', 'bank_transfer', 'cheque']
        mode_summaries = {m: {'in': Decimal('0.00'), 'out': Decimal('0.00'), 'net': Decimal('0.00')} for m in modes}
        
        for entry in day_entries:
            mode_lower = entry.payment_mode.lower() if entry.payment_mode else 'cash'
            if mode_lower not in mode_summaries:
                mode_summaries[mode_lower] = {'in': Decimal('0.00'), 'out': Decimal('0.00'), 'net': Decimal('0.00')}
                
            if entry.entry_type == 'in':
                total_in += entry.amount
                mode_summaries[mode_lower]['in'] += entry.amount
                mode_summaries[mode_lower]['net'] += entry.amount
            else:
                total_out += entry.amount
                mode_summaries[mode_lower]['out'] += entry.amount
                mode_summaries[mode_lower]['net'] -= entry.amount
                
            entries_data.append({
                "id": entry.id,
                "entry_type": entry.entry_type,
                "amount": float(entry.amount),
                "payment_mode": entry.payment_mode,
                "reference_number": entry.reference_number,
                "notes": entry.notes,
                "created_at": entry.created_at.isoformat()
            })
            
        closing_balance = opening_balance + total_in - total_out
        
        # Format mode summaries for response
        formatted_mode_summaries = {}
        for m, vals in mode_summaries.items():
            formatted_mode_summaries[m] = {
                "in": float(vals['in']),
                "out": float(vals['out']),
                "net": float(vals['net'])
            }
            
        return Response({
            "date": date_val.strftime('%Y-%m-%d'),
            "opening_balance": float(opening_balance),
            "total_in": float(total_in),
            "total_out": float(total_out),
            "closing_balance": float(closing_balance),
            "mode_summaries": formatted_mode_summaries,
            "entries": entries_data
        })

    @action(detail=False, methods=['get'], url_path='ledger')
    def ledger(self, request):
        customer_id = request.query_params.get('customer', None)
        if not customer_id:
            return Response({"detail": "Customer ID is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        shop_id = request.query_params.get('shop', 1)
        
        # Get all entries for the customer
        entries = LedgerEntry.objects.filter(
            shop_id=shop_id, customer_id=customer_id
        ).order_by('created_at')
        
        statement = []
        running_balance = Decimal('0.00')
        
        for entry in entries:
            amt = entry.amount
            if entry.entry_type == 'debit':
                running_balance += amt  # Debit represents customer owing more
            else:
                running_balance -= amt  # Credit represents customer payment, reducing debt
                
            statement.append({
                "id": entry.id,
                "entry_type": entry.entry_type,
                "amount": float(amt),
                "description": entry.description,
                "reference_type": entry.reference_type,
                "reference_id": entry.reference_id,
                "created_at": entry.created_at.isoformat(),
                "running_balance": float(running_balance)
            })
            
        # Reverse to show latest first for UI grid, but calculate running balance chronologically
        statement.reverse()
        
        return Response({
            "customer_id": customer_id,
            "current_balance": float(running_balance),
            "statement": statement
        })
