from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, Dict, Any


# ---------------------------------------------------------------------------
# Barcode Scan
# ---------------------------------------------------------------------------

class BarcodeScanRequest(BaseModel):
    barcode: str
    user_id: Optional[str] = None

    @field_validator("barcode")
    @classmethod
    def barcode_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Barcode must not be empty")
        return v


class BarcodeProduct(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    barcode: str
    product_name: Optional[str] = Field(None, alias="productName")
    brands: Optional[str] = None
    categories: Optional[str] = None
    image_url: Optional[str] = Field(None, alias="imageUrl")
    nutrition_data: Optional[Dict[str, Any]] = Field(None, alias="nutritionData")
    found: bool = False
    source: str = "not_found"


# ---------------------------------------------------------------------------
# Barcode Contribute
# ---------------------------------------------------------------------------

class BarcodeContributeRequest(BaseModel):
    barcode: str
    name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    contributed_by: Optional[str] = None

    @field_validator("barcode")
    @classmethod
    def barcode_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Barcode must not be empty")
        return v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Product name must be at least 2 characters")
        return v


class BarcodeContributeResponse(BaseModel):
    success: bool
    message: str
