"""Pagination helpers using efficient SQL LIMIT/OFFSET + COUNT."""
import math

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session


def paginate(db: Session, stmt: Select, page: int = 1, page_size: int = 20):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 500)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_count = db.execute(count_stmt).scalar_one()

    offset = (page - 1) * page_size
    paged_stmt = stmt.offset(offset).limit(page_size)
    items = db.execute(paged_stmt).unique().scalars().all()

    total_pages = max(math.ceil(total_count / page_size), 1) if total_count else 1

    return items, total_count, total_pages
