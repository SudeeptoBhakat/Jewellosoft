import logging
import urllib.parse
from django.utils import timezone
from apps.marketing.models import WhatsAppSession, MarketingCampaign, MessageLog

logger = logging.getLogger("jewellosoft.marketing")


class WhatsAppService:
    @staticmethod
    def format_phone(phone_raw: str, default_country_code: str = "91") -> str:
        if not phone_raw:
            return ""
        digits = "".join(filter(str.isdigit, str(phone_raw)))
        if len(digits) == 10:
            digits = f"{default_country_code}{digits}"
        elif len(digits) == 11 and digits.startswith("0"):
            digits = f"{default_country_code}{digits[1:]}"
        return digits

    @staticmethod
    def interpolate_text(text: str, customer, shop) -> str:
        if not text:
            return ""

        replacements = {
            "{name}": getattr(customer, "name", "") if customer else "Valued Customer",
            "{phone}": getattr(customer, "phone", "") if customer else "",
            "{customer_code}": getattr(customer, "customer_code", "") if customer else "",
            "{shop_name}": getattr(shop, "name", "Our Jewellery Store") if shop else "Our Jewellery Store",
            "{shop_phone}": getattr(shop, "phone", "") if shop else "",
            "{owner_name}": getattr(shop, "owner_name", "") if shop else "",
            "{total_spent}": f"₹{getattr(customer, 'total_spent', 0):,}" if customer and hasattr(customer, "total_spent") and customer.total_spent else "",
        }

        output = text
        for tag, val in replacements.items():
            output = output.replace(tag, str(val))
        return output

    @classmethod
    def get_or_create_session(cls, shop):
        session, _ = WhatsAppSession.objects.get_or_create(
            shop=shop,
            defaults={
                "instance_id": f"shop_{shop.id}",
                "status": "connected",
                "profile_name": shop.name or "JewelloSoft Client",
                "phone_number": shop.phone or "",
            },
        )
        return session

    @classmethod
    def generate_whatsapp_url(cls, phone: str, text: str, client_type: str = "web") -> str:
        formatted_phone = cls.format_phone(phone)
        encoded_text = urllib.parse.quote(text or "")
        if client_type == "app":
            return f"whatsapp://send?phone={formatted_phone}&text={encoded_text}"
        return f"https://web.whatsapp.com/send?phone={formatted_phone}&text={encoded_text}"

    @classmethod
    def log_message(cls, shop, customer, phone, text):
        formatted_phone = cls.format_phone(phone)
        final_text = cls.interpolate_text(text, customer, shop)

        log_entry = MessageLog.objects.create(
            shop=shop,
            customer=customer if hasattr(customer, "id") else None,
            recipient_name=getattr(customer, "name", "Customer") if customer else "Customer",
            phone=formatted_phone,
            status="sent",
            sent_at=timezone.now(),
        )

        return {
            "success": True,
            "message_id": log_entry.id,
            "recipient": formatted_phone,
            "text": final_text,
            "web_url": cls.generate_whatsapp_url(formatted_phone, final_text, "web"),
            "app_url": cls.generate_whatsapp_url(formatted_phone, final_text, "app"),
        }
