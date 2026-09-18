import requests
import logging
import json
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, viewsets
from django.shortcuts import get_object_or_404
from .models import Shop, SyncQueue, Karigar
from .serializers import ShopSerializer, KarigarSerializer
from .crypto import LicenseManager
from datetime import timedelta
from django.contrib.auth import authenticate
from django.contrib.auth.models import User as DjangoUser
from supabase import create_client


logger = logging.getLogger('jewellosoft')
supabase_url = (getattr(settings, 'SUPABASE_URL', '') or '').rstrip('/')
anon_key = (getattr(settings, 'SUPABASE_ANON_KEY', '') or '').strip()
service_key = (getattr(settings, 'SUPABASE_SERVICE_ROLE_KEY', '') or '').strip()


class ShopCurrentView(APIView):
    """
    GET: Return the single local Shop configuration for the current authenticated user.
    PATCH: Update Settings/Business info and add to SyncQueue for backup.
    """
    def get(self, request):
        shop = request.shop or Shop.objects.first()
        if not shop:
            return Response({"detail": "Shop not configured."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ShopSerializer(shop)
        return Response(serializer.data)

    def patch(self, request):
        shop = request.shop or Shop.objects.first()
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
            shop = request.shop or Shop.objects.first()
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


class NumberingSettingsView(APIView):
    """
    GET: Retrieve current numbering sequences and next numbers for the shop.
    POST: Update next starting numbers for document sequences.
    """
    DEFINITIONS = [
        ('invoice', 'Bill Invoice', 'INV', 'Tax Invoice series'),
        ('estimate', 'Estimate', 'EST', 'Quotation / Estimate series'),
        ('order_invoice', 'Order (Invoice)', 'ORD-INV', 'Custom Orders under Invoice series'),
        ('order_estimate', 'Order (Estimate)', 'ORD-EST', 'Custom Orders under Estimate series'),
        ('purchase_voucher', 'Purchase Voucher', 'PV', 'Old metal purchase series'),
        ('credit_note', 'Credit Note', 'CN', 'Customer Credit / Return note series'),
        ('advance_receipt', 'Advance Receipt', 'ADV-RCT', 'Advance payment receipt series'),
        ('refund_receipt', 'Refund Receipt', 'REF', 'Refund payment receipt series'),
    ]

    def _get_year(self, request):
        from datetime import date
        year_param = request.query_params.get('year') or request.data.get('year')
        try:
            return int(year_param) if year_param else date.today().year
        except (ValueError, TypeError):
            return date.today().year

    def get(self, request):
        shop = request.shop
        if not shop:
            return Response({"detail": "Shop not configured."}, status=status.HTTP_404_NOT_FOUND)

        year = self._get_year(request)
        from .models import NumberingSequence

        sequences = []
        for key, label, prefix_code, desc in self.DEFINITIONS:
            seq_key = f"{key}_{year}"
            prefix = f"{prefix_code}-{year}-"
            seq = NumberingSequence.objects.filter(shop=shop, sequence_type=seq_key).first()
            last_num = seq.last_number if seq else 0
            next_num = last_num + 1
            sample = f"{prefix}{next_num:03d}"

            sequences.append({
                'key': key,
                'label': label,
                'prefix': prefix,
                'description': desc,
                'last_number': last_num,
                'next_number': next_num,
                'preview': sample
            })

        return Response({
            'year': year,
            'sequences': sequences
        })

    def post(self, request):
        shop = request.shop
        if not shop:
            return Response({"detail": "Shop not configured."}, status=status.HTTP_404_NOT_FOUND)

        year = self._get_year(request)
        new_sequences = request.data.get('sequences', {})
        if not isinstance(new_sequences, dict):
            return Response({"detail": "Invalid sequences payload."}, status=status.HTTP_400_BAD_REQUEST)

        from .models import NumberingSequence

        valid_keys = {item[0] for item in self.DEFINITIONS}

        for key, next_val in new_sequences.items():
            if key not in valid_keys:
                continue
            try:
                val = int(next_val)
                if val < 1:
                    continue
                seq_key = f"{key}_{year}"
                NumberingSequence.set_next_number(shop, seq_key, val)
            except (ValueError, TypeError):
                continue

        sequences = []
        for key, label, prefix_code, desc in self.DEFINITIONS:
            seq_key = f"{key}_{year}"
            prefix = f"{prefix_code}-{year}-"
            seq = NumberingSequence.objects.filter(shop=shop, sequence_type=seq_key).first()
            last_num = seq.last_number if seq else 0
            next_num = last_num + 1
            sample = f"{prefix}{next_num:03d}"

            sequences.append({
                'key': key,
                'label': label,
                'prefix': prefix,
                'description': desc,
                'last_number': last_num,
                'next_number': next_num,
                'preview': sample
            })

        return Response({
            'status': 'success',
            'message': 'Numbering sequences updated successfully.',
            'year': year,
            'sequences': sequences
        })


class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        password = request.data.get('password', '')

        if not email or not password:
            return Response(
                {"detail": "Email and password are required."},
                status=status.HTTP_400_BAD_REQUEST
            )


        online_login_attempted = False
        online_error_detail = None

        if supabase_url and service_key:
            try:
                auth_url = f"{supabase_url}/auth/v1/token?grant_type=password"
                headers = {
                    "apikey": service_key,
                    "Content-Type": "application/json"
                }
                res = requests.post(auth_url, json={"email": email, "password": password}, headers=headers, timeout=8)
                online_login_attempted = True

                if res.status_code == 200:
                    data = res.json()
                    user_data = data.get('user', {}) or {}
                    user_id = user_data.get('id')
                    access_token = data.get('access_token')
                    refresh_token = data.get('refresh_token')
                    meta = user_data.get('user_metadata', {}) or {}

                    # Sync to local
                    user_obj, _ = DjangoUser.objects.update_or_create(
                        username=email,
                        defaults={'email': email}
                    )
                    user_obj.set_password(password)
                    user_obj.save()

                    # sync or Create Shop
                    shop = None
                    if user_id:
                        shop = Shop.objects.filter(supabase_user_id=user_id).first()
                    if not shop:
                        shop = Shop.objects.filter(supabase_email=email).first()

                    shop_name_val = meta.get('shop_name') or meta.get('shopName') or "My Jewellery Shop"
                    owner_name_val = meta.get('owner_name') or meta.get('ownerName') or ""
                    phone_val = meta.get('mobile_number') or meta.get('mobileNumber') or meta.get('phone') or ""

                    if shop:
                        if user_id:
                            shop.supabase_user_id = user_id
                        shop.supabase_email = email
                        if user_obj and shop.user != user_obj:
                            shop.user = user_obj
                        if not shop.name and shop_name_val:
                            shop.name = shop_name_val
                        if not shop.owner_name and owner_name_val:
                            shop.owner_name = owner_name_val
                        if not shop.phone and phone_val:
                            shop.phone = phone_val
                        shop.save()
                    else:
                        shop = Shop.objects.create(
                            user=user_obj,
                            supabase_user_id=user_id,
                            supabase_email=email,
                            name=shop_name_val,
                            owner_name=owner_name_val,
                            phone=phone_val
                        )

                    # Store/Update local license
                    try:
                        LicenseManager.store_license('offline-active-license')
                        LicenseManager.update_last_verified()
                    except Exception as e:
                        logger.warning(f"[LoginView] License store notice: {e}")

                    return Response({
                        "status": "logged_in",
                        "access_token": access_token,
                        "refresh_token": refresh_token,
                        "user": {
                            "id": user_id,
                            "email": email,
                            "is_offline": False
                        },
                        "shop": ShopSerializer(shop).data if shop else None,
                        "is_offline": False
                    })

                elif res.status_code in (400, 401, 422, 429):
                    body = {}
                    try:
                        body = res.json()
                    except:
                        pass
                    msg = body.get('error_description') or body.get('msg') or body.get('message') or body.get('detail')
                    if not msg and res.status_code in (400, 401):
                        msg = "Invalid email or password."
                    online_error_detail = (res.status_code, msg)
            except Exception as net_err:
                logger.warning(f"[LoginView] Supabase online login failed or network error: {net_err}")
                online_login_attempted = False

        if online_error_detail:
            status_code, msg = online_error_detail
            return Response({"detail": msg}, status=status_code)


        # offline checks
        user = authenticate(username=email, password=password)
        if not user:
            user_obj = DjangoUser.objects.filter(username__iexact=email).first() or DjangoUser.objects.filter(email__iexact=email).first()
            if user_obj and user_obj.check_password(password):
                user = user_obj

        if not user:
            return Response(
                {"detail": "Invalid credentials or Please connect to Internet"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        shop = Shop.objects.filter(supabase_email=email).first()
        if not shop and user:
            shop = getattr(user, 'shop', None) or Shop.objects.first()

        l_info = LicenseManager.validate_license()
        l_status = l_info.get('status', 'missing')

        if l_status not in {'active', 'grace_period'}:
            if l_status == 'force_sync_required':
                return Response(
                    {"detail": "You have not connected to the internet for over 7 days. Please connect to the internet to sign in."},
                    status=status.HTTP_403_FORBIDDEN
                )
            elif l_status == 'missing':
                return Response(
                    {"detail": "No local license found. Please connect to the internet and log in to activate offline access."},
                    status=status.HTTP_403_FORBIDDEN
                )
            else:
                return Response(
                    {"detail": f"License verification failed ({l_status}). Please connect to the internet to renew."},
                    status=status.HTTP_403_FORBIDDEN
                )

        return Response({
            "status": "offline_logged_in",
            "access_token": "offline-session-token",
            "user": {
                "id": shop.supabase_user_id if shop else None,
                "email": email,
                "is_offline": True
            },
            "shop": ShopSerializer(shop).data if shop else None,
            "is_offline": True
        })


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        password = request.data.get('password', '')
        shop_name = (request.data.get('shop_name') or request.data.get('shopName') or '').strip()
        owner_name = (request.data.get('owner_name') or request.data.get('ownerName') or '').strip()
        mobile_number = (request.data.get('mobile_number') or request.data.get('mobileNumber') or request.data.get('phone') or '').strip()

        if not email or not password or not shop_name or not owner_name or not mobile_number:
            return Response(
                {"detail": "Please fill in all mandatory"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(password) < 6:
            return Response(
                {"detail": "Password must be at least 6 characters long."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not supabase_url or not anon_key:
            return Response(
                {"detail": "Supabase service is not configured on the backend"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        signup_url = f"{supabase_url}/auth/v1/signup"
        headers = {
            "apikey": anon_key,
            "Content-Type": "application/json"
        }

        signup_payload = {
            "email": email,
            "password": password,
            "shop_name": shop_name,
            "shopName": shop_name,
            "owner_name": owner_name,
            "ownerName": owner_name,
            "mobile_number": mobile_number,
            "mobileNumber": mobile_number
        }

        try:
            res = requests.post(
                signup_url,
                json=signup_payload,
                headers=headers,
                timeout=12
            )

        except Exception as e:
            logger.error(f"[RegisterView] Connection error during signup: {e}")
            return Response(
                {"detail": "Unable to connect to registration server. Please check your internet connection."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        if res.status_code not in (200, 201):
            body = {}
            try:
                body = res.json()
            except:
                pass
            msg = body.get('error_description') or body.get('msg') or body.get('message') or body.get('detail') or "Registration failed."
            if "already registered" in msg.lower() or "user already exists" in msg.lower():
                msg = "An account with this email already exists. Try logging in."
            return Response({"detail": msg}, status=res.status_code if res.status_code < 500 else status.HTTP_400_BAD_REQUEST)

        data = res.json()

        user_data = data.get('user', {}) or {}
        user_id = user_data.get('id')

        session_data = data.get('session') or {}
        access_token = (
            data.get('access_token')
            or session_data.get('access_token')
        ) or None
        refresh_token = (
            data.get('refresh_token')
            or session_data.get('refresh_token')
        ) or None


        identities = user_data.get('identities', None)
        if identities is not None and len(identities) == 0:
            return Response(
                {"detail": "An account with this email already exists. Please log in instead."},
                status=status.HTTP_400_BAD_REQUEST
            )

        needs_confirmation = not access_token


        # saves data offline local db
        user_obj, _ = DjangoUser.objects.update_or_create(
            username=email,
            defaults={'email': email}
        )
        user_obj.set_password(password)
        user_obj.save()

        # Isolate the shop
        shop = Shop.objects.filter(supabase_user_id=user_id).first() if user_id else None
        if not shop:
            shop = Shop.objects.filter(supabase_email=email).first()

        if shop:
            if user_id:
                shop.supabase_user_id = user_id
            shop.name = shop_name
            shop.owner_name = owner_name
            shop.phone = mobile_number
            shop.supabase_email = email
            shop.user = user_obj
            shop.save()
        else:
            shop = Shop.objects.create(
                user=user_obj,
                supabase_user_id=user_id,
                supabase_email=email,
                name=shop_name,
                owner_name=owner_name,
                phone=mobile_number
            )

        # Store local offline license
        try:
            LicenseManager.store_license('offline-active-license')
            LicenseManager.update_last_verified()
        except Exception as e:
            logger.warning(f"[RegisterView] License storage notice: {e}")

        # update advance data after user creation in above
        if user_id:
            bearer_token = service_key or access_token
            api_key_header = service_key or anon_key

            if bearer_token:
                try:
                    expires_val = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
                    now_val = datetime.now(timezone.utc).isoformat()

                    prof_payload_full = {
                        'id': user_id,
                        'email': email,
                        'shop_name': shop_name,
                        'owner_name': owner_name,
                        'mobile_number': mobile_number,
                        'plan': 'free',
                        'is_active': True,
                        'expires_at': expires_val,
                        'updated_at': now_val,
                    }
                    prof_payload_patch = {
                        'email': email,
                        'shop_name': shop_name,
                        'owner_name': owner_name,
                        'mobile_number': mobile_number,
                        'plan': 'free',
                        'is_active': True,
                        'expires_at': expires_val,
                        'updated_at': now_val,
                    }

                    base_headers = {
                        'Authorization': f'Bearer {bearer_token}',
                        'apikey': api_key_header,
                        'Content-Type': 'application/json',
                    }

                    patch_res = requests.patch(
                        f"{supabase_url}/rest/v1/profiles?id=eq.{user_id}",
                        json=prof_payload_patch,
                        headers={**base_headers, 'Prefer': 'return=representation'},
                        timeout=8
                    )

                    if patch_res.status_code in (200, 204):
                        patched_rows = []
                        try:
                            patched_rows = patch_res.json() if patch_res.status_code == 200 else []
                        except Exception:
                            pass

                        if patched_rows:
                            logger.info(f"[RegisterView] Profile PATCH success for {user_id}")
                        else:
                            logger.info(f"[RegisterView] Profile PATCH matched 0 rows, trying POST upsert")
                            post_res = requests.post(
                                f"{supabase_url}/rest/v1/profiles",
                                json=prof_payload_full,
                                headers={**base_headers, 'Prefer': 'resolution=merge-duplicates,return=representation'},
                                timeout=8
                            )
                            if post_res.status_code in (200, 201):
                                logger.info(f"[RegisterView] Profile POST upsert success for {user_id}")
                            else:
                                logger.error(
                                    f"[RegisterView] Profile POST upsert failed: "
                                    f"status={post_res.status_code} body={post_res.text[:500]}"
                                )
                    else:
                        logger.error(
                            f"[RegisterView] Profile PATCH failed: "
                            f"status={patch_res.status_code} body={patch_res.text[:500]}"
                        )

                except Exception as prof_err:
                    logger.error(f"[RegisterView] Profile sync exception: {prof_err}")
            else:
                logger.warning(f"[RegisterView] No auth token available for profile sync - skipping")

        return Response({
            "status": "registered",
            "needs_email_confirmation": needs_confirmation,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "id": user_id,
                "email": email,
                "is_offline": False
            },
            "shop": ShopSerializer(shop).data if shop else None
        }, status=status.HTTP_201_CREATED)


class VerifyAdminPasswordView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        password = request.data.get('password', '')
        if not password:
            return Response({"valid": False, "detail": "Password is required."}, status=status.HTTP_400_BAD_REQUEST)

        email = (request.data.get('email') or '').strip().lower()
        shop = getattr(request, 'shop', None)

        if not email and shop:
            email = shop.supabase_email or (shop.user.email if shop.user else shop.user.username if shop.user else None)

        if not email and getattr(request, 'supabase_user', None):
            email = request.supabase_user.get('email')

        if not email:
            active_shop = Shop.objects.first()
            if active_shop:
                email = active_shop.supabase_email or (active_shop.user.email if active_shop.user else None)

        user = None
        if email:
            user = authenticate(username=email, password=password)
            if not user:
                user_obj = DjangoUser.objects.filter(username__iexact=email).first() or DjangoUser.objects.filter(email__iexact=email).first()
                if user_obj and user_obj.check_password(password):
                    user = user_obj

        if not user and shop and shop.user:
            if shop.user.check_password(password):
                user = shop.user

        if not user and not email:
            first_user = DjangoUser.objects.filter(is_superuser=True).first() or DjangoUser.objects.first()
            if first_user and first_user.check_password(password):
                user = first_user

        # Supabase online verification if email known and local check didn't match
        if not user and email:
            if supabase_url and anon_key:
                try:
                    auth_url = f"{supabase_url}/auth/v1/token?grant_type=password"
                    headers = {"apikey": anon_key, "Content-Type": "application/json"}
                    res = requests.post(auth_url, json={"email": email, "password": password}, headers=headers, timeout=3)
                    if res.status_code == 200:
                        user_obj, _ = DjangoUser.objects.update_or_create(
                            username=email,
                            defaults={'email': email}
                        )
                        user_obj.set_password(password)
                        user_obj.save()
                        if shop and shop.user != user_obj:
                            shop.user = user_obj
                            shop.save()
                        user = user_obj
                except Exception as e:
                    logger.warning(f"[VerifyAdminPassword] Supabase online check exception: {e}")

        if user:
            return Response({"valid": True, "message": "Password verified."})

        return Response({"valid": False, "detail": "Incorrect admin password."}, status=status.HTTP_403_FORBIDDEN)


class KarigarViewSet(viewsets.ModelViewSet):
    serializer_class = KarigarSerializer
    filterset_fields = ['is_active']
    search_fields = ['name', 'phone', 'specialty']

    def get_queryset(self):
        shop = self.request.shop
        if not shop:
            return Karigar.objects.none()
        return Karigar.objects.filter(shop=shop).order_by('name')

    def perform_create(self, serializer):
        serializer.save(shop=self.request.shop)

    def perform_update(self, serializer):
        serializer.save(shop=self.request.shop)

