from django.urls import path
from .views import ShopCurrentView, AuthMeView, LicenseStatusView, LicenseActivateView, OfflineLoginView, WatermarkUploadView, ResetDataView

urlpatterns = [
    path('shop/current/', ShopCurrentView.as_view(), name='shop_current'),
    path('shop/watermark/', WatermarkUploadView.as_view(), name='shop_watermark'),
    path('shop/reset-data/', ResetDataView.as_view(), name='shop_reset_data'),
    path('auth/me/', AuthMeView.as_view(), name='auth_me'),
    path('license/status/', LicenseStatusView.as_view(), name='license_status'),
    path('auth/activate/', LicenseActivateView.as_view(), name='license_activate'),
    path('auth/offline-login/', OfflineLoginView.as_view(), name='offline_login'),
]

