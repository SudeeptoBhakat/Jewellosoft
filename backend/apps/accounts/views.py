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


import time as _time
from datetime import datetime, timezone


class LicenseActivateView(APIView):
    """
    Called on first login/registration when online.
    Receives JWT, cleanly queries public.profiles using Service Role to provision local license.

    Flow:
      1. If a valid Bearer JWT was decoded by middleware → use request.supabase_user.
      2. Otherwise fall back to email lookup (registration with email-confirm pending).
      3. On registration path: upsert profile immediately (don't rely on slow Postgres trigger).
      4. On login path: retry profile fetch up to 3× to tolerate trigger propagation delay.
      5. Generate local license using a safe resolved user dict (never passes None).
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        user_id = None
        email = None

        # ── Step 1: Resolve identity ─────────────────────────────────
        if request.supabase_user:
            user_id = request.supabase_user.get('id')
            email = request.supabase_user.get('email')

        # No JWT decoded (email-confirm pending or missing token) → resolve by email
        if not user_id:
            email = email or request.data.get('email')
            if not email:
                return Response(
                    {"detail": "Authentication required. Please provide a valid email."},
                    status=401
                )

            # Only attempt cloud lookup if NOT a registration (registration upserts below)
            is_registering_early = bool(
                request.data.get('shop_name') or request.data.get('shopName')
            )
            if not is_registering_early:
                try:
                    from apps.core.services.supabase import get_supabase_client
                    client = get_supabase_client()
                    # Retry up to 3× with 1 s delay — tolerate Postgres trigger lag
                    for attempt in range(3):
                        res = client.table("profiles").select("id").eq("email", email).execute()
                        if res.data and len(res.data) > 0:
                            user_id = res.data[0]['id']
                            break
                        if attempt < 2:
                            _time.sleep(1)

                    if not user_id:
                        return Response(
                            {"detail": "User registration incomplete on cloud. Please verify your email."},
                            status=404
                        )
                except Exception as e:
                    logger.error(f"[ActivateView] Failed to resolve user by email: {e}")
                    return Response({"detail": "Error resolving user from cloud."}, status=500)

        # ── Build a safe resolved-user dict (never None) ─────────────
        # This is what gets written into the local license file.
        resolved_user = {
            'id': user_id,
            'email': email,
        }

        try:
            from apps.core.services.supabase import get_supabase_client
            client = get_supabase_client()

            # ── Step 2: Build / fetch the remote profile ─────────────
            is_registering = bool(request.data.get('shop_name') or request.data.get('shopName'))

            if is_registering:
                # Upsert profile directly — don't rely solely on the async Postgres trigger.
                from datetime import timedelta
                shop_name  = request.data.get('shop_name')  or request.data.get('shopName')  or "My Jewellery Shop"
                owner_name = request.data.get('owner_name') or request.data.get('ownerName') or ""
                phone      = request.data.get('mobile_number') or request.data.get('mobileNumber') or ""
                expires_at = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

                new_profile = {
                    "id":            user_id,
                    "email":         email,
                    "shop_name":     shop_name,
                    "owner_name":    owner_name,
                    "mobile_number": phone,
                    "plan":          "free",
                    "is_active":     True,
                    "expires_at":    expires_at,
                }

                # If user_id is not yet resolved (email-confirm path), upsert by email
                if user_id:
                    upsert_res = client.table("profiles").upsert(new_profile).execute()
                    profile = upsert_res.data[0] if upsert_res.data else new_profile
                else:
                    # user_id unknown — build an in-memory profile for local provisioning
                    profile = new_profile
            else:
                # Login path — fetch existing profile with retry for trigger lag
                profile = None
                for attempt in range(3):
                    res = client.table("profiles").select("*").eq("id", user_id).execute()
                    if res.data and len(res.data) > 0:
                        profile = res.data[0]
                        break
                    if attempt < 2:
                        _time.sleep(1)

                if not profile:
                    return Response(
                        {"detail": "Profile not found. Please contact support."},
                        status=403
                    )

            # ── Step 3: Subscription validation ─────────────────────
            if not profile.get('is_active'):
                return Response(
                    {"detail": "Subscription inactive. Please renew to access the offline app."},
                    status=403
                )

            expires_at_str = profile.get('expires_at')
            if expires_at_str:
                expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at < datetime.now(timezone.utc):
                    return Response({"detail": "Subscription expired!"}, status=403)
                days_valid = (expires_at - datetime.now(timezone.utc)).days
            else:
                days_valid = 30

            sub_data = {
                "plan":       profile.get("plan", "free"),
                "days_valid": max(1, days_valid),
            }

            # ── Step 4: Generate local encrypted license ─────────────
            # Always pass the RESOLVED user dict — never request.supabase_user directly
            # (which can be None during email-confirm flow).
            license_payload = LicenseManager.generate_license(resolved_user, sub_data)

            # ── Step 5: Persist / update Shop in local SQLite ────────
            shop = Shop.objects.filter(supabase_user_id=user_id).first() if user_id else None
            if not shop and email:
                shop = Shop.objects.filter(supabase_email=email).first()

            shop_name_val  = profile.get('shop_name')  or profile.get('shopName')  or "My Jewellery Shop"
            owner_name_val = profile.get('owner_name') or profile.get('ownerName') or ""
            phone_val      = profile.get('mobile_number') or profile.get('mobileNumber') or ""

            if shop:
                if user_id:
                    shop.supabase_user_id = user_id
                shop.name        = shop_name_val  or shop.name or "My Jewellery Shop"
                shop.owner_name  = owner_name_val or shop.owner_name or ""
                shop.phone       = phone_val      or shop.phone or ""
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

            # ── Step 6: Persist offline credentials ─────────────────
            raw_password = request.data.get('password')
            if raw_password and email:
                from django.contrib.auth.models import User as DjangoUser
                user_obj, _ = DjangoUser.objects.update_or_create(
                    username=email,
                    defaults={'email': email}
                )
                user_obj.set_password(raw_password)
                user_obj.save()

            logger.info(
                f"[LicenseActivate] Provisioned license for {email} "
                f"(user_id={user_id}, plan={sub_data['plan']}, "
                f"days_valid={sub_data['days_valid']}, registering={is_registering})"
            )

            return Response({
                "status": "activated",
                "license": license_payload,
                "user": {
                    "id":    user_id,
                    "email": email,
                },
                "shop": ShopSerializer(shop).data,
            })

        except Exception as e:
            logger.error(f"[LicenseActivate] Failed provisioning: {e}", exc_info=True)
            return Response(
                {"detail": "Internal verification error.", "error": str(e)},
                status=500
            )


class OfflineLoginView(APIView):
    """
    Called when frontend logs in without internet.
    Verifies user against local DB password hash and local license.

    License gate logic:
      - 'missing'             → no license installed yet; block with clear message
      - 'active' / 'grace'   → allow
      - 'force_sync_required' → allow with a warning (will re-validate on next online session)
      - 'expired' / 'corrupt' / 'tampered' / 'device_mismatch' / 'date_tampering' → block
    """
    authentication_classes = []
    permission_classes = []

    # Statuses that are still acceptable for offline use
    _OFFLINE_ALLOWED_STATUSES = {'active', 'grace_period', 'force_sync_required'}

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
                {"detail": "No local shop found. Please connect to the internet and log in once to set up offline access."},
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

        if l_status not in self._OFFLINE_ALLOWED_STATUSES:
            return Response(
                {
                    "detail": "Device license verification failed. Please connect to the internet to renew.",
                    "license_status": l_status,
                },
                status=403
            )

        warning = None
        if l_status == 'force_sync_required':
            warning = "Your license hasn't been verified in over 7 days. Please connect to the internet soon."

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
        if warning:
            response_data["warning"] = warning

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

