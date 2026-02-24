"""Pydantic schemas for web dashboard endpoints."""

from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class DashboardStats(BaseModel):
    total_users: int = 0
    total_items: int = 0
    active_items: int = 0
    expired_items: int = 0
    needs_review_count: int = 0
    total_foodbanks: int = 0
    contributed_pending: int = 0


class PaginatedResponse(BaseModel):
    count: int
    items: List[Dict[str, Any]]
    limit: int
    offset: int


class ContributedProductResponse(BaseModel):
    barcode: str
    product_name: Optional[str] = None
    brands: Optional[str] = None
    categories: Optional[str] = None
    image_url: Optional[str] = None
    contributed_by: Optional[str] = None
    contributed_at: Optional[float] = None
    status: str = "pending_review"


class ReviewActionResponse(BaseModel):
    success: bool
    message: str
