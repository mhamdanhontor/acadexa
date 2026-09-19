"""Audit logging service — used by other services to record important actions."""
import json
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def record_audit(
    db: Session,
    user_id: Optional[int],
    action: str,
    entity: str,
    entity_id: Optional[int] = None,
    description: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    flush: bool = True,
) -> AuditLog:
    """Create an AuditLog row. Does NOT commit — caller controls the transaction boundary
    (so the audit record can be part of the same transaction as the business change).
    """
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        description=description,
        metadata_json=json.dumps(metadata) if metadata else None,
        ip_address=ip_address,
    )
    db.add(log)
    if flush:
        db.flush()
    return log
