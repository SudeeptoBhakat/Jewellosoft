#
# JewelloSoft Community Edition
# Copyright (c) 2026 Sudeepta Bhakat
# Licensed under the JewelloSoft Community License.
#

import secrets
import string

from .models import ProductInventory

_BARCODE_ALPHABET = ''.join(c for c in string.ascii_uppercase + string.digits if c not in 'OI01')
_BARCODE_RANDOM_LEN = 8
_MAX_ATTEMPTS = 25


def generate_unique_barcode(shop):
    prefix = f"JS{shop.id}-"
    for _ in range(_MAX_ATTEMPTS):
        code = prefix + ''.join(secrets.choice(_BARCODE_ALPHABET) for _ in range(_BARCODE_RANDOM_LEN))
        if not ProductInventory.objects.filter(barcode=code).exists():
            return code
    raise RuntimeError("Could not generate a unique barcode after multiple attempts.")
