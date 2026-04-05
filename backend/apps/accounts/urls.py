from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ShopViewSet, CurrentShopView, RegisterView, MeView

router = DefaultRouter()
router.register(r'shops', ShopViewSet, basename='shop')

urlpatterns = [
    # ── Auth Endpoints ────────────────────────────────────────────────
    path('auth/register/', RegisterView.as_view(), name='auth-register'),
    path('auth/me/', MeView.as_view(), name='auth-me'),

    # ── Identity-aware endpoint (must be BEFORE the router catch-all) ──
    path('shop/current/', CurrentShopView.as_view(), name='shop-current'),

    # ── Admin CRUD ────────────────────────────────────────────────────
    path('', include(router.urls)),
]
