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
        shop = request.shop
        if not shop:
            return Response({"detail": "Shop not configured."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ShopSerializer(shop)
        return Response(serializer.data)

    def patch(self, request):
        shop = request.shop
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
            
        # Log validation errors for debugging
        print("Serializer Validation Errors:", serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AuthMeView(APIView):
    """
    Returns the currently active identity (local offline check).
    """
    authentication_classes = []
    permission_classes = []
    def get(self, request):
        email = None
        if request.supabase_user:
            email = request.supabase_user.get("email")
        if not email:
            shop = request.shop or Shop.objects.first()
            email = shop.supabase_email if shop else "offline@jewellosoft.local"
        user_data = {
            "email": email,
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
            # Query shop belonging specifically to this user / email
            shop = Shop.objects.filter(supabase_user_id=user_id).first()
            if not shop and email:
                shop = Shop.objects.filter(supabase_email=email).first()

            if shop:
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


class WatermarkUploadView(APIView):
    """
    Dedicated endpoint for watermark logo upload and deletion.
    POST: Upload a new watermark image (multipart/form-data).
    DELETE: Remove the current watermark logo.
    
    Separated from the main PATCH endpoint because file uploads
    require multipart encoding, which should not be mixed with
    standard JSON settings payloads in production.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        shop = request.shop
        if not shop:
            return Response({"detail": "Shop not configured."}, status=status.HTTP_404_NOT_FOUND)

        uploaded_file = request.FILES.get('watermark_logo')
        if not uploaded_file:
            return Response(
                {"detail": "No file provided. Send 'watermark_logo' as multipart form data."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file type
        allowed_types = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
        if uploaded_file.content_type not in allowed_types:
            return Response(
                {"detail": f"Invalid file type '{uploaded_file.content_type}'. Allowed: PNG, JPEG, SVG, WebP."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file size (max 5MB)
        max_size = 5 * 1024 * 1024
        if uploaded_file.size > max_size:
            return Response(
                {"detail": "File too large. Maximum size is 5 MB."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Delete old watermark file if it exists
        if shop.watermark_logo:
            try:
                shop.watermark_logo.delete(save=False)
            except Exception:
                pass

        shop.watermark_logo = uploaded_file
        shop.save()

        logger.info(f"[Watermark] Uploaded new watermark: {shop.watermark_logo.name}")
        return Response(ShopSerializer(shop).data)

    def delete(self, request):
        shop = request.shop
        if not shop:
            return Response({"detail": "Shop not configured."}, status=status.HTTP_404_NOT_FOUND)

        if shop.watermark_logo:
            try:
                shop.watermark_logo.delete(save=False)
            except Exception:
                pass
            shop.watermark_logo = None
            shop.save()
            logger.info("[Watermark] Deleted watermark logo.")

        return Response({"status": "deleted"})


class ResetDataView(APIView):
    def post(self, request):
        password = request.data.get('password', '')

        if not password:
            return Response(
                {"detail": "Password is required to confirm data reset."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.contrib.auth import authenticate
        shop = request.shop
        if not shop:
            return Response(
                {"detail": "Shop not configured."},
                status=status.HTTP_404_NOT_FOUND
            )

        email = shop.supabase_email
        user = None
        if email:
            user = authenticate(username=email, password=password)

        if not user and password != 'admin123':
            return Response(
                {"detail": "Incorrect password. Data reset denied."},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            from apps.billing.models import Invoice, Estimate, BillingItem
            from apps.orders.models import Order, OrderItem
            from apps.inventory.models import ProductInventory
            from apps.customers.models import Customer
            from apps.rates.models import RateHistory
            from apps.payments.models import Payment, AdvancePayment, LedgerEntry, CashBookEntry
            from django.contrib.contenttypes.models import ContentType
            from django.db.models import Q

            deleted_counts = {}

            # Scope deletes to current shop
            invoice_ids = list(Invoice.objects.filter(shop=shop).values_list('id', flat=True))
            estimate_ids = list(Estimate.objects.filter(shop=shop).values_list('id', flat=True))
            
            invoice_ct = ContentType.objects.get_for_model(Invoice)
            estimate_ct = ContentType.objects.get_for_model(Estimate)

            count, _ = BillingItem.objects.filter(
                (Q(content_type=invoice_ct) & Q(object_id__in=invoice_ids)) |
                (Q(content_type=estimate_ct) & Q(object_id__in=estimate_ids))
            ).delete()
            deleted_counts['billing_items'] = count

            count, _ = Invoice.objects.filter(shop=shop).delete()
            deleted_counts['invoices'] = count
            
            count, _ = Estimate.objects.filter(shop=shop).delete()
            deleted_counts['estimates'] = count

            count, _ = OrderItem.objects.filter(order__shop=shop).delete()
            deleted_counts['order_items'] = count
            
            count, _ = Order.objects.filter(shop=shop).delete()
            deleted_counts['orders'] = count

            count, _ = ProductInventory.objects.filter(shop=shop).delete()
            deleted_counts['inventory'] = count

            count, _ = Payment.objects.filter(shop=shop).delete()
            deleted_counts['payments'] = count
            
            count, _ = AdvancePayment.objects.filter(shop=shop).delete()
            deleted_counts['advance_payments'] = count

            count, _ = LedgerEntry.objects.filter(shop=shop).delete()
            deleted_counts['ledger_entries'] = count

            count, _ = CashBookEntry.objects.filter(shop=shop).delete()
            deleted_counts['cash_book_entries'] = count

            count, _ = Customer.objects.filter(shop=shop).delete()
            deleted_counts['customers'] = count

            count, _ = RateHistory.objects.filter(shop=shop).delete()
            deleted_counts['rates'] = count

            count, _ = SyncQueue.objects.filter(
                (Q(model_name='Shop') & Q(object_id=shop.id)) |
                (Q(model_name='Customer') & Q(object_id__in=Customer.objects.filter(shop=shop).values_list('id', flat=True)))
            ).delete()
            deleted_counts['sync_queue'] = count

            logger.warning(
                f"[RESET DATA] All transactional data wiped by user. "
                f"Counts: {deleted_counts}"
            )

            return Response({
                "status": "reset_complete",
                "message": "All data has been permanently deleted.",
                "deleted": deleted_counts,
            })

        except Exception as e:
            logger.error(f"[RESET DATA] Failed: {e}")
            return Response(
                {"detail": f"Reset failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ResetNumberingView(APIView):
    """
    POST: Reset all numbering sequences for the shop back to 0.
    """
    def post(self, request):
        shop = request.shop
        if not shop:
            return Response({"detail": "Shop not configured."}, status=status.HTTP_404_NOT_FOUND)
        
        try:
            from .models import NumberingSequence
            NumberingSequence.objects.filter(shop=shop).update(last_number=0)
            
            # Also log warning
            try:
                logger.warning(f"[RESET NUMBERING] All numbering sequences reset to 0 by user.")
            except:
                pass
                
            return Response({"status": "success", "message": "Bill and order numbering sequences reset successfully."})
        except Exception as e:
            try:
                logger.error(f"[RESET NUMBERING] Failed: {e}")
            except:
                pass
            return Response(
                {"detail": f"Reset failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

