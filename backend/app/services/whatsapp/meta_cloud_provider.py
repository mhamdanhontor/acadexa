"""Meta WhatsApp Cloud API provider implementation.

This is a real, swappable implementation of WhatsAppProvider using the
official Meta WhatsApp Cloud API (https://developers.facebook.com/docs/whatsapp/cloud-api).

It requires WHATSAPP_API_URL, WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID
to be configured. Credentials are read from server-side settings only —
never exposed to the frontend.
"""
import logging

import httpx

from app.core.config import settings
from app.services.whatsapp.base import WhatsAppProvider, WhatsAppSendResult

logger = logging.getLogger("acadexa.whatsapp.meta")


class MetaCloudWhatsAppProvider(WhatsAppProvider):
    def send_message(self, to: str, message: str) -> WhatsAppSendResult:
        if not settings.WHATSAPP_API_URL or not settings.WHATSAPP_API_TOKEN:
            return WhatsAppSendResult(success=False, error="WhatsApp provider is not configured.")

        url = f"{settings.WHATSAPP_API_URL}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
        headers = {
            "Authorization": f"Bearer {settings.WHATSAPP_API_TOKEN}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": to.lstrip("+"),
            "type": "text",
            "text": {"body": message},
        }
        try:
            with httpx.Client(timeout=15.0) as client:
                response = client.post(url, json=payload, headers=headers)
            if response.status_code >= 400:
                logger.error("WhatsApp send failed (%s): %s", response.status_code, response.text)
                return WhatsAppSendResult(success=False, error=f"Provider error {response.status_code}")

            data = response.json()
            message_id = None
            if data.get("messages"):
                message_id = data["messages"][0].get("id")
            return WhatsAppSendResult(success=True, provider_message_id=message_id)
        except httpx.HTTPError as exc:
            logger.error("WhatsApp send exception: %s", exc)
            return WhatsAppSendResult(success=False, error="Network error contacting WhatsApp provider")
