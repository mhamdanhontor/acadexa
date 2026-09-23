"""add_fee_receipt_to_notification_type

Revision ID: 6410a04cc3d0
Revises: 3273b7f08a70
Create Date: 2026-09-20 17:53:54.162596

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6410a04cc3d0'
down_revision: Union[str, None] = '3273b7f08a70'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'FEE_RECEIPT'")


def downgrade() -> None:
    pass
