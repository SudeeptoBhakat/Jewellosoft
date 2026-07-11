from django.db import transaction
import time
from datetime import date
from decimal import Decimal
from django.contrib.contenttypes.models import ContentType

from .inventory_service import deduct_inventory
from .payment_service import process_payments
from apps.billing.models import Invoice, BillingItem, Estimate

def generate_invoice_no(shop, max_retries=20):
    """
    Generates a unique Invoice number.
    Uses a per-year sequence key so rolling over to a new year auto-resets.
    Retries up to max_retries times if the generated number already exists
    (handles edge-cases where a previous transaction rolled back but the
    document was already manually created with that number).
    """
    from apps.accounts.models import NumberingSequence
    from apps.billing.models import Invoice
    year = date.today().year
    seq_key = f'invoice_{year}'
    for _ in range(max_retries):
        next_num = NumberingSequence.get_next_number(shop, seq_key)
        candidate = f"INV-{year}-{next_num:03d}"
        if not Invoice.objects.filter(shop=shop, invoice_no=candidate).exists():
            return candidate
    raise RuntimeError(f"Could not generate a unique invoice number after {max_retries} attempts.")

def generate_estimate_no(shop, max_retries=20):
    """
    Generates a unique Estimate number with the same collision-safe logic.
    """
    from apps.accounts.models import NumberingSequence
    from apps.billing.models import Estimate
    year = date.today().year
    seq_key = f'estimate_{year}'
    for _ in range(max_retries):
        next_num = NumberingSequence.get_next_number(shop, seq_key)
        candidate = f"EST-{year}-{next_num:03d}"
        if not Estimate.objects.filter(shop=shop, estimate_no=candidate).exists():
            return candidate
    raise RuntimeError(f"Could not generate a unique estimate number after {max_retries} attempts.")


@transaction.atomic
def create_invoice(payload):
    """
    Core implementation to securely lock down an invoice transaction.
    Links the invoice to a pending order (if order_id is supplied), posts
    Customer Ledger credit entries for payments received, updates Cash Book,
    and recalculates the order's payment_status.
    """
    items_data = payload.get("items", [])
    payment_splits = payload.get("payments", [])
    totals = payload.get("totals", {})
    
    rate_10gm = payload.get("rate_10gm") or 0
    making_rate_val = Decimal(str(payload.get("making_rate") or 0))

    # 1. Extract relationships
    shop_id = payload.get("shop_id")
    customer_id = payload.get("customer_id")
    order_id = payload.get("order_id")  # Optional: link to a pending order
    
    if not customer_id:
        from apps.customers.models import Customer
        customer_phone = payload.get("customer_mobile", "0000000000")
        customer, created = Customer.objects.get_or_create(
            shop_id=shop_id,
            phone=customer_phone,
            defaults={
                "name": payload.get("customer_name", "Walk-in Customer"),
                "address": payload.get("customer_address", ""),
                "customer_code": f"CUST-{int(time.time())}"
            }
        )
        customer_id = customer.id

    from apps.accounts.models import Shop
    shop = Shop.objects.get(id=shop_id)
    invoice_no = payload.get("invoice_no") or generate_invoice_no(shop)

    # Resolve linked order + optional delivery block
    linked_order = None
    if order_id:
        try:
            from apps.orders.models import Order
            linked_order = Order.objects.select_for_update().get(id=order_id)

            # Delivery block: if shop requires full payment and order balance is unpaid
            if shop.require_full_payment_for_delivery and linked_order.payment_status != 'paid':
                balance = linked_order.grand_total - (linked_order.advance or 0)
                raise ValueError(
                    f"Invoice blocked: order {linked_order.order_no} has an outstanding balance of "
                    f"₹{balance:,.2f}. Collect full payment before finalising the invoice."
                )
        except ValueError:
            raise
        except Exception:
            linked_order = None

    # Check and apply Old Purchase Voucher if mode is voucher
    old_purchase_voucher_val = None
    old_voucher_rate_used_val = totals.get("old_voucher_rate_used", "saved")
    if totals.get("old_settlement_mode") == "voucher":
        from apps.old_purchases.models import OldPurchaseVoucher
        voucher_id = (
            payload.get("old_purchase_voucher_id")
            or totals.get("old_purchase_voucher_id")
            or payload.get("old_purchase_voucher")
            or totals.get("old_purchase_voucher")
        )
        voucher_no_lookup = payload.get("old_purchase_voucher_no") or totals.get("old_purchase_voucher_no")
        if voucher_id:
            old_purchase_voucher_val = OldPurchaseVoucher.objects.get(id=voucher_id, shop_id=shop_id)
        elif voucher_no_lookup:
            old_purchase_voucher_val = OldPurchaseVoucher.objects.get(
                voucher_no__iexact=voucher_no_lookup.strip(), shop_id=shop_id
            )

    # Create Invoice Header from exact frontend totals
    invoice = Invoice.objects.create(
        shop_id=shop_id,
        customer_id=customer_id,
        order=linked_order,
        invoice_no=invoice_no,
        metal_type=payload.get("metal_type", "gold"),
        metal_rate=rate_10gm,
        making_rate=making_rate_val,
        weight_total=totals.get("total_weight", 0),
        making_total=totals.get("making_total", 0),
        subtotal=totals.get("subtotal", 0),
        old_weight=totals.get("old_weight", 0),
        old_amount=totals.get("old_amount", 0),
        old_value_direct=totals.get("old_value_direct", 0),
        old_settlement_mode=totals.get("old_settlement_mode", "none"),
        old_metal_raw_value=totals.get("old_metal_raw_value", 0),
        old_deduct_percent=totals.get("old_deduct_percent", 0),
        old_deduct_amount=totals.get("old_deduct_amount", 0),
        old_purchase_voucher=old_purchase_voucher_val,
        old_voucher_rate_used=old_voucher_rate_used_val,
        advance=totals.get("advance", 0),
        discount=totals.get("discount", 0),
        hallmark=totals.get("hallmark", 0),
        others=totals.get("others", 0),
        cgst=totals.get("cgst", 0),
        sgst=totals.get("sgst", 0),
        igst=totals.get("igst", 0),
        round_off=totals.get("round_off", 0),
        grand_total=totals.get("grand_total", 0),
        transaction_type=totals.get("transaction_type", "payable"),
        payment_method=payment_splits[0].get("mode") if payment_splits else "cash"
    )

    # Apply Old Purchase Voucher AFTER invoice row is committed — prevents
    # the voucher being marked adjusted if invoice creation itself fails.
    if old_purchase_voucher_val:
        from apps.old_purchases.services import apply_voucher
        apply_voucher(old_purchase_voucher_val, invoice_no=invoice_no)

    # 3. Write BillingItems
    invoice_ctype = ContentType.objects.get_for_model(Invoice)
    inventory_ids_to_deduct = []

    for idx, item in enumerate(items_data):
        inv_id = item.get("inventory_id")
        if inv_id:
            inventory_ids_to_deduct.append(inv_id)
            
        BillingItem.objects.create(
            content_type=invoice_ctype,
            object_id=invoice.id,
            inventory_id=inv_id,
            product_name=item.get("product_name", f"Item {idx}"),
            metal_type=payload.get("metal_type", "gold"),
            purity=item.get("purity", "22K"),
            net_weight=item.get("weight", 0),
            metal_value=item.get("metalValue", 0),
            making_charge=item.get("making", 0),
            total=item.get("total", 0)
        )

    # 4. Deduct inventory
    deduct_inventory(inventory_ids_to_deduct)

    # 5. Process payments (existing payment_service)
    if payment_splits:
        process_payments(invoice, payment_splits)

    # 6. Post Customer Ledger + Cash Book entries for invoice payments
    from apps.payments.models import LedgerEntry, CashBookEntry
    total_paid_now = sum(
        Decimal(str(p.get("amount", 0)))
        for p in payment_splits
        if Decimal(str(p.get("amount", 0))) > 0
    )

    if total_paid_now > 0:
        # Determine customer for ledger
        from apps.customers.models import Customer as CustomerModel
        try:
            customer_obj = CustomerModel.objects.get(id=customer_id)
        except CustomerModel.DoesNotExist:
            customer_obj = None

        if customer_obj:
            LedgerEntry.objects.create(
                shop=shop,
                customer=customer_obj,
                entry_type='credit',
                amount=total_paid_now,
                description=f"Invoice payment received: {invoice_no}",
                reference_type='invoice',
                reference_id=str(invoice.id)
            )

        # Cash book entries per mode
        for p in payment_splits:
            split_amt = Decimal(str(p.get("amount", 0)))
            if split_amt > 0:
                CashBookEntry.objects.create(
                    shop=shop,
                    entry_type='in',
                    amount=split_amt,
                    payment_mode=p.get("mode", "cash"),
                    reference_number=invoice_no,
                    notes=f"Invoice {invoice_no} payment"
                )

        # Recalculate linked order's payment status
        if linked_order:
            linked_order.recalculate_payment_state()

    return invoice

@transaction.atomic
def create_estimate(payload):
    """
    Creates an Estimate securely. Does NOT deduct inventory or log payments.
    """
    items_data = payload.get("items", [])
    totals = payload.get("totals", {})
    rate_10gm = payload.get("rate_10gm") or 0
    making_rate_val = Decimal(str(payload.get("making_rate") or 0))

    shop_id = payload.get("shop_id")
    customer_id = payload.get("customer_id")
    
    if not customer_id:
        from apps.customers.models import Customer
        customer_phone = payload.get("customer_mobile", "0000000000")
        customer, created = Customer.objects.get_or_create(
            shop_id=shop_id,
            phone=customer_phone,
            defaults={
                "name": payload.get("customer_name", "Walk-in Customer"),
                "address": payload.get("customer_address", ""),
                "customer_code": f"CUST-{int(time.time())}"
            }
        )
        customer_id = customer.id

    from apps.accounts.models import Shop
    shop = Shop.objects.get(id=shop_id)
    estimate_no = payload.get("invoice_no") or payload.get("estimate_no") or generate_estimate_no(shop)

    # Check and apply Old Purchase Voucher if mode is voucher
    old_purchase_voucher_val = None
    old_voucher_rate_used_val = totals.get("old_voucher_rate_used", "saved")
    if totals.get("old_settlement_mode") == "voucher":
        from apps.old_purchases.models import OldPurchaseVoucher
        voucher_id = (
            payload.get("old_purchase_voucher_id")
            or totals.get("old_purchase_voucher_id")
            or payload.get("old_purchase_voucher")
            or totals.get("old_purchase_voucher")
        )
        voucher_no_lookup = payload.get("old_purchase_voucher_no") or totals.get("old_purchase_voucher_no")
        if voucher_id:
            old_purchase_voucher_val = OldPurchaseVoucher.objects.get(id=voucher_id, shop_id=shop_id)
        elif voucher_no_lookup:
            old_purchase_voucher_val = OldPurchaseVoucher.objects.get(
                voucher_no__iexact=voucher_no_lookup.strip(), shop_id=shop_id
            )

    estimate = Estimate.objects.create(
        shop_id=shop_id,
        customer_id=customer_id,
        estimate_no=estimate_no,
        metal_type=payload.get("metal_type", "gold"),
        metal_rate=rate_10gm,
        making_rate=making_rate_val,
        weight_total=totals.get("total_weight", 0),
        making_total=totals.get("making_total", 0),
        subtotal=totals.get("subtotal", 0),
        old_weight=totals.get("old_weight", 0),
        old_amount=totals.get("old_amount", 0),
        old_value_direct=totals.get("old_value_direct", 0),
        old_settlement_mode=totals.get("old_settlement_mode", "none"),
        old_metal_raw_value=totals.get("old_metal_raw_value", 0),
        old_deduct_percent=totals.get("old_deduct_percent", 0),
        old_deduct_amount=totals.get("old_deduct_amount", 0),
        old_purchase_voucher=old_purchase_voucher_val,
        old_voucher_rate_used=old_voucher_rate_used_val,
        advance=totals.get("advance", 0),
        discount=totals.get("discount", 0),
        hallmark=totals.get("hallmark", 0),
        others=totals.get("others", 0),
        cgst=0,  # Estimates typically avoid GST
        sgst=0,
        igst=0,
        round_off=totals.get("round_off", 0),
        grand_total=totals.get("grand_total", 0),
        transaction_type=totals.get("transaction_type", "payable"),
        payment_method="cash"
    )

    # Apply voucher AFTER estimate row is safely committed
    if old_purchase_voucher_val:
        from apps.old_purchases.services import apply_voucher
        apply_voucher(old_purchase_voucher_val, estimate_no=estimate_no)

    estimate_ctype = ContentType.objects.get_for_model(Estimate)

    for idx, item in enumerate(items_data):
        inv_id = item.get("inventory_id")
        BillingItem.objects.create(
            content_type=estimate_ctype,
            object_id=estimate.id,
            inventory_id=inv_id,
            product_name=item.get("product_name", f"Item {idx}"),
            metal_type=payload.get("metal_type", "gold"),
            purity=item.get("purity", "22K"),
            net_weight=item.get("weight", 0),
            metal_value=item.get("metalValue", 0),
            making_charge=item.get("making", 0),
            total=item.get("total", 0)
        )

    return estimate

@transaction.atomic
def convert_estimate_to_invoice(estimate_id, rate_override=None):
    """
    Converts a draft Estimate into a real Invoice.
    """
    estimate = Estimate.objects.get(id=estimate_id)
    # Basic clone logic
    invoice = Invoice.objects.create(
        shop=estimate.shop,
        customer=estimate.customer,
        invoice_no=generate_invoice_no(estimate.shop),
        metal_type=estimate.metal_type,
        metal_rate=rate_override or estimate.metal_rate,
        making_rate=estimate.making_rate,
        weight_total=estimate.weight_total,
        making_total=estimate.making_total,
        subtotal=estimate.subtotal,
        grand_total=estimate.grand_total,
        payment_method=estimate.payment_method
    )
    return invoice
