from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DueEntryViewSet

router = DefaultRouter()
router.register(r'', DueEntryViewSet, basename='due-entries')

urlpatterns = [
    path('', include(router.urls)),
]
