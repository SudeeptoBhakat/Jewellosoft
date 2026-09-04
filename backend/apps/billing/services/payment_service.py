from decimal import Decimal
from django.db import transaction
from apps.payments.models import Payment

@transaction.atomic
def process_payments(invoice, payment_splits):
    if not payment_splits:
        return
        
    total_paid = sum(float(split.get("amount", 0)) for split in payment_splits)
    
    expected_payment = max(
        0.0,
        float(invoice.grand_total)
        - float(invoice.advance or 0)
        - float(getattr(invoice, 'credit_applied', 0) or 0)
    )

    if abs(total_paid - expected_payment) > 0.1 and abs(total_paid - float(invoice.grand_total)) > 0.1:
        raise ValueError(f"Payment splits total ({total_paid}) does not match expected invoice payable ({expected_payment})")

    for split in payment_splits:
        amt = float(split.get("amount", 0))
        if amt > 0:
            Payment.objects.create(
                shop=invoice.shop,
                invoice=invoice,
                payment_mode=split.get("mode"),
                amount=amt
            )
        
    if total_paid >= expected_payment - 0.1 or total_paid >= float(invoice.grand_total) - 0.1:
        invoice.is_paid = True
        invoice.save(update_fields=['is_paid'])

