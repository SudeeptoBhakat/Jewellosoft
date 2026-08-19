#
# JewelloSoft Community Edition
# Copyright (c) 2026 Sudeepta Bhakat
# Licensed under the JewelloSoft Community License.
#

from .models import ProductInventory

def generate_unique_barcode(shop=None):
    existing_barcodes = set(
        ProductInventory.objects.values_list('barcode', flat=True)
    )

    numeric_values = []
    for code in existing_barcodes:
        if code and code.isdigit():
            try:
                numeric_values.append(int(code))
            except ValueError:
                pass

    if numeric_values:
        candidate = max(numeric_values) + 1
        if candidate < 10001:
            candidate = 10001
    else:
        candidate = 10001

    while str(candidate) in existing_barcodes:
        candidate += 1

    return str(candidate)
