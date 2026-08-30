from django.urls import path
from .views import (
    ShopCurrentView, AuthMeView, LicenseStatusView, LicenseActivateView,
    OfflineLoginView, WatermarkUploadView, ResetDataView, ResetNumberingView,
    LoginView, RegisterView, VerifyAdminPasswordView
)

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='auth_login'),
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/verify-password/', VerifyAdminPasswordView.as_view(), name='auth_verify_password'),
    path('shop/current/', ShopCurrentView.as_view(), name='shop_current'),
    path('shop/watermark/', WatermarkUploadView.as_view(), name='shop_watermark'),
    path('shop/reset-data/', ResetDataView.as_view(), name='shop_reset_data'),
    path('shop/reset-numbering/', ResetNumberingView.as_view(), name='shop_reset_numbering'),
    path('auth/me/', AuthMeView.as_view(), name='auth_me'),
    path('license/status/', LicenseStatusView.as_view(), name='license_status'),
    path('auth/activate/', LicenseActivateView.as_view(), name='license_activate'),
    path('auth/offline-login/', OfflineLoginView.as_view(), name='offline_login'),
]


