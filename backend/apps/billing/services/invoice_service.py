from django.db import transaction
import time
from decimal import Decimal
from django.contrib.contenttypes.models import ContentType

from .inventory_service import deduct_inventory
from .payment_service import process_payments
from apps.billing.models import Invoice, BillingItem, Estimate

def generate_invoice_no():
    return f"INV-{int(time.time())}"

def generate_estimate_no():
    return f"EST-{int(time.time())}"

@transaction.atomic
def create_invoice(payload):
    """
    Core implementation to securely lock down an invoice transaction.
    """
    items_data = payload.get("items", [])
    payment_splits = payload.get("payments", [])
    totals = payload.get("totals", {})
    
    rate_10gm = payload.get("rate_10gm", 0)

    # 1. Extract relationships
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

    invoice_no = payload.get("invoice_no") or generate_invoice_no()

    # Create Invoice Header from exact frontend totals
    invoice = Invoice.objects.create(
        shop_id=shop_id,
        customer_id=customer_id,
        invoice_no=invoice_no,
        metal_type=payload.get("metal_type", "gold"),
        metal_rate=rate_10gm,
        weight_total=totals.get("total_weight", 0),
        making_total=totals.get("making_total", 0),
        subtotal=totals.get("subtotal", 0),
        old_weight=totals.get("old_weight", 0),
        old_amount=totals.get("old_amount", 0),
        old_value_direct=totals.get("old_value_direct", 0),
        old_settlement_mode=totals.get("old_settlement_mode", "none"),
        advance=totals.get("advance", 0),
        discount=totals.get("discount", 0),
        hallmark=totals.get("hallmark", 0),
        others=totals.get("others", 0),
        cgst=totals.get("cgst", 0),
        sgst=totals.get("sgst", 0),
        round_off=totals.get("round_off", 0),
        grand_total=totals.get("grand_total", 0),
        payment_method=payment_splits[0].get("mode") if payment_splits else "cash"
    )

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

    # 4. deduct_inventory(huid_list)
    deduct_inventory(inventory_ids_to_deduct)

    # 5. process_payments(invoice, payments)
    if payment_splits:
        process_payments(invoice, payment_splits)

    return invoice

@transaction.atomic
def create_estimate(payload):
    """
    Creates an Estimate securely. Does NOT deduct inventory or log payments.
    """
    items_data = payload.get("items", [])
    totals = payload.get("totals", {})
    rate_10gm = payload.get("rate_10gm", 0)

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

    estimate_no = payload.get("invoice_no") or payload.get("estimate_no") or generate_estimate_no()

    estimate = Estimate.objects.create(
        shop_id=shop_id,
        customer_id=customer_id,
        estimate_no=estimate_no,
        metal_type=payload.get("metal_type", "gold"),
        metal_rate=rate_10gm,
        weight_total=totals.get("total_weight", 0),
        making_total=totals.get("making_total", 0),
        subtotal=totals.get("subtotal", 0),
        old_weight=totals.get("old_weight", 0),
        old_amount=totals.get("old_amount", 0),
        old_value_direct=totals.get("old_value_direct", 0),
        old_settlement_mode=totals.get("old_settlement_mode", "none"),
        advance=totals.get("advance", 0),
        discount=totals.get("discount", 0),
        hallmark=totals.get("hallmark", 0),
        others=totals.get("others", 0),
        cgst=0,  # Estimates typically avoid GST
        sgst=0,
        round_off=totals.get("round_off", 0),
        grand_total=totals.get("grand_total", 0),
        payment_method="cash"
    )

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
        invoice_no=generate_invoice_no(),
        metal_type=estimate.metal_type,
        metal_rate=rate_override or estimate.metal_rate,
        weight_total=estimate.weight_total,
        making_total=estimate.making_total,
        subtotal=estimate.subtotal,
        grand_total=estimate.grand_total,
        payment_method=estimate.payment_method
    )
    return invoice
