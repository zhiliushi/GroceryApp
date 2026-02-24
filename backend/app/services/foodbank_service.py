"""
Foodbank service — manages global foodbank locations in Firestore.

- seed_malaysia(): populates initial Malaysian foodbank data
- get_all(): retrieves all foodbanks, optional country filter
- upsert(): inserts a foodbank if not duplicate (name + address)
- scrape_and_update(): scheduled task for periodic refresh
"""

import logging
import time
from typing import Optional, List, Dict, Any

from firebase_admin import firestore

logger = logging.getLogger(__name__)

COLLECTION = "foodbanks"


def _get_db():
    return firestore.client()


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def get_all(country: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get all active foodbanks, optionally filtered by country code."""
    db = _get_db()
    query = db.collection(COLLECTION)
    if country:
        query = query.where("country", "==", country.upper())

    docs = query.stream()
    results = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        if data.get("is_active", True):
            results.append(data)
    results.sort(key=lambda x: x.get("name", ""))
    return results


def get_by_id(doc_id: str) -> Optional[Dict[str, Any]]:
    """Get a single foodbank by Firestore document ID."""
    db = _get_db()
    doc = db.collection(COLLECTION).document(doc_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["id"] = doc.id
    return data


# ---------------------------------------------------------------------------
# Write (CRUD for web admin)
# ---------------------------------------------------------------------------

def create(data: Dict[str, Any]) -> str:
    """Create a new foodbank. Returns the document ID."""
    db = _get_db()
    now = time.time()
    doc_data = {
        "name": data.get("name", ""),
        "description": data.get("description"),
        "country": data.get("country", "").upper(),
        "state": data.get("state"),
        "location_name": data.get("location_name"),
        "location_address": data.get("location_address"),
        "location_link": data.get("location_link"),
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "source_url": data.get("source_url"),
        "source_name": data.get("source_name"),
        "is_active": data.get("is_active", True),
        "created_at": now,
        "updated_at": now,
    }
    _, doc_ref = db.collection(COLLECTION).add(doc_data)
    logger.info("Created foodbank %s: %s", doc_ref.id, data.get("name"))
    return doc_ref.id


def update(doc_id: str, data: Dict[str, Any]) -> bool:
    """Update foodbank fields. Returns True if found."""
    db = _get_db()
    doc_ref = db.collection(COLLECTION).document(doc_id)
    doc = doc_ref.get()
    if not doc.exists:
        return False
    data["updated_at"] = time.time()
    if "country" in data and data["country"]:
        data["country"] = data["country"].upper()
    doc_ref.update(data)
    return True


def delete(doc_id: str) -> bool:
    """Delete a foodbank permanently. Returns True if found."""
    db = _get_db()
    doc_ref = db.collection(COLLECTION).document(doc_id)
    doc = doc_ref.get()
    if not doc.exists:
        return False
    doc_ref.delete()
    logger.info("Deleted foodbank %s", doc_id)
    return True


def toggle_active(doc_id: str) -> Optional[bool]:
    """Toggle is_active. Returns new value, or None if not found."""
    db = _get_db()
    doc_ref = db.collection(COLLECTION).document(doc_id)
    doc = doc_ref.get()
    if not doc.exists:
        return None
    current = doc.to_dict().get("is_active", True)
    new_value = not current
    doc_ref.update({"is_active": new_value, "updated_at": time.time()})
    return new_value


def refresh_entry(doc_id: str) -> Optional[Dict[str, Any]]:
    """Refresh a single foodbank entry — updates last_refreshed timestamp and returns fresh data."""
    db = _get_db()
    doc_ref = db.collection(COLLECTION).document(doc_id)
    doc = doc_ref.get()
    if not doc.exists:
        return None
    doc_ref.update({"last_refreshed": time.time(), "updated_at": time.time()})
    refreshed = doc_ref.get()
    data = refreshed.to_dict()
    data["id"] = doc_ref.id
    return data


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------

def _exists(name: str, address: Optional[str]) -> bool:
    """Check if a foodbank with the same name + address already exists."""
    db = _get_db()
    query = db.collection(COLLECTION).where("name", "==", name)
    if address:
        query = query.where("location_address", "==", address)
    docs = list(query.limit(1).stream())
    return len(docs) > 0


# ---------------------------------------------------------------------------
# Upsert
# ---------------------------------------------------------------------------

def upsert(data: Dict[str, Any]) -> bool:
    """
    Insert a foodbank if no duplicate exists (name + address match).
    Returns True if inserted, False if skipped.
    """
    name = data.get("name", "")
    address = data.get("location_address")

    if _exists(name, address):
        return False

    db = _get_db()
    now = time.time()
    doc_data = {
        "name": name,
        "description": data.get("description"),
        "country": data.get("country", "").upper(),
        "state": data.get("state"),
        "location_name": data.get("location_name"),
        "location_address": address,
        "location_link": data.get("location_link"),
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "source_url": data.get("source_url"),
        "source_name": data.get("source_name"),
        "is_active": data.get("is_active", True),
        "created_at": now,
        "updated_at": now,
    }
    db.collection(COLLECTION).add(doc_data)
    return True


# ---------------------------------------------------------------------------
# Seed — Malaysia
# ---------------------------------------------------------------------------

MALAYSIA_SEED_DATA: List[Dict[str, Any]] = [
    # --- Yayasan Food Bank Malaysia (YFBM) ---
    {
        "name": "Yayasan Food Bank Malaysia (HQ)",
        "description": "National food bank foundation under Ministry of Domestic Trade",
        "country": "MY",
        "state": "Kuala Lumpur",
        "location_name": "Pusat Bandar Utara",
        "location_address": "Lot 2G-1, Wisma KPDNHEP, No. 13, Persiaran Perdana, Presint 2, 62623 Putrajaya",
        "location_link": "https://maps.app.goo.gl/YFBMputrajaya",
        "latitude": 2.9264,
        "longitude": 101.6964,
        "source_url": "https://www.yfbm.org.my",
        "source_name": "YFBM",
        "is_active": True,
    },
    {
        "name": "YFBM Penang Distribution Centre",
        "description": "Food Bank Malaysia distribution hub for northern region",
        "country": "MY",
        "state": "Penang",
        "location_name": "George Town",
        "location_address": "Wisma KPDNHEP Pulau Pinang, Jalan Burmah, 10350 George Town, Penang",
        "latitude": 5.4164,
        "longitude": 100.3327,
        "source_url": "https://www.yfbm.org.my",
        "source_name": "YFBM",
        "is_active": True,
    },
    {
        "name": "YFBM Johor Bahru Centre",
        "description": "Food Bank Malaysia distribution hub for southern region",
        "country": "MY",
        "state": "Johor",
        "location_name": "Johor Bahru",
        "location_address": "Wisma KPDNHEP Johor, Jalan Tun Abdul Razak, 80000 Johor Bahru",
        "latitude": 1.4927,
        "longitude": 103.7414,
        "source_url": "https://www.yfbm.org.my",
        "source_name": "YFBM",
        "is_active": True,
    },
    {
        "name": "YFBM Sabah Distribution Centre",
        "description": "Food Bank Malaysia distribution hub for Sabah",
        "country": "MY",
        "state": "Sabah",
        "location_name": "Kota Kinabalu",
        "location_address": "Wisma KPDNHEP Sabah, Jalan Sembulan, 88100 Kota Kinabalu, Sabah",
        "latitude": 5.9749,
        "longitude": 116.0724,
        "source_url": "https://www.yfbm.org.my",
        "source_name": "YFBM",
        "is_active": True,
    },
    {
        "name": "YFBM Sarawak Distribution Centre",
        "description": "Food Bank Malaysia distribution hub for Sarawak",
        "country": "MY",
        "state": "Sarawak",
        "location_name": "Kuching",
        "location_address": "Wisma KPDNHEP Sarawak, Jalan Tunku Abdul Rahman, 93100 Kuching, Sarawak",
        "latitude": 1.5535,
        "longitude": 110.3593,
        "source_url": "https://www.yfbm.org.my",
        "source_name": "YFBM",
        "is_active": True,
    },
    # --- Food Aid Foundation ---
    {
        "name": "Food Aid Foundation",
        "description": "Malaysia's first registered food bank. Rescues surplus food from manufacturers and distributes to welfare homes.",
        "country": "MY",
        "state": "Selangor",
        "location_name": "Puchong",
        "location_address": "No. 22, Jalan TPP 1/1, Taman Industri Puchong, 47100 Puchong, Selangor",
        "location_link": "https://maps.app.goo.gl/foodaidfoundation",
        "latitude": 3.0319,
        "longitude": 101.6168,
        "source_url": "https://www.foodaidfoundation.org",
        "source_name": "FoodAidFoundation",
        "is_active": True,
    },
    # --- The Lost Food Project ---
    {
        "name": "The Lost Food Project",
        "description": "Rescues quality surplus food from manufacturers and distributors, redistributing to those in need.",
        "country": "MY",
        "state": "Selangor",
        "location_name": "Shah Alam",
        "location_address": "No. 10, Jalan Utas 15/7, Seksyen 15, 40200 Shah Alam, Selangor",
        "location_link": "https://maps.app.goo.gl/thelostfoodproject",
        "latitude": 3.0733,
        "longitude": 101.5185,
        "source_url": "https://www.thelostfoodproject.org",
        "source_name": "TheLostFoodProject",
        "is_active": True,
    },
    # --- Kechara Soup Kitchen ---
    {
        "name": "Kechara Soup Kitchen",
        "description": "Provides free meals and food aid to the homeless and urban poor in KL.",
        "country": "MY",
        "state": "Kuala Lumpur",
        "location_name": "Bukit Bintang",
        "location_address": "37, Jalan Penghulu Haji Hashim, Off Jalan Imbi, 55100 Kuala Lumpur",
        "location_link": "https://maps.app.goo.gl/kecharasoupkitchen",
        "latitude": 3.1441,
        "longitude": 101.7085,
        "source_url": "https://www.thesoupkitchen.org.my",
        "source_name": "KecharaSoupKitchen",
        "is_active": True,
    },
    # --- Pertubuhan Tindakan Wanita Islam (PERTIWI) ---
    {
        "name": "PERTIWI Soup Kitchen",
        "description": "Provides free meals to the homeless and underprivileged around Kuala Lumpur.",
        "country": "MY",
        "state": "Kuala Lumpur",
        "location_name": "Chow Kit",
        "location_address": "Jalan Tuanku Abdul Rahman, Chow Kit, 50100 Kuala Lumpur",
        "latitude": 3.1623,
        "longitude": 101.6983,
        "source_url": "https://www.pertiwi.org.my",
        "source_name": "PERTIWI",
        "is_active": True,
    },
    # --- Gerobok Rezeki (various mosques) ---
    {
        "name": "Gerobok Rezeki — Masjid Wilayah Persekutuan",
        "description": "Community pantry at the Federal Territory Mosque. Free food for those in need.",
        "country": "MY",
        "state": "Kuala Lumpur",
        "location_name": "Jalan Duta",
        "location_address": "Masjid Wilayah Persekutuan, Jalan Duta, 50480 Kuala Lumpur",
        "latitude": 3.1750,
        "longitude": 101.6869,
        "source_name": "GerobokRezeki",
        "is_active": True,
    },
    {
        "name": "Gerobok Rezeki — Masjid Negara",
        "description": "Community pantry at the National Mosque.",
        "country": "MY",
        "state": "Kuala Lumpur",
        "location_name": "Jalan Perdana",
        "location_address": "Masjid Negara, Jalan Perdana, 50480 Kuala Lumpur",
        "latitude": 3.1416,
        "longitude": 101.6918,
        "source_name": "GerobokRezeki",
        "is_active": True,
    },
    {
        "name": "Gerobok Rezeki — Masjid Putra Putrajaya",
        "description": "Community pantry at Putra Mosque in Putrajaya.",
        "country": "MY",
        "state": "Putrajaya",
        "location_name": "Presint 1",
        "location_address": "Masjid Putra, Persiaran Persekutuan, Presint 1, 62000 Putrajaya",
        "latitude": 2.9365,
        "longitude": 101.6935,
        "source_name": "GerobokRezeki",
        "is_active": True,
    },
    # --- KitaJagaKita community pantries ---
    {
        "name": "KitaJagaKita Community Pantry — Bangsar",
        "description": "Community fridge/pantry where people can donate and take food freely.",
        "country": "MY",
        "state": "Kuala Lumpur",
        "location_name": "Bangsar",
        "location_address": "Jalan Telawi 2, Bangsar Baru, 59100 Kuala Lumpur",
        "latitude": 3.1303,
        "longitude": 101.6717,
        "source_name": "KitaJagaKita",
        "is_active": True,
    },
    {
        "name": "KitaJagaKita Community Pantry — Petaling Jaya SS2",
        "description": "Community fridge/pantry in SS2 neighbourhood.",
        "country": "MY",
        "state": "Selangor",
        "location_name": "SS2 Petaling Jaya",
        "location_address": "Jalan SS2/55, 47300 Petaling Jaya, Selangor",
        "latitude": 3.1180,
        "longitude": 101.6265,
        "source_name": "KitaJagaKita",
        "is_active": True,
    },
    {
        "name": "KitaJagaKita Community Pantry — Subang Jaya",
        "description": "Community fridge/pantry in Subang Jaya neighbourhood.",
        "country": "MY",
        "state": "Selangor",
        "location_name": "Subang Jaya",
        "location_address": "Jalan SS15/4, 47500 Subang Jaya, Selangor",
        "latitude": 3.0757,
        "longitude": 101.5862,
        "source_name": "KitaJagaKita",
        "is_active": True,
    },
    {
        "name": "KitaJagaKita Community Pantry — Kepong",
        "description": "Community fridge/pantry in Kepong area.",
        "country": "MY",
        "state": "Kuala Lumpur",
        "location_name": "Kepong",
        "location_address": "Jalan Kepong, 52100 Kuala Lumpur",
        "latitude": 3.2087,
        "longitude": 101.6364,
        "source_name": "KitaJagaKita",
        "is_active": True,
    },
    # --- Penang food banks ---
    {
        "name": "Penang Food Bank — Komtar",
        "description": "State-supported food bank operated by Penang state government.",
        "country": "MY",
        "state": "Penang",
        "location_name": "George Town",
        "location_address": "Level 4, KOMTAR, Jalan Penang, 10000 George Town, Penang",
        "latitude": 5.4141,
        "longitude": 100.3288,
        "source_name": "PenangFoodBank",
        "is_active": True,
    },
    {
        "name": "Penang Food Bank — Seberang Perai",
        "description": "Food bank serving the mainland Penang community.",
        "country": "MY",
        "state": "Penang",
        "location_name": "Butterworth",
        "location_address": "Pejabat KPDNHEP, Jalan Bagan Luar, 12000 Butterworth, Penang",
        "latitude": 5.3992,
        "longitude": 100.3646,
        "source_name": "PenangFoodBank",
        "is_active": True,
    },
    # --- Perak ---
    {
        "name": "Perak Food Bank — Ipoh",
        "description": "Community food bank in Ipoh, Perak.",
        "country": "MY",
        "state": "Perak",
        "location_name": "Ipoh",
        "location_address": "Pejabat KPDNHEP Perak, Jalan Sultan Idris Shah, 30000 Ipoh, Perak",
        "latitude": 4.5975,
        "longitude": 101.0901,
        "source_name": "YFBM",
        "is_active": True,
    },
    # --- Kelantan ---
    {
        "name": "Kelantan Food Bank — Kota Bharu",
        "description": "Community food bank serving Kelantan.",
        "country": "MY",
        "state": "Kelantan",
        "location_name": "Kota Bharu",
        "location_address": "Pejabat KPDNHEP Kelantan, Jalan Sultan Yahya Petra, 15200 Kota Bharu",
        "latitude": 6.1254,
        "longitude": 102.2381,
        "source_name": "YFBM",
        "is_active": True,
    },
    # --- Terengganu ---
    {
        "name": "Terengganu Food Bank — Kuala Terengganu",
        "description": "Community food bank serving Terengganu.",
        "country": "MY",
        "state": "Terengganu",
        "location_name": "Kuala Terengganu",
        "location_address": "Pejabat KPDNHEP Terengganu, Jalan Sultan Ismail, 20200 Kuala Terengganu",
        "latitude": 5.3117,
        "longitude": 103.1324,
        "source_name": "YFBM",
        "is_active": True,
    },
    # --- Melaka ---
    {
        "name": "Melaka Food Bank",
        "description": "Community food bank serving Melaka.",
        "country": "MY",
        "state": "Melaka",
        "location_name": "Melaka City",
        "location_address": "Pejabat KPDNHEP Melaka, Jalan Hang Tuah, 75300 Melaka",
        "latitude": 2.1896,
        "longitude": 102.2501,
        "source_name": "YFBM",
        "is_active": True,
    },
    # --- Negeri Sembilan ---
    {
        "name": "Negeri Sembilan Food Bank — Seremban",
        "description": "Community food bank serving Negeri Sembilan.",
        "country": "MY",
        "state": "Negeri Sembilan",
        "location_name": "Seremban",
        "location_address": "Pejabat KPDNHEP Negeri Sembilan, Jalan Dato' Sheikh Ahmad, 70000 Seremban",
        "latitude": 2.7258,
        "longitude": 101.9424,
        "source_name": "YFBM",
        "is_active": True,
    },
    # --- Pahang ---
    {
        "name": "Pahang Food Bank — Kuantan",
        "description": "Community food bank serving Pahang.",
        "country": "MY",
        "state": "Pahang",
        "location_name": "Kuantan",
        "location_address": "Pejabat KPDNHEP Pahang, Jalan Gambut, 25000 Kuantan, Pahang",
        "latitude": 3.8077,
        "longitude": 103.3260,
        "source_name": "YFBM",
        "is_active": True,
    },
    # --- Kedah ---
    {
        "name": "Kedah Food Bank — Alor Setar",
        "description": "Community food bank serving Kedah.",
        "country": "MY",
        "state": "Kedah",
        "location_name": "Alor Setar",
        "location_address": "Pejabat KPDNHEP Kedah, Jalan Putra, 05600 Alor Setar, Kedah",
        "latitude": 6.1184,
        "longitude": 100.3685,
        "source_name": "YFBM",
        "is_active": True,
    },
]


def seed_malaysia() -> tuple[int, int]:
    """
    Seed Malaysian foodbank data. Returns (inserted, skipped).
    Deduplicates by name + address.
    """
    inserted = 0
    skipped = 0

    for entry in MALAYSIA_SEED_DATA:
        if upsert(entry):
            inserted += 1
        else:
            skipped += 1

    logger.info("Malaysia seed complete: %d inserted, %d skipped", inserted, skipped)
    return inserted, skipped


# ---------------------------------------------------------------------------
# Scheduled scrape — iterates sources, skips cooldown/disabled
# ---------------------------------------------------------------------------

def scrape_and_update() -> int:
    """
    Scheduled task: iterate all healthy sources and attempt fetch.
    Sources in cooldown or disabled are skipped.
    Returns total entries refreshed.
    """
    from app.services import foodbank_sources

    sources = foodbank_sources.list_sources()
    total = 0

    for source in sources:
        if source.get("status") == "disabled":
            continue
        if foodbank_sources.is_in_cooldown(source):
            continue
        result = foodbank_sources.fetch_source(source["id"])
        total += result.get("new_count", 0)

    logger.info("Foodbank scrape_and_update: %d entries refreshed.", total)
    return total
