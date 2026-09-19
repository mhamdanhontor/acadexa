"""Provider factory — selects the active WhatsApp provider implementation based on config."""
from functools import lru_cache

from app.core.config import settings
from app.services.whatsapp.base import WhatsAppProvider
from app.services.whatsapp.fake_provider import FakeWhatsAppProvider
from app.services.whatsapp.meta_cloud_provider import MetaCloudWhatsAppProvider


@lru_cache
def get_whatsapp_provider() -> WhatsAppProvider:
    provider_name = settings.WHATSAPP_PROVIDER.lower()
    if provider_name == "meta_cloud":
        return MetaCloudWhatsAppProvider()
    # Default to fake provider — safe for dev/tests, never sends real messages.
    return FakeWhatsAppProvider()
