#
# JewelloSoft Community Edition
# Copyright (c) 2026 Sudeepta Bhakat
# Licensed under the JewelloSoft Community License.
#
"""
Management command: resync_sequences

Scans every document table (Order, Invoice, Estimate, CreditNote,
OldPurchaseVoucher, AdvancePayment) for the current year, computes the
real maximum sequential number that exists in the DB, and updates
NumberingSequence.last_number to that value for every shop.

This prevents UNIQUE constraint errors that occur when the in-memory
sequence counter falls behind the actual records in the database.

Usage:
    python manage.py resync_sequences
    python manage.py resync_sequences --year 2026
    python manage.py resync_sequences --dry-run
"""

from datetime import date
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Resynchronise all NumberingSequence counters to the highest existing document numbers in the DB."

    def add_arguments(self, parser):
        parser.add_argument(
            '--year',
            type=int,
            default=date.today().year,
            help='Year to resync (default: current year)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Print what would change without writing to the DB.',
        )

    def handle(self, *args, **options):
        year = options['year']
        dry_run = options['dry_run']

        from apps.accounts.models import Shop, NumberingSequence
        from apps.billing.models import Invoice, Estimate, CreditNote
        from apps.orders.models import Order
        from apps.payments.models import AdvancePayment
        try:
            from apps.old_purchases.models import OldPurchaseVoucher
        except ImportError:
            OldPurchaseVoucher = None

        shops = list(Shop.objects.all())
        self.stdout.write(self.style.MIGRATE_HEADING(
            f"Resyncing sequences for year={year}, shops={len(shops)}, dry_run={dry_run}"
        ))

        # Each entry: (seq_key_template, model, field, prefix_template)
        # prefix must end with '-' so we can split on it and pick the numeric tail
        SEQUENCES = [
            (f'order_invoice_{year}',         Order,              'order_no',      f'ORD-INV-{year}-'),
            (f'order_estimate_{year}',         Order,              'order_no',      f'ORD-EST-{year}-'),
            (f'invoice_{year}',                Invoice,            'invoice_no',    f'INV-{year}-'),
            (f'estimate_{year}',               Estimate,           'estimate_no',   f'EST-{year}-'),
            (f'credit_note_{year}',            CreditNote,         'credit_note_no', f'CN-{year}-'),
            (f'advance_receipt_{year}',        AdvancePayment,     'receipt_no',    f'ADV-RCT-{year}-'),
            (f'refund_receipt_{year}',         AdvancePayment,     'receipt_no',    f'REF-{year}-'),
        ]
        if OldPurchaseVoucher:
            SEQUENCES.append(
                (f'purchase_voucher_{year}', OldPurchaseVoucher, 'voucher_no', f'PV-{year}-'),
            )

        total_updated = 0

        with transaction.atomic():
            for shop in shops:
                for seq_key, model, field_name, prefix in SEQUENCES:
                    # Gather all values that start with this prefix (global — not shop-scoped
                    # so that cross-shop pollution is caught too)
                    qs = model.objects.filter(
                        **{f'{field_name}__istartswith': prefix}
                    ).values_list(field_name, flat=True)

                    max_num = 0
                    for val in qs:
                        suffix = val[len(prefix):]          # everything after the dash-prefix
                        # suffix might be '001' or '5758' etc.
                        if suffix.isdigit():
                            max_num = max(max_num, int(suffix))

                    if max_num == 0:
                        # No records yet — nothing to sync
                        continue

                    seq, created = NumberingSequence.objects.get_or_create(
                        shop=shop,
                        sequence_type=seq_key,
                        defaults={'last_number': max_num},
                    )

                    if created:
                        msg = f"[CREATED] shop={shop.id} seq={seq_key} last_number={max_num}"
                        self.stdout.write(self.style.SUCCESS(msg))
                        total_updated += 1
                    elif seq.last_number < max_num:
                        old = seq.last_number
                        if not dry_run:
                            seq.last_number = max_num
                            seq.save(update_fields=['last_number'])
                        msg = f"[UPDATED] shop={shop.id} seq={seq_key} {old} -> {max_num}"
                        self.stdout.write(self.style.WARNING(msg))
                        total_updated += 1
                    else:
                        self.stdout.write(
                            f"  [OK]     shop={shop.id} seq={seq_key} last_number={seq.last_number}"
                        )

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {total_updated} sequence(s) {'would be' if dry_run else 'were'} updated."
        ))
