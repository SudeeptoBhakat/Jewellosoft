from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PaymentViewSet, AdvancePaymentViewSet

router = DefaultRouter()
router.register(r'advances', AdvancePaymentViewSet, basename='advance')
router.register(r'', PaymentViewSet, basename='payment')

urlpatterns = [
    path('', include(router.urls)),
]

