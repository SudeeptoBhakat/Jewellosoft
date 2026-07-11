#
# JewelloSoft Community Edition
# Copyright (c) 2026 Sudeepta Bhakat
# Licensed under the JewelloSoft Community License.
#
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import OldPurchaseVoucher
from .serializers import OldPurchaseVoucherSerializer
from .services import generate_voucher_no

logger = logging.getLogger("jewellosoft")


class OldPurchaseVoucherViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for Old Purchase Vouchers.

    Extra actions:
      GET  /api/old-purchases/vouchers/lookup/?no={voucher_no}
           → Returns voucher data + validation (adjusted / not_adjusted).
    """

    serializer_class = OldPurchaseVoucherSerializer
    search_fields = ["voucher_no", "customer__name", "customer__phone", "description"]
    filterset_fields = ["shop", "status", "metal_type"]

    def get_queryset(self):
        shop = self.request.shop
        if not shop:
            return OldPurchaseVoucher.objects.none()
        qs = OldPurchaseVoucher.objects.filter(shop=shop).select_related("customer")
        # Additional filter by voucher_no (for exact lookup via ?voucher_no=PV-...)
        voucher_no = self.request.query_params.get("voucher_no")
        if voucher_no:
            qs = qs.filter(voucher_no__iexact=voucher_no.strip())
        return qs

    def create(self, request, *args, **kwargs):
        try:
            payload = request.data.copy()
            shop = request.shop
            if not shop:
                return Response(
                    {"detail": "Shop not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            payload["shop"] = shop.id

            # Auto-generate voucher_no if not provided
            if not payload.get("voucher_no"):
                payload["voucher_no"] = generate_voucher_no(shop)

            # Auto-fetch rate from latest rates if not provided
            if not payload.get("rate_per_10gm") or float(payload.get("rate_per_10gm", 0)) == 0:
                try:
                    from apps.rates.models import RateHistory
                    metal_type = payload.get("metal_type", "gold").lower()
                    latest_rate = (
                        RateHistory.objects
                        .filter(shop=shop, metal_type__icontains=metal_type[:4])
                        .order_by("-created_at")
                        .first()
                    )
                    if latest_rate:
                        payload["rate_per_10gm"] = float(latest_rate.rate_per_10gm)
                except Exception as e:
                    logger.warning("Could not auto-fetch rate for voucher: %s", e)

            serializer = self.get_serializer(data=payload)
            serializer.is_valid(raise_exception=True)
            voucher = serializer.save()
            return Response(
                OldPurchaseVoucherSerializer(voucher, context={"request": request}).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            logger.error("Error creating purchase voucher: %s", e, exc_info=True)
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"], url_path="lookup")
    def lookup(self, request):
        """
        GET /api/old-purchases/vouchers/lookup/?no=PV-2026-001

        Returns the voucher + a clear validation payload:
          - is_adjusted: bool
          - can_use: bool
          - error_message: str | null
        """
        voucher_no = request.query_params.get("no", "").strip()
        if not voucher_no:
            return Response(
                {"detail": "Voucher number is required. Use ?no=PV-YYYY-NNN"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        shop = request.shop
        if not shop:
            return Response({"detail": "Shop not found."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            voucher = OldPurchaseVoucher.objects.select_related("customer").get(
                shop=shop,
                voucher_no__iexact=voucher_no,
            )
        except OldPurchaseVoucher.DoesNotExist:
            return Response(
                {
                    "found": False,
                    "can_use": False,
                    "error_message": f"Voucher '{voucher_no}' not found. Please check the number and try again.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = OldPurchaseVoucherSerializer(voucher, context={"request": request})
        data = serializer.data

        is_adjusted = voucher.is_adjusted
        if is_adjusted:
            doc_type = "Invoice" if voucher.adjusted_invoice_no else "Estimate"
            doc_no = voucher.adjusted_invoice_no or voucher.adjusted_estimate_no
            error_msg = (
                f"Voucher {voucher.voucher_no} is already adjusted against "
                f"{doc_type} {doc_no}. Please select a different voucher."
            )
        else:
            error_msg = None

        return Response({
            "found": True,
            "can_use": not is_adjusted,
            "is_adjusted": is_adjusted,
            "error_message": error_msg,
            "voucher": data,
        })
