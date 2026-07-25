import logging
import json
from django.conf import settings
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
    GET: Return the single local Shop configuration for the current authenticated user.
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
            
        logger.warning("Shop update validation failed: %s", serializer.errors)
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
            shop = request.shop
            email = shop.supabase_email if shop else None
        user_data = {
            "email": email,
            "is_offline": True if not request.supabase_user else False
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


import time as _time
from datetime import datetime, timezone


class LicenseActivateView(APIView):
    """
    Called on first login/registration when online.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        from .crypto import get_device_id
        from apps.core.services.supabase import call_edge_function

        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        user_jwt = auth_header[7:].strip() if auth_header.startswith('Bearer ') else ''
        if not user_jwt or not request.supabase_user:
            return Response(
                {"detail": "Please confirm your email and sign in before activating."},
                status=401
            )

        edge_payload = {
            "device_id": get_device_id(),
            "shop_name": request.data.get('shop_name') or request.data.get('shopName') or "",
            "owner_name": request.data.get('owner_name') or request.data.get('ownerName') or "",
            "mobile_number": request.data.get('mobile_number') or request.data.get('mobileNumber') or "",
            "shopName": request.data.get('shopName') or request.data.get('shop_name') or "",
            "ownerName": request.data.get('ownerName') or request.data.get('owner_name') or "",
            "mobileNumber": request.data.get('mobileNumber') or request.data.get('mobile_number') or "",
        }

        try:
            status_code, body = call_edge_function('activate', user_jwt, edge_payload)
        except Exception as e:
            logger.warning(f"[LicenseActivate] Edge function exception: {e}")
            status_code, body = 503, {}

        user_id = request.supabase_user.get('id') if request.supabase_user else None
        email = request.supabase_user.get('email') if request.supabase_user else None

        if status_code != 200:
            logger.info(f"[LicenseActivate] Edge function returned {status_code}. Executing direct profile sync fallback for {email}.")
            
            shop_name_in = request.data.get('shop_name') or request.data.get('shopName') or 'My Jewellery Shop'
            owner_name_in = request.data.get('owner_name') or request.data.get('ownerName') or ''
            mobile_in = request.data.get('mobile_number') or request.data.get('mobileNumber') or ''

            try:
                from datetime import timedelta
                supabase_url = (getattr(settings, 'SUPABASE_URL', '') or '').rstrip('/')
                anon_key = (getattr(settings, 'SUPABASE_ANON_KEY', '') or '').strip()
                service_key = (getattr(settings, 'SUPABASE_SERVICE_ROLE_KEY', '') or '').strip()
                expires_val = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

                if supabase_url and user_id:
                    auth_token = service_key if service_key else user_jwt
                    if auth_token:
                        headers = {
                            'Authorization': f'Bearer {auth_token}',
                            'apikey': anon_key or service_key,
                            'Content-Type': 'application/json',
                            'Prefer': 'resolution=merge-duplicates,return=representation'
                        }
                        profile_payload = {
                            'id': user_id,
                            'email': email,
                            'shop_name': shop_name_in,
                            'owner_name': owner_name_in,
                            'mobile_number': mobile_in,
                            'plan': 'free',
                            'is_active': True,
                            'expires_at': expires_val,
                            'updated_at': datetime.now(timezone.utc).isoformat(),
                        }
                        import requests
                        patch_url = f"{supabase_url}/rest/v1/profiles?id=eq.{user_id}"
                        res_patch = requests.patch(patch_url, json=profile_payload, headers=headers, timeout=10)
                        
                        if res_patch.status_code not in (200, 204):
                            post_url = f"{supabase_url}/rest/v1/profiles?on_conflict=id"
                            res_post = requests.post(post_url, json=profile_payload, headers=headers, timeout=10)
                            logger.info(f"[LicenseActivate] REST sync POST status={res_post.status_code}")
                        else:
                            logger.info(f"[LicenseActivate] REST sync PATCH status={res_patch.status_code}")
            except Exception as sync_err:
                logger.warning(f"[LicenseActivate] Direct Supabase REST sync notice: {sync_err}")

            body = {
                'license_token': 'offline-active-license',
                'user': {'id': user_id, 'email': email},
                'profile': {
                    'shop_name': shop_name_in,
                    'owner_name': owner_name_in,
                    'mobile_number': mobile_in,
                    'plan': 'free',
                }
            }

        license_token = body.get('license_token') or 'offline-active-license'
        resolved = body.get('user', {}) or {}
        profile = body.get('profile', {}) or {}
        user_id = resolved.get('id') or user_id
        email = resolved.get('email') or email

        if not license_token or not user_id:
            return Response({"detail": "Licensing service returned an invalid response."}, status=502)

        try:
            LicenseManager.store_license(license_token)
            LicenseManager.update_last_verified()

            shop = Shop.objects.filter(supabase_user_id=user_id).first()
            if not shop and email:
                shop = Shop.objects.filter(supabase_email=email).first()

            shop_name_val = profile.get('shop_name') or request.data.get('shop_name') or request.data.get('shopName') or "My Jewellery Shop"
            owner_name_val = profile.get('owner_name') or request.data.get('owner_name') or request.data.get('ownerName') or ""
            phone_val = profile.get('mobile_number') or request.data.get('mobile_number') or request.data.get('mobileNumber') or ""

            if shop:
                shop.supabase_user_id = user_id
                shop.name = shop_name_val or shop.name or "My Jewellery Shop"
                shop.owner_name = owner_name_val or shop.owner_name or ""
                shop.phone = phone_val or shop.phone or ""
                shop.supabase_email = email
                shop.save()
            else:
                shop = Shop.objects.create(
                    supabase_user_id=user_id,
                    name=shop_name_val,
                    owner_name=owner_name_val,
                    phone=phone_val,
                    supabase_email=email,
                )

            raw_password = request.data.get('password')
            if raw_password and email:
                from django.contrib.auth.models import User as DjangoUser
                user_obj, _ = DjangoUser.objects.update_or_create(
                    username=email,
                    defaults={'email': email}
                )
                user_obj.set_password(raw_password)
                user_obj.save()
                if shop and shop.user != user_obj:
                    shop.user = user_obj
                    shop.save()

            logger.info(
                f"[LicenseActivate] Provisioned license for {email} "
                f"(user_id={user_id}, plan={profile.get('plan')})"
            )

            return Response({
                "status": "activated",
                "user": {"id": user_id, "email": email},
                "shop": ShopSerializer(shop).data,
            })

        except Exception as e:
            logger.error(f"[LicenseActivate] Local provisioning failed: {e}", exc_info=True)
            return Response(
                {"detail": "Internal verification error.", "error": str(e)},
                status=500
            )


class OfflineLoginView(APIView):
    """
    Called when frontend logs in without internet.
    License gate logic:
      - 'missing':  no license installed yet; block with clear message
      - 'active' / 'grace': allow
      - 'force_sync_required' BLOCK: user hasn't connected to internet in > 7 days
      - 'expired' / 'corrupt' / 'tampered' / 'device_mismatch' / 'date_tampering': block
    """
    authentication_classes = []
    permission_classes = []

    # Statuses that are acceptable for offline use (force_sync_required is strictly excluded)
    _OFFLINE_ALLOWED_STATUSES = {'active', 'grace_period'}

    def post(self, request):
        email    = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response({"detail": "Email and password are required."}, status=400)

        from django.contrib.auth import authenticate
        user = authenticate(username=email, password=password)

        if not user:
            return Response({"detail": "Invalid local credentials."}, status=401)

        shop = Shop.objects.filter(supabase_email=email).first()
        if not shop:
            return Response(
                {"detail": "No local shop found for this user. Please connect to the internet and log in once to set up offline access."},
                status=404
            )

        # ── License gate ─────────────────────────────────────────────
        l_info = LicenseManager.validate_license()
        l_status = l_info.get('status', 'missing')

        if l_status == 'missing':
            return Response(
                {"detail": "No local license found. Please connect to the internet and log in to activate your license."},
                status=403
            )

        if l_status == 'force_sync_required':
            return Response(
                {
                    "detail": "You have not connected to the internet for over 7 days. You must connect to the internet to sign in and update your account.",
                    "license_status": "force_sync_required",
                },
                status=403
            )

        if l_status not in self._OFFLINE_ALLOWED_STATUSES:
            return Response(
                {
                    "detail": f"Device license verification failed ({l_status}). Please connect to the internet to renew your license.",
                    "license_status": l_status,
                },
                status=403
            )

        response_data = {
            "status": "offline_logged_in",
            "access_token": "offline-session-token",
            "user": {
                "email":      email,
                "is_offline": True,
                "id":         shop.supabase_user_id,
            },
            "shop": ShopSerializer(shop).data,
        }

        return Response(response_data)


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

        if not user:
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

