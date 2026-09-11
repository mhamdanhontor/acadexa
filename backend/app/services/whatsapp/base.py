"""WhatsApp provider interface.

All WhatsApp integrations must implement this interface so the rest of the
application (attendance, marks, reports) never depends on a specific vendor.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class WhatsAppSendResult:
    success: bool
    provider_message_id: str | None = None
    error: str | None = None


class WhatsAppProvider(ABC):
    @abstractmethod
    def send_message(self, to: str, message: str) -> WhatsAppSendResult:
        """Send a WhatsApp text message. Must never raise — return a failed result instead."""
        raise NotImplementedError
