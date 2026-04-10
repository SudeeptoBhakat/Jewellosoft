import logging
import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import Shop, SyncQueue
from .serializers import ShopSerializer
from .crypto import LicenseManager

logger = logging.getLogger('jewellosoft')

class ShopCurrentView(APIView):
    """
    GET: Return the single local Shop configuration.
    PATCH: Update Settings/Business info and add to SyncQueue for backup.
    """
    def get(self, request):
        shop = Shop.objects.first()
        if not shop:
            return Response({"detail": "Shop not configured."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ShopSerializer(shop)
        return Response(serializer.data)

    def patch(self, request):
        shop = Shop.objects.first()
        if not shop:
            return Response({"detail": "Shop not configured."}, status=status.HTTP_404_NOT_FOUND)
            
        serializer = ShopSerializer(shop, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            
            # Add to SyncQueue for background backup
            SyncQueue.objects.create(
                model_name='Shop',
                object_id=shop.id,
                action='update',
                payload=serializer.data
            )
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AuthMeView(APIView):
    """
    Returns the currently active identity (local offline check).
    """
    authentication_classes = []
    permission_classes = []
    def get(self, request):
        shop = Shop.objects.first()
        user_data = {
            "email": shop.supabase_email if shop else "offline@jewellosoft.local",
            "is_offline": True
        }
        return Response({"user": user_data})


class LicenseStatusView(APIView):
    """
    Checks the local license file status.
    """
    authentication_classes = []
    permission_classes = []
    
    def get(self, request):
        info = LicenseManager.validate_license()
        return Response(info)


from datetime import datetime, timezone

class LicenseActivateView(APIView):
    """
    Called on first login when online.
    Receives JWT, cleanly queries public.profiles using Service Role to provision local license.
    """
    authentication_classes = []
    permission_classes = []
    
    def post(self, request):
        user_id = None
        email = None
        
        if request.supabase_user:
            user_id = request.supabase_user['id']
            email = request.supabase_user.get('email')
        else:
            email = request.data.get('email')
            if not email:
                return Response({"detail": "Invalid or missing Supabase Auth Token."}, status=401)
                
            try:
                from apps.core.services.supabase import get_supabase_client
                client = get_supabase_client()
                # Attempt to find user by email from profiles table
                res = client.table("profiles").select("id").eq("email", email).execute()
                if res.data and len(res.data) > 0:
                    user_id = res.data[0]['id']
                else:
                    return Response({"detail": "User registration incomplete on cloud."}, status=404)
            except Exception as e:
                logger.error(f"[ActivateView] Failed to find user by email: {e}")
                return Response({"detail": "Error resolving user from cloud."}, status=500)
            
        try:
            from apps.core.services.supabase import get_supabase_client
            client = get_supabase_client()
            
            # Check if this request includes registration metadata.
            is_registering = bool(request.data.get('shop_name') or request.data.get('shopName'))
            
            if is_registering:
                # Force UPSERT profile (ignore trigger) and create subscription (free trial)
                shop_name = request.data.get('shop_name') or request.data.get('shopName') or "My Jewellery Shop"
                owner_name = request.data.get('owner_name') or request.data.get('ownerName') or ""
                phone = request.data.get('mobile_number') or request.data.get('mobileNumber') or ""
                
                from datetime import timedelta
                expires_at = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
                
                new_profile = {
                    "id": user_id,
                    "email": email,
                    "shop_name": shop_name,
                    "owner_name": owner_name,
                    "mobile_number": phone,
                    "plan": "free",
                    "is_active": True,
                    "expires_at": expires_at
                }
                upsert_res = client.table("profiles").upsert(new_profile).execute()
                profile = upsert_res.data[0] if upsert_res.data else new_profile
            else:
                # Fetch remote subscription/profile safely bypassing RLS
                res = client.table("profiles").select("*").eq("id", user_id).execute()
                if not res.data or len(res.data) == 0:
                    return Response({"detail": "Profile not found. Please contact support."}, status=403)
                profile = res.data[0]
            
            if not profile.get('is_active'):
                return Response({"detail": "Subscription inactive. Please renew to access the offline app."}, status=403)
                
            expires_at_str = profile.get('expires_at')
            
            if expires_at_str:
                # Naive to UTC conversion from ISO
                expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at < datetime.now(timezone.utc):
                    return Response({"detail": "Subscription expired!"}, status=403)
                days_valid = (expires_at - datetime.now(timezone.utc)).days
            else:
                days_valid = 30 # Default safety fallback
                
            sub_data = {
                "plan": profile.get("plan", "free"),
                "days_valid": max(1, days_valid) # Ensure it has at least 1 remaining day
            }
            
            # Provision Local Encrypted License
            payload = LicenseManager.generate_license(request.supabase_user, sub_data)
            
            # Persist Shop Info seamlessly and OVERWRITE with the latest cloud truth
            # We enforce a local Singleton pattern to avoid accidentally creating ghost rows
            shop = Shop.objects.first()
            if shop:
                # If a different user authenticates OR a fresh registration occurs, clear legacy local-only data
                if shop.supabase_user_id != user_id or is_registering:
                    shop.gst_number = None
                    shop.address = ""
                    shop.email = None
                    
                shop.supabase_user_id = user_id
                shop.name = profile.get('shop_name') or profile.get('shopName') or shop.name or "My Jewellery Shop"
                shop.owner_name = profile.get('owner_name') or profile.get('ownerName') or shop.owner_name or ""
                shop.phone = profile.get('mobile_number') or profile.get('mobileNumber') or shop.phone or ""
                shop.supabase_email = email
                shop.save()
            else:
                shop = Shop.objects.create(
                    supabase_user_id=user_id,
                    name=profile.get('shop_name') or profile.get('shopName') or "My Jewellery Shop",
                    owner_name=profile.get('owner_name') or profile.get('ownerName') or "",
                    phone=profile.get('mobile_number') or profile.get('mobileNumber') or "",
                    supabase_email=email
                )
            
            # Persist Offline Authentication credentials
            raw_password = request.data.get('password')
            if raw_password and email:
                from django.contrib.auth.models import User
                user_obj, _ = User.objects.update_or_create(
                    username=email,
                    defaults={'email': email}
                )
                user_obj.set_password(raw_password)
                user_obj.save()
            
            return Response({
                "status": "activated",
                "license": payload,
                "shop": ShopSerializer(shop).data
            })
            
        except Exception as e:
            logger.error(f"[LicenseActivate] Failed provisioning: {e}")
            return Response({"detail": "Internal verification error.", "error": str(e)}, status=500)


class OfflineLoginView(APIView):
    """
    Called when frontend logs in without internet.
    Verifies user against local DB password hash.
    """
    authentication_classes = []
    permission_classes = []
    
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        
        from django.contrib.auth import authenticate
        user = authenticate(username=email, password=password)
        
        if not user:
            return Response({"detail": "Invalid local credentials."}, status=401)
            
        shop = Shop.objects.filter(supabase_email=email).first()
        if not shop:
            return Response({"detail": "No local shop configuration found for this account."}, status=404)
            
        # Optional: check if license matches device
        l_info = LicenseManager.validate_license()
        if not l_info.get('valid') and l_info.get('status') != 'missing':
            # Missing allows fresh offline use technically if we are lenient, or we can enforce
            return Response({"detail": "Device license verification failed offline.", "status": l_info.get('status')}, status=403)
            
        return Response({
            "status": "offline_logged_in",
            "access_token": "offline-session-token",
            "user": {
                "email": email,
                "is_offline": True,
                "id": shop.supabase_user_id
            },
            "shop": ShopSerializer(shop).data
        })

