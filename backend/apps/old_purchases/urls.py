#
# JewelloSoft Community Edition
# Copyright (c) 2026 Sudeepta Bhakat
# Licensed under the JewelloSoft Community License.
#
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OldPurchaseVoucherViewSet

router = DefaultRouter()
router.register(r"vouchers", OldPurchaseVoucherViewSet, basename="old-purchase-voucher")

urlpatterns = [
    path("", include(router.urls)),
]
