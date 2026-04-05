"""
─── Accounts Views ────────────────────────────────────────────────
CurrentShopView: Identity-aware shop resolution for Supabase users.
ShopViewSet:     Admin CRUD (unchanged, kept for backward compat).
────────────────────────────────────────────────────────────────────
"""

import logging

from django.contrib.auth import get_user_model
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
import logging

from .models import Shop
from .serializers import ShopSerializer

logger = logging.getLogger('jewellosoft')
User = get_user_model()


# ══════════════════════════════════════════════════════════════════
#  Local Auth Views — Registration & Me
# ══════════════════════════════════════════════════════════════════

class RegisterView(APIView):
    """
    POST /api/accounts/auth/register/
    Locally registers a new User and returns JWT tokens.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        
        if not email or not password:
            return Response({'detail': 'Email and password are required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if User.objects.filter(username=email).exists():
            return Response({'detail': 'User with this email already exists.'}, status=status.HTTP_409_CONFLICT)
            
        user = User.objects.create_user(username=email, email=email, password=password)
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': {'id': user.id, 'email': user.email},
            'session': {
                'access_token': str(refresh.access_token),
                'refresh_token': str(refresh)
            }
        }, status=status.HTTP_201_CREATED)

class MeView(APIView):
    """
    GET /api/accounts/auth/me/
    Returns the currently authenticated user's details.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        return Response({
            'user': {
                'id': request.user.id,
                'email': request.user.email,
                'username': request.user.username
            }
        })


# ══════════════════════════════════════════════════════════════════
#  CurrentShopView — The Local-aware endpoint
# ══════════════════════════════════════════════════════════════════

class CurrentShopView(APIView):
    """
    Resolves the Shop belonging to the currently authenticated local user.
    """
    permission_classes = [IsAuthenticated]

    # ── GET: Fetch current user's shop ────────────────────────────
    def get(self, request):
        # request.user.shop is available because of related_name='shop'
        shop = getattr(request.user, 'shop', None)
        
        if shop is None:
            return Response(
                {'detail': 'No shop found for this account. Please complete onboarding.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ShopSerializer(shop)
        return Response(serializer.data)

    # ── POST: Create shop during onboarding ───────────────────────
    def post(self, request):
        shop = getattr(request.user, 'shop', None)
        if shop is not None:
            return Response(
                {'detail': 'Shop already exists for this account.'},
                status=status.HTTP_409_CONFLICT,
            )

        data = request.data.copy()
        if not data.get('email'):
            data['email'] = request.user.email

        serializer = ShopSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        shop = serializer.save(user=request.user)

        logger.info(
            '[CurrentShop] Shop created locally: id=%s name=%s user=%s',
            shop.id, shop.name, request.user.id,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # ── PUT: Full update ──────────────────────────────────────────
    def put(self, request):
        shop = getattr(request.user, 'shop', None)
        if shop is None:
            return Response(
                {'detail': 'No shop found for this account.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ShopSerializer(shop, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)

    # ── PATCH: Partial update ─────────────────────────────────────
    def patch(self, request):
        shop = getattr(request.user, 'shop', None)
        if shop is None:
            return Response(
                {'detail': 'No shop found for this account.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ShopSerializer(shop, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)


# ══════════════════════════════════════════════════════════════════
#  ShopViewSet — Admin CRUD (existing, kept for backward compat)
# ══════════════════════════════════════════════════════════════════

class ShopViewSet(viewsets.ModelViewSet):
    """
    Standard CRUD for Shop records.
    Used by admin panel / future internal tools.
    """
    queryset = Shop.objects.all()
    serializer_class = ShopSerializer
