import pytest
from decimal import Decimal
from apps.billing.services import BillingEngine


# ----------------------------------------
# Helper Function
# ----------------------------------------
def run_engine(items, rate, making_rate, extra):
    engine = BillingEngine(
        items=items,
        rate_10gm=rate,
        making_per_gm=making_rate,
        extra=extra
    )
    return engine.calculate()


# ----------------------------------------
# ✅ Scenario 2: NORMAL BILL
# ----------------------------------------
def test_normal_bill():
    result = run_engine(
        items=[
            {"weight": 2, "making": 20},
            {"weight": 5, "making": 50},
        ],
        rate=1000,
        making_rate=10,
        extra={}
    )

    assert result["total_weight"] == Decimal("7")
    assert result["making_total"] == Decimal("70")
    assert result["grand_total"] == Decimal("770")
    assert result["transaction_type"] == "payable"


# ----------------------------------------
# ✅ Scenario 1 - Case 01 (Payable)
# ----------------------------------------
def test_old_gold_less_than_new():
    result = run_engine(
        items=[
            {"weight": 2, "making": 20},
            {"weight": 5, "making": 50},
        ],
        rate=1000,
        making_rate=10,
        extra={
            "old_weight": 6,
            "old_settlement_mode": "weight"
        }
    )

    assert result["grand_total"] == Decimal("170")
    assert result["transaction_type"] == "payable"



# ----------------------------------------
# ✅ Scenario 1 - Case 02 (Return)
# ----------------------------------------
def test_old_gold_more_than_new():
    result = run_engine(
        items=[
            {"weight": 2, "making": 20},
            {"weight": 5, "making": 50},
        ],
        rate=1000,
        making_rate=10,
        extra={
            "old_weight": 8,
            "old_less_percent": 10,
            "old_settlement_mode": "weight"
        }
    )

    assert result["grand_total"] == Decimal("20")
    assert result["transaction_type"] == "return"



# ----------------------------------------
# ⚠️ Edge Case: Zero Weight
# ----------------------------------------
def test_zero_weight():
    result = run_engine(
        items=[],
        rate=1000,
        making_rate=10,
        extra={}
    )

    assert result["grand_total"] == Decimal("0")
    assert result["transaction_type"] == "payable"


# ----------------------------------------
# ⚠️ Edge Case: Negative Making
# ----------------------------------------
def test_negative_making():
    result = run_engine(
        items=[
            {"weight": 5, "making": -50},
        ],
        rate=1000,
        making_rate=10,
        extra={}
    )

    assert result["grand_total"] >= Decimal("0")
    assert result["transaction_type"] == "payable"


# ----------------------------------------
# ⚠️ Edge Case: High GST
# ----------------------------------------
def test_high_tax():
    result = run_engine(
        items=[
            {"weight": 5, "making": 50},
        ],
        rate=1000,
        making_rate=10,
        extra={
            "cgst": 50,
            "sgst": 50
        }
    )

    assert result["grand_total"] > Decimal("0")
    assert result["transaction_type"] == "payable"


# ----------------------------------------
# ⚠️ Worst Case: Large Values
# ----------------------------------------
def test_large_values():
    result = run_engine(
        items=[
            {"weight": 1000, "making": 50000},
        ],
        rate=100000,
        making_rate=100,
        extra={
            "old_weight": 500,
            "old_less_percent": 20,
            "old_settlement_mode": "weight",
            "advance": 100000
        }
    )

    assert result["grand_total"] >= Decimal("0")
    assert result["transaction_type"] == "payable"



# ----------------------------------------
# ⚠️ Edge Case: Advance More Than Total
# ----------------------------------------
def test_advance_exceeds_total():
    result = run_engine(
        items=[
            {"weight": 2, "making": 20},
        ],
        rate=1000,
        making_rate=10,
        extra={
            "advance": 10000
        }
    )

    # Advance makes system return money
    assert result["transaction_type"] == "payable"