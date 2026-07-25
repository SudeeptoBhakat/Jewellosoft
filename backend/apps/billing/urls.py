from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InvoiceViewSet, EstimateViewSet, BillingPreviewViewSet, CreditNoteViewSet

router = DefaultRouter()
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'estimates', EstimateViewSet, basename='estimate')
router.register(r'preview', BillingPreviewViewSet, basename='preview')
router.register(r'credit-notes', CreditNoteViewSet, basename='credit-note')

urlpatterns = [
    path('', include(router.urls)),
]
