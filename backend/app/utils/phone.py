"""Phone number and WhatsApp URL utilities."""
import re
import urllib.parse
from typing import Dict


def clean_phone_number(raw_phone: str, default_country_code: str = "92") -> str:
    """Sanitize phone number to international E.164 digits without symbols.

    - Strips spaces, dashes, parentheses, plus sign.
    - If number starts with 0 (e.g. local 03221742520), replaces leading 0 with default country code.
    - If number starts with 00, removes leading 00.
    """
    if not raw_phone:
        return ""

    # Keep only digits
    digits = re.sub(r"\D", "", str(raw_phone))

    if digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) >= 10:
        digits = default_country_code + digits[1:]

    return digits


def build_whatsapp_urls(raw_phone: str, text: str, default_country_code: str = "92") -> Dict[str, str]:
    """Build WhatsApp Web, WhatsApp Desktop App, and Universal wa.me links."""
    clean_phone = clean_phone_number(raw_phone, default_country_code)
    encoded_text = urllib.parse.quote(text or "")

    return {
        "clean_phone": clean_phone,
        "web_url": f"https://web.whatsapp.com/send?phone={clean_phone}&text={encoded_text}",
        "app_url": f"whatsapp://send?phone={clean_phone}&text={encoded_text}",
        "universal_url": f"https://wa.me/{clean_phone}?text={encoded_text}",
    }
