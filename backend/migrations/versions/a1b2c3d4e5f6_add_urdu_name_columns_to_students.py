"""add_urdu_name_columns_to_students

Revision ID: a1b2c3d4e5f6
Revises: 6410a04cc3d0
Create Date: 2026-09-21 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '6410a04cc3d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS name_ur VARCHAR(150)")
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_name_ur VARCHAR(150)")


def downgrade() -> None:
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS name_ur")
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS guardian_name_ur")
