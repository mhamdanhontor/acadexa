"""Fake WhatsApp provider — used for local development and automated tests.

Never sends a real message. Logs the message and always succeeds
(unless the message body contains the literal marker "FORCE_FAIL", which
tests can use to simulate provider failure).
"""
import logging
import uuid

from app.services.whatsapp.base import WhatsAppProvider, WhatsAppSendResult

logger = logging.getLogger("acadexa.whatsapp.fake")


class FakeWhatsAppProvider(WhatsAppProvider):
    def send_message(self, to: str, message: str) -> WhatsAppSendResult:
        if "FORCE_FAIL" in message:
            logger.warning("FakeWhatsAppProvider simulated failure for %s", to)
            return WhatsAppSendResult(success=False, error="Simulated provider failure")

        fake_id = f"fake-{uuid.uuid4().hex[:12]}"
        logger.info("FakeWhatsAppProvider sent message to %s: %s (id=%s)", to, message, fake_id)
        return WhatsAppSendResult(success=True, provider_message_id=fake_id)
