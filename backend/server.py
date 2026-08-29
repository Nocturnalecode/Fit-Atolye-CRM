"""FitAtölye CRM - Main FastAPI server."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import io
import uuid
import logging
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user_factory, require_admin,
)

# --- DB ---
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="FitAtölye CRM API")
api = APIRouter(prefix="/api")

get_current_user = None  # set at startup


async def current_user_dep(request: Request):
    return await get_current_user(request)


# --- Helpers ---
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def clean(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


def to_date(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


# --- Models ---
class LoginBody(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "consultant"  # admin | consultant


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    password: Optional[str] = None


class PersonCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    instagram: Optional[str] = None
    source_id: str
    assigned_to: Optional[str] = None
    request_date: str
    sales_stage_id: Optional[str] = None
    priority: str = "normal"
    tags: List[str] = []
    next_followup_date: Optional[str] = None
    last_note: Optional[str] = None
    birth_date: Optional[str] = None
    force: bool = False


class PersonUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    instagram: Optional[str] = None
    source_id: Optional[str] = None
    assigned_to: Optional[str] = None
    sales_stage_id: Optional[str] = None
    response_category_id: Optional[str] = None
    negative_reason_id: Optional[str] = None
    priority: Optional[str] = None
    tags: Optional[List[str]] = None
    next_followup_date: Optional[str] = None
    last_note: Optional[str] = None
    birth_date: Optional[str] = None
    archived: Optional[bool] = None


class BulkAssign(BaseModel):
    person_ids: List[str]
    assigned_to: str


class ContactCreate(BaseModel):
    person_id: str
    date: Optional[str] = None
    channel: str  # Telefon | WhatsApp | Instagram DM | Diğer
    response_category_id: Optional[str] = None
    note: str = ""
    next_followup_date: Optional[str] = None
    task_result: Optional[str] = None
    audio_url: Optional[str] = None
    screenshot_url: Optional[str] = None


class TaskCreate(BaseModel):
    person_id: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: str
    type: str = "manual"
    title: str


class TaskUpdate(BaseModel):
    done: Optional[bool] = None
    due_date: Optional[str] = None
    title: Optional[str] = None


class AppointmentCreate(BaseModel):
    person_id: str
    date: str
    duration_min: int = 30
    status: str = "Planlandı"
    note: Optional[str] = None
    type: str = "İlk görüşme"


class AppointmentUpdate(BaseModel):
    date: Optional[str] = None
    status: Optional[str] = None
    note: Optional[str] = None
    duration_min: Optional[int] = None


class ConvertBody(BaseModel):
    start_date: str
    monthly_fee: float
    payment_method: str  # Havale/EFT | Kredi kartı
    payment_plan: str    # peşin | 1w | 2w | 3w | 4w
    first_payment_amount: Optional[float] = None


class MembershipCreate(BaseModel):
    person_id: str
    start_date: str
    monthly_fee: float
    payment_method: str
    payment_plan: str


class MembershipUpdate(BaseModel):
    status: Optional[str] = None
    end_date: Optional[str] = None
    monthly_fee: Optional[float] = None
    days_used: Optional[int] = None
    freeze_days: Optional[int] = None


class PaymentCreate(BaseModel):
    person_id: str
    membership_id: Optional[str] = None
    amount: float
    due_date: str
    paid_date: Optional[str] = None
    method: str
    status: str = "Bekliyor"
    note: Optional[str] = None


class PaymentUpdate(BaseModel):
    amount: Optional[float] = None
    paid_date: Optional[str] = None
    status: Optional[str] = None
    method: Optional[str] = None
    note: Optional[str] = None


class MeasurementCreate(BaseModel):
    person_id: str
    date: str
    weight: Optional[float] = None
    bmi: Optional[float] = None
    body_fat: Optional[float] = None
    trunk_fat: Optional[float] = None
    water: Optional[float] = None
    muscle: Optional[float] = None
    health_age: Optional[float] = None
    visceral_fat: Optional[float] = None
    chest: Optional[float] = None
    waist: Optional[float] = None
    belly: Optional[float] = None
    span: Optional[float] = None
    neck: Optional[float] = None
    right_arm: Optional[float] = None
    left_arm: Optional[float] = None
    right_leg: Optional[float] = None
    left_leg: Optional[float] = None
    note: Optional[str] = None


class ProductCreate(BaseModel):
    name: str
    price: float
    active: bool = True


class ProductSaleCreate(BaseModel):
    person_id: str
    product_id: str
    qty: int = 1
    unit_price: float
    sale_date: str
    method: str
    status: str = "Ödendi"
    note: Optional[str] = None


class SimpleName(BaseModel):
    name: str
    active: bool = True


class StageBody(BaseModel):
    name: str
    order: Optional[int] = None
    active: bool = True


class ResponseCatBody(BaseModel):
    name: str
    active: bool = True
    auto_task_days: Optional[int] = None
    auto_enabled: bool = False


class TargetBody(BaseModel):
    user_id: str
    year: int
    month: int
    new_leads: int = 0
    calls: int = 0
    appointments: int = 0
    new_memberships: int = 0
    renewals: int = 0
    ontime_tasks: int = 0


class SettingsBody(BaseModel):
    auto_enabled: bool = True
    days_unreachable: int = 1
    days_thinking: int = 3
    days_no_show: int = 0
    renewal_task_days: int = 7
    renewal_reminder_days: int = 3


# --- Auth routes ---
@api.post("/auth/login")
async def login(body: LoginBody, request: Request):
    email = body.email.lower()
    ident = f"{request.client.host}:{email}"
    now = datetime.now(timezone.utc)
    attempt = await db.login_attempts.find_one({"identifier": ident})
    if attempt and attempt.get("locked_until"):
        lu = to_date(attempt["locked_until"])
        if lu and lu > now:
            raise HTTPException(status_code=429, detail="Çok fazla hatalı deneme. Lütfen daha sonra tekrar deneyin.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        count = (attempt.get("count", 0) if attempt else 0) + 1
        upd = {"identifier": ident, "count": count, "last_attempt": now.isoformat()}
        if count >= 5:
            upd["locked_until"] = (now + timedelta(minutes=15)).isoformat()
            upd["count"] = 0
        await db.login_attempts.update_one({"identifier": ident}, {"$set": upd}, upsert=True)
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Hesabınız pasif durumda")
    await db.login_attempts.delete_one({"identifier": ident})
    token = create_access_token(user["id"], user["email"], user["role"])
    return {
        "token": token,
        "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}
    }


@api.post("/auth/logout")
async def logout(response: Response, current=Depends(current_user_dep)):
    response.delete_cookie("access_token")
    return {"ok": True}


@api.get("/auth/me")
async def me(current=Depends(current_user_dep)):
    return current


@api.post("/auth/change-password")
async def change_password(body: ChangePasswordBody, current=Depends(current_user_dep)):
    user = await db.users.find_one({"id": current["id"]})
    if not user or not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Mevcut şifre hatalı")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Yeni şifre en az 6 karakter olmalı")
    await db.users.update_one({"id": current["id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}


# --- Users ---
@api.get("/users")
async def list_users(current=Depends(current_user_dep)):
    users = await db.users.find({}, {"password_hash": 0, "_id": 0}).to_list(1000)
    return users


@api.post("/users")
async def create_user(body: UserCreate, current=Depends(current_user_dep)):
    require_admin(current)
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Bu e-posta zaten kayıtlı")
    user = {
        "id": new_id(),
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": body.role,
        "active": True,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    user.pop("password_hash")
    user.pop("_id", None)
    return user


@api.patch("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, current=Depends(current_user_dep)):
    require_admin(current)
    upd = {k: v for k, v in body.model_dump().items() if v is not None and k != "password"}
    if body.password:
        upd["password_hash"] = hash_password(body.password)
    if upd:
        await db.users.update_one({"id": user_id}, {"$set": upd})
    user = await db.users.find_one({"id": user_id}, {"password_hash": 0, "_id": 0})
    return user


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, current=Depends(current_user_dep)):
    require_admin(current)
    if user_id == current["id"]:
        raise HTTPException(400, "Kendi hesabınızı silemezsiniz")
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "Kullanıcı bulunamadı")
    # Unassign persons owned by this user (data korunur, atama düşer)
    await db.persons.update_many({"assigned_to": user_id}, {"$set": {"assigned_to": None}})
    await db.tasks.update_many({"assigned_to": user_id}, {"$set": {"assigned_to": None}})
    await db.appointments.update_many({"assigned_to": user_id}, {"$set": {"assigned_to": None}})
    await db.users.delete_one({"id": user_id})
    return {"ok": True}


# --- Reference data (sources, stages, response categories, tags, negative reasons) ---
def _ref_collection(kind: str):
    mapping = {
        "sources": db.sources,
        "stages": db.sales_stages,
        "response_categories": db.response_categories,
        "tags": db.tags,
        "negative_reasons": db.negative_reasons,
    }
    if kind not in mapping:
        raise HTTPException(status_code=404, detail="Geçersiz referans türü")
    return mapping[kind]


@api.get("/ref/{kind}")
async def list_ref(kind: str, current=Depends(current_user_dep)):
    col = _ref_collection(kind)
    items = await col.find({}, {"_id": 0}).to_list(1000)
    items.sort(key=lambda x: x.get("order", 999))
    return items


@api.post("/ref/{kind}")
async def create_ref(kind: str, body: Dict[str, Any], current=Depends(current_user_dep)):
    require_admin(current)
    col = _ref_collection(kind)
    doc = {"active": True, **body}
    # If caller supplied an id (e.g. restore/undo), keep it; otherwise generate
    if not doc.get("id"):
        doc["id"] = new_id()
    else:
        # Prevent duplicate id
        existing = await col.find_one({"id": doc["id"]})
        if existing:
            raise HTTPException(400, "Aynı ID zaten mevcut")
    if kind == "stages" and "order" not in body:
        doc["order"] = await col.count_documents({}) + 1
    await col.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/ref/{kind}/{item_id}/usage")
async def ref_usage(kind: str, item_id: str, current=Depends(current_user_dep)):
    require_admin(current)
    _ref_collection(kind)  # validates kind
    total = 0
    breakdown: Dict[str, int] = {}
    if kind == "sources":
        n = await db.persons.count_documents({"source_id": item_id}); breakdown["persons"] = n; total += n
    elif kind == "stages":
        n = await db.persons.count_documents({"sales_stage_id": item_id}); breakdown["persons"] = n; total += n
    elif kind == "response_categories":
        n1 = await db.persons.count_documents({"response_category_id": item_id})
        n2 = await db.contacts.count_documents({"response_category_id": item_id})
        breakdown["persons"] = n1; breakdown["contacts"] = n2; total = n1 + n2
    elif kind == "negative_reasons":
        n = await db.persons.count_documents({"negative_reason_id": item_id}); breakdown["persons"] = n; total += n
    elif kind == "tags":
        n = await db.persons.count_documents({"tags": item_id}); breakdown["persons"] = n; total += n
    return {"total": total, "breakdown": breakdown}


@api.patch("/ref/{kind}/{item_id}")
async def update_ref(kind: str, item_id: str, body: Dict[str, Any], current=Depends(current_user_dep)):
    require_admin(current)
    col = _ref_collection(kind)
    body.pop("id", None)
    await col.update_one({"id": item_id}, {"$set": body})
    doc = await col.find_one({"id": item_id}, {"_id": 0})
    return doc


@api.delete("/ref/{kind}/{item_id}")
async def delete_ref(kind: str, item_id: str, current=Depends(current_user_dep)):
    require_admin(current)
    col = _ref_collection(kind)
    r = await col.delete_one({"id": item_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Kayıt bulunamadı")
    return {"ok": True}


# --- Duplicate check ---
async def check_duplicate(phone: Optional[str], instagram: Optional[str]) -> Optional[dict]:
    q = []
    if phone:
        q.append({"phone": phone})
    if instagram:
        q.append({"instagram": instagram})
    if not q:
        return None
    existing = await db.persons.find_one({"$or": q}, {"_id": 0})
    return existing


# --- Persons (leads / customers / graduates) ---
def _filter_for_user(current: dict) -> dict:
    if current.get("role") == "admin":
        return {}
    return {"assigned_to": current["id"]}


@api.get("/persons")
async def list_persons(
    lifecycle: Optional[str] = None,
    assigned_to: Optional[str] = None,
    unassigned: Optional[bool] = None,
    source_id: Optional[str] = None,
    stage_id: Optional[str] = None,
    priority: Optional[str] = None,
    tag: Optional[str] = None,
    archived: Optional[bool] = None,
    q: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    next_followup_from: Optional[str] = None,
    next_followup_to: Optional[str] = None,
    current=Depends(current_user_dep),
):
    filt: dict = _filter_for_user(current)
    if lifecycle:
        filt["lifecycle_status"] = lifecycle
    if unassigned:
        filt["assigned_to"] = None
    elif assigned_to:
        filt["assigned_to"] = assigned_to
    if source_id:
        filt["source_id"] = source_id
    if stage_id:
        filt["sales_stage_id"] = stage_id
    if priority:
        filt["priority"] = priority
    if tag:
        filt["tags"] = tag
    if archived is not None:
        filt["archived"] = archived
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"instagram": {"$regex": q, "$options": "i"}},
        ]
    if date_from or date_to:
        rng = {}
        if date_from: rng["$gte"] = date_from
        if date_to: rng["$lte"] = date_to
        filt["request_date"] = rng
    if next_followup_from or next_followup_to:
        rng = {}
        if next_followup_from: rng["$gte"] = next_followup_from
        if next_followup_to: rng["$lte"] = next_followup_to
        filt["next_followup_date"] = rng
    docs = await db.persons.find(filt, {"_id": 0}).sort("updated_at", -1).to_list(2000)
    return docs


@api.get("/persons/{pid}")
async def get_person(pid: str, current=Depends(current_user_dep)):
    p = await db.persons.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Kayıt bulunamadı")
    if current.get("role") != "admin" and p.get("assigned_to") != current["id"]:
        raise HTTPException(403, "Bu kayda erişim yetkiniz yok")
    return p


@api.post("/persons")
async def create_person(body: PersonCreate, current=Depends(current_user_dep)):
    if not body.phone and not body.instagram:
        raise HTTPException(400, "Telefon veya Instagram alanlarından en az biri zorunludur")
    dup = await check_duplicate(body.phone, body.instagram)
    if dup and not body.force:
        return {"duplicate": True, "existing": dup}
    if dup and body.force and current.get("role") != "admin":
        raise HTTPException(403, "Sadece yönetici mükerrer kayıt oluşturabilir")
    assigned = body.assigned_to or (current["id"] if current["role"] == "consultant" else None)
    stages = await db.sales_stages.find({"active": True}).sort("order", 1).to_list(20)
    default_stage = body.sales_stage_id or (stages[0]["id"] if stages else None)
    p = {
        "id": new_id(),
        "name": body.name,
        "phone": body.phone,
        "instagram": body.instagram,
        "source_id": body.source_id,
        "assigned_to": assigned,
        "request_date": body.request_date,
        "sales_stage_id": default_stage,
        "response_category_id": None,
        "negative_reason_id": None,
        "priority": body.priority,
        "tags": body.tags,
        "next_followup_date": body.next_followup_date,
        "last_note": body.last_note,
        "birth_date": body.birth_date,
        "lifecycle_status": "lead",
        "archived": False,
        "updated_at": now_iso(),
        "updated_by": current["name"],
        "created_at": now_iso(),
    }
    await db.persons.insert_one(p)
    p.pop("_id", None)
    return p


@api.patch("/persons/{pid}")
async def update_person(pid: str, body: PersonUpdate, current=Depends(current_user_dep)):
    p = await db.persons.find_one({"id": pid})
    if not p:
        raise HTTPException(404, "Kayıt bulunamadı")
    if current.get("role") != "admin":
        if p.get("assigned_to") != current["id"]:
            raise HTTPException(403, "Yetki yok")
        # consultants cannot reassign
        if body.assigned_to and body.assigned_to != p.get("assigned_to"):
            raise HTTPException(403, "Beslenme koçu atamayı değiştiremez")
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    upd["updated_at"] = now_iso()
    upd["updated_by"] = current["name"]
    # if reactivating from archived
    if body.archived is False and p.get("archived"):
        if p.get("assigned_to"):
            u = await db.users.find_one({"id": p["assigned_to"]})
            if not u or not u.get("active"):
                upd["assigned_to"] = None
    await db.persons.update_one({"id": pid}, {"$set": upd})
    return await db.persons.find_one({"id": pid}, {"_id": 0})


@api.post("/persons/bulk-assign")
async def bulk_assign(body: BulkAssign, current=Depends(current_user_dep)):
    require_admin(current)
    await db.persons.update_many(
        {"id": {"$in": body.person_ids}},
        {"$set": {"assigned_to": body.assigned_to, "updated_at": now_iso(), "updated_by": current["name"]}},
    )
    return {"updated": len(body.person_ids)}


@api.post("/persons/{pid}/convert")
async def convert_to_customer(pid: str, body: ConvertBody, current=Depends(current_user_dep)):
    p = await db.persons.find_one({"id": pid})
    if not p:
        raise HTTPException(404, "Kayıt bulunamadı")
    if current["role"] != "admin" and p.get("assigned_to") != current["id"]:
        raise HTTPException(403, "Yetki yok")
    start = to_date(body.start_date) or datetime.now(timezone.utc)
    end = start + timedelta(days=30)
    membership = {
        "id": new_id(),
        "person_id": pid,
        "start_date": body.start_date,
        "end_date": end.date().isoformat(),
        "monthly_fee": body.monthly_fee,
        "payment_method": body.payment_method,
        "payment_plan": body.payment_plan,
        "status": "Aktif",
        "days_used": 0,
        "freeze_days": 0,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "updated_by": current["name"],
    }
    await db.memberships.insert_one(membership)
    # Payments per plan
    plan = body.payment_plan
    weeks = {"peşin": 0, "1w": 1, "2w": 2, "3w": 3, "4w": 4}.get(plan, 0)
    if weeks == 0:
        pay = {
            "id": new_id(), "person_id": pid, "membership_id": membership["id"],
            "amount": body.monthly_fee, "due_date": body.start_date, "paid_date": body.start_date,
            "method": body.payment_method, "status": "Ödendi", "note": "Peşin",
            "kind": "membership", "created_at": now_iso(),
        }
        await db.payments.insert_one(pay)
    else:
        per = round(body.monthly_fee / weeks, 2)
        for i in range(weeks):
            due = (start + timedelta(days=7 * i)).date().isoformat()
            status = "Ödendi" if i == 0 else "Bekliyor"
            paid = body.start_date if i == 0 else None
            pay = {
                "id": new_id(), "person_id": pid, "membership_id": membership["id"],
                "amount": per, "due_date": due, "paid_date": paid,
                "method": body.payment_method, "status": status, "note": f"Taksit {i+1}/{weeks}",
                "kind": "membership", "created_at": now_iso(),
            }
            await db.payments.insert_one(pay)
    await db.persons.update_one({"id": pid}, {"$set": {
        "lifecycle_status": "customer",
        "customer_since": body.start_date,
        "updated_at": now_iso(),
        "updated_by": current["name"],
    }})
    membership.pop("_id", None)
    return membership


# --- Contact history ---
@api.get("/contacts")
async def list_contacts(person_id: str, current=Depends(current_user_dep)):
    await get_person(person_id, current)
    items = await db.contacts.find({"person_id": person_id}, {"_id": 0}).sort("date", -1).to_list(500)
    return items


@api.post("/contacts")
async def create_contact(body: ContactCreate, current=Depends(current_user_dep)):
    p = await get_person(body.person_id, current)
    contact = {
        "id": new_id(),
        "person_id": body.person_id,
        "date": body.date or now_iso(),
        "user_id": current["id"],
        "user_name": current["name"],
        "channel": body.channel,
        "response_category_id": body.response_category_id,
        "note": body.note,
        "next_followup_date": body.next_followup_date,
        "task_result": body.task_result,
        "audio_url": body.audio_url,
        "screenshot_url": body.screenshot_url,
    }
    await db.contacts.insert_one(contact)
    # Update person
    updates = {"updated_at": now_iso(), "updated_by": current["name"], "last_note": body.note}
    if body.response_category_id:
        updates["response_category_id"] = body.response_category_id
    if body.next_followup_date:
        updates["next_followup_date"] = body.next_followup_date
    await db.persons.update_one({"id": body.person_id}, {"$set": updates})
    # Auto follow-up task based on category
    if body.response_category_id:
        cat = await db.response_categories.find_one({"id": body.response_category_id})
        settings = await db.settings.find_one({"id": "global"}) or {}
        if cat and cat.get("auto_enabled") and settings.get("auto_enabled", True):
            days = cat.get("auto_task_days")
            if days is not None:
                due = (datetime.now(timezone.utc) + timedelta(days=int(days))).date().isoformat()
                task = {
                    "id": new_id(), "person_id": body.person_id,
                    "assigned_to": p.get("assigned_to") or current["id"],
                    "due_date": due, "type": "call",
                    "title": f"{cat['name']} - takip görüşmesi",
                    "done": False, "created_at": now_iso(),
                }
                await db.tasks.insert_one(task)
    contact.pop("_id", None)
    return contact


# --- Tasks ---
@api.get("/tasks")
async def list_tasks(
    person_id: Optional[str] = None,
    only_open: bool = False,
    today: bool = False,
    overdue: bool = False,
    current=Depends(current_user_dep),
):
    filt: dict = {}
    if current["role"] != "admin":
        filt["assigned_to"] = current["id"]
    if person_id:
        filt["person_id"] = person_id
    if only_open:
        filt["done"] = False
    today_str = datetime.now(timezone.utc).date().isoformat()
    if today:
        filt["due_date"] = today_str
        filt["done"] = False
    if overdue:
        filt["due_date"] = {"$lt": today_str}
        filt["done"] = False
    items = await db.tasks.find(filt, {"_id": 0}).sort("due_date", 1).to_list(1000)
    return items


@api.post("/tasks")
async def create_task(body: TaskCreate, current=Depends(current_user_dep)):
    assigned = body.assigned_to or current["id"]
    task = {
        "id": new_id(), "person_id": body.person_id, "assigned_to": assigned,
        "due_date": body.due_date, "type": body.type, "title": body.title,
        "done": False, "created_at": now_iso(),
    }
    await db.tasks.insert_one(task)
    task.pop("_id", None)
    return task


@api.patch("/tasks/{tid}")
async def update_task(tid: str, body: TaskUpdate, current=Depends(current_user_dep)):
    t = await db.tasks.find_one({"id": tid})
    if not t:
        raise HTTPException(404, "Görev bulunamadı")
    if current["role"] != "admin" and t.get("assigned_to") != current["id"]:
        raise HTTPException(403, "Yetki yok")
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if body.done is True:
        upd["done_at"] = now_iso()
    await db.tasks.update_one({"id": tid}, {"$set": upd})
    return await db.tasks.find_one({"id": tid}, {"_id": 0})


@api.delete("/tasks/{tid}")
async def delete_task(tid: str, current=Depends(current_user_dep)):
    t = await db.tasks.find_one({"id": tid})
    if not t:
        raise HTTPException(404, "Görev bulunamadı")
    if current["role"] != "admin" and t.get("assigned_to") != current["id"]:
        raise HTTPException(403, "Yetki yok")
    await db.tasks.delete_one({"id": tid})
    return {"ok": True}


# --- Appointments ---
@api.get("/appointments")
async def list_appointments(
    person_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current=Depends(current_user_dep),
):
    filt = {}
    if current["role"] != "admin":
        filt["assigned_to"] = current["id"]
    if person_id:
        filt["person_id"] = person_id
    if date_from or date_to:
        rng = {}
        if date_from: rng["$gte"] = date_from
        if date_to: rng["$lte"] = date_to
        filt["date"] = rng
    items = await db.appointments.find(filt, {"_id": 0}).sort("date", 1).to_list(1000)
    return items


@api.post("/appointments")
async def create_appointment(body: AppointmentCreate, current=Depends(current_user_dep)):
    p = await get_person(body.person_id, current)
    apt = {
        "id": new_id(), "person_id": body.person_id,
        "assigned_to": p.get("assigned_to") or current["id"],
        "date": body.date, "duration_min": body.duration_min,
        "status": body.status, "note": body.note, "type": body.type,
        "created_at": now_iso(),
    }
    await db.appointments.insert_one(apt)
    apt.pop("_id", None)
    return apt


@api.patch("/appointments/{aid}")
async def update_appointment(aid: str, body: AppointmentUpdate, current=Depends(current_user_dep)):
    a = await db.appointments.find_one({"id": aid})
    if not a:
        raise HTTPException(404, "Randevu bulunamadı")
    if current["role"] != "admin" and a.get("assigned_to") != current["id"]:
        raise HTTPException(403, "Yetki yok")
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.appointments.update_one({"id": aid}, {"$set": upd})
    return await db.appointments.find_one({"id": aid}, {"_id": 0})


@api.delete("/appointments/{aid}")
async def delete_appointment(aid: str, current=Depends(current_user_dep)):
    a = await db.appointments.find_one({"id": aid})
    if not a:
        raise HTTPException(404, "Randevu bulunamadı")
    if current["role"] != "admin" and a.get("assigned_to") != current["id"]:
        raise HTTPException(403, "Yetki yok")
    await db.appointments.delete_one({"id": aid})
    return {"ok": True}


# --- Memberships ---
@api.get("/memberships")
async def list_memberships(person_id: Optional[str] = None, current=Depends(current_user_dep)):
    filt = {}
    if person_id:
        filt["person_id"] = person_id
    items = await db.memberships.find(filt, {"_id": 0}).sort("start_date", -1).to_list(500)
    return items


@api.post("/memberships")
async def create_membership(body: MembershipCreate, current=Depends(current_user_dep)):
    await get_person(body.person_id, current)
    start = to_date(body.start_date) or datetime.now(timezone.utc)
    end = start + timedelta(days=30)
    m = {
        "id": new_id(), "person_id": body.person_id, "start_date": body.start_date,
        "end_date": end.date().isoformat(), "monthly_fee": body.monthly_fee,
        "payment_method": body.payment_method, "payment_plan": body.payment_plan,
        "status": "Aktif", "days_used": 0, "freeze_days": 0,
        "created_at": now_iso(), "updated_at": now_iso(), "updated_by": current["name"],
    }
    await db.memberships.insert_one(m)
    m.pop("_id", None)
    return m


@api.patch("/memberships/{mid}")
async def update_membership(mid: str, body: MembershipUpdate, current=Depends(current_user_dep)):
    m = await db.memberships.find_one({"id": mid})
    if not m:
        raise HTTPException(404, "Üyelik bulunamadı")
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    # Freeze days extend end_date
    if body.freeze_days and body.freeze_days > 0:
        end = to_date(m["end_date"]) or datetime.now(timezone.utc)
        new_end = end + timedelta(days=body.freeze_days)
        upd["end_date"] = new_end.date().isoformat()
        upd["freeze_days"] = m.get("freeze_days", 0) + body.freeze_days
    upd["updated_at"] = now_iso()
    upd["updated_by"] = current["name"]
    await db.memberships.update_one({"id": mid}, {"$set": upd})
    # If graduated -> update person lifecycle
    if body.status == "Mezun edildi":
        await db.persons.update_one({"id": m["person_id"]}, {"$set": {"lifecycle_status": "graduate"}})
    return await db.memberships.find_one({"id": mid}, {"_id": 0})


@api.post("/memberships/{mid}/refund")
async def calc_refund(mid: str, days_used: int, current=Depends(current_user_dep)):
    m = await db.memberships.find_one({"id": mid})
    if not m:
        raise HTTPException(404, "Üyelik bulunamadı")
    daily = m["monthly_fee"] / 26
    unused = max(0, 26 - days_used)
    refund = round(unused * daily, 2)
    return {"daily_fee": round(daily, 2), "unused_days": unused, "refund_amount": refund}


# --- Payments ---
@api.get("/payments")
async def list_payments(
    person_id: Optional[str] = None,
    overdue: bool = False,
    current=Depends(current_user_dep),
):
    filt = {}
    if person_id:
        filt["person_id"] = person_id
    if overdue:
        today_str = datetime.now(timezone.utc).date().isoformat()
        filt["status"] = {"$in": ["Bekliyor", "Kısmi ödendi", "Gecikmiş"]}
        filt["due_date"] = {"$lt": today_str}
    items = await db.payments.find(filt, {"_id": 0}).sort("due_date", 1).to_list(2000)
    # Auto-mark overdue
    today_str = datetime.now(timezone.utc).date().isoformat()
    for p in items:
        if p["status"] == "Bekliyor" and p["due_date"] < today_str:
            p["status"] = "Gecikmiş"
    return items


@api.post("/payments")
async def create_payment(body: PaymentCreate, current=Depends(current_user_dep)):
    await get_person(body.person_id, current)
    pay = {"id": new_id(), "kind": "membership", "created_at": now_iso(), **body.model_dump()}
    await db.payments.insert_one(pay)
    pay.pop("_id", None)
    return pay


@api.patch("/payments/{pid}")
async def update_payment(pid: str, body: PaymentUpdate, current=Depends(current_user_dep)):
    pay = await db.payments.find_one({"id": pid})
    if not pay:
        raise HTTPException(404, "Ödeme bulunamadı")
    if current["role"] != "admin":
        person = await db.persons.find_one({"id": pay["person_id"]})
        if not person or person.get("assigned_to") != current["id"]:
            raise HTTPException(403, "Yetki yok")
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if body.status == "Ödendi" and not body.paid_date:
        upd["paid_date"] = datetime.now(timezone.utc).date().isoformat()
    await db.payments.update_one({"id": pid}, {"$set": upd})
    return await db.payments.find_one({"id": pid}, {"_id": 0})


@api.delete("/payments/{pid}")
async def delete_payment(pid: str, current=Depends(current_user_dep)):
    pay = await db.payments.find_one({"id": pid})
    if not pay:
        raise HTTPException(404, "Ödeme bulunamadı")
    if current["role"] != "admin":
        person = await db.persons.find_one({"id": pay["person_id"]})
        if not person or person.get("assigned_to") != current["id"]:
            raise HTTPException(403, "Yetki yok")
    await db.payments.delete_one({"id": pid})
    return {"ok": True}


# --- Measurements ---
@api.get("/measurements")
async def list_measurements(person_id: str, current=Depends(current_user_dep)):
    await get_person(person_id, current)
    items = await db.measurements.find({"person_id": person_id}, {"_id": 0}).sort("date", -1).to_list(500)
    return items


@api.post("/measurements")
async def create_measurement(body: MeasurementCreate, current=Depends(current_user_dep)):
    p = await get_person(body.person_id, current)
    if p.get("lifecycle_status") == "lead":
        raise HTTPException(400, "Ölçüm sadece müşteriler için oluşturulabilir")
    m = {"id": new_id(), "user_id": current["id"], "user_name": current["name"],
         "created_at": now_iso(), **body.model_dump()}
    await db.measurements.insert_one(m)
    m.pop("_id", None)
    return m


@api.patch("/measurements/{mid}")
async def update_measurement(mid: str, body: MeasurementCreate, current=Depends(current_user_dep)):
    m = await db.measurements.find_one({"id": mid})
    if not m:
        raise HTTPException(404, "Ölçüm bulunamadı")
    await get_person(m["person_id"], current)  # ownership check
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    upd["updated_at"] = now_iso()
    upd["updated_by"] = current["name"]
    await db.measurements.update_one({"id": mid}, {"$set": upd})
    return await db.measurements.find_one({"id": mid}, {"_id": 0})


@api.delete("/measurements/{mid}")
async def delete_measurement(mid: str, current=Depends(current_user_dep)):
    m = await db.measurements.find_one({"id": mid})
    if not m:
        raise HTTPException(404, "Ölçüm bulunamadı")
    await get_person(m["person_id"], current)
    await db.measurements.delete_one({"id": mid})
    return {"ok": True}


# --- Products ---
@api.get("/products")
async def list_products(active: Optional[bool] = None, current=Depends(current_user_dep)):
    filt = {}
    if active is not None:
        filt["active"] = active
    items = await db.products.find(filt, {"_id": 0}).to_list(500)
    return items


@api.post("/products")
async def create_product(body: ProductCreate, current=Depends(current_user_dep)):
    require_admin(current)
    p = {"id": new_id(), "created_at": now_iso(), **body.model_dump()}
    await db.products.insert_one(p)
    p.pop("_id", None)
    return p


@api.patch("/products/{pid}")
async def update_product(pid: str, body: ProductCreate, current=Depends(current_user_dep)):
    require_admin(current)
    await db.products.update_one({"id": pid}, {"$set": body.model_dump()})
    return await db.products.find_one({"id": pid}, {"_id": 0})


# --- Product Sales ---
@api.get("/product-sales")
async def list_product_sales(person_id: Optional[str] = None, current=Depends(current_user_dep)):
    filt = {}
    if person_id:
        filt["person_id"] = person_id
    items = await db.product_sales.find(filt, {"_id": 0}).sort("sale_date", -1).to_list(1000)
    return items


@api.post("/product-sales")
async def create_product_sale(body: ProductSaleCreate, current=Depends(current_user_dep)):
    p = await db.persons.find_one({"id": body.person_id})
    if not p:
        raise HTTPException(404, "Kayıt bulunamadı")
    if p["lifecycle_status"] not in ("customer", "graduate"):
        raise HTTPException(400, "Ürün satışı sadece müşteri veya mezunlara eklenebilir")
    if current["role"] != "admin" and p.get("assigned_to") != current["id"]:
        raise HTTPException(403, "Yalnızca kendi müşterinize ürün satışı ekleyebilirsiniz")
    prod = await db.products.find_one({"id": body.product_id})
    sale = {
        "id": new_id(), "seller_id": current["id"], "seller_name": current["name"],
        "product_name": prod["name"] if prod else "Ürün",
        "created_at": now_iso(),
        **body.model_dump(),
    }
    await db.product_sales.insert_one(sale)
    sale.pop("_id", None)
    return sale


@api.patch("/product-sales/{sid}")
async def update_product_sale(sid: str, body: ProductSaleCreate, current=Depends(current_user_dep)):
    s = await db.product_sales.find_one({"id": sid})
    if not s:
        raise HTTPException(404, "Kayıt bulunamadı")
    p = await db.persons.find_one({"id": s["person_id"]})
    if current["role"] != "admin" and (p or {}).get("assigned_to") != current["id"]:
        raise HTTPException(403, "Yetki yok")
    await db.product_sales.update_one({"id": sid}, {"$set": body.model_dump()})
    return await db.product_sales.find_one({"id": sid}, {"_id": 0})


@api.delete("/product-sales/{sid}")
async def delete_product_sale(sid: str, current=Depends(current_user_dep)):
    s = await db.product_sales.find_one({"id": sid})
    if not s:
        return {"ok": True}
    p = await db.persons.find_one({"id": s["person_id"]})
    if current["role"] != "admin" and (p or {}).get("assigned_to") != current["id"]:
        raise HTTPException(403, "Yetki yok")
    await db.product_sales.delete_one({"id": sid})
    return {"ok": True}


# --- Financial summary ---
@api.get("/persons/{pid}/financial")
async def financial_summary(pid: str, current=Depends(current_user_dep)):
    await get_person(pid, current)
    payments = await db.payments.find({"person_id": pid}, {"_id": 0}).to_list(1000)
    sales = await db.product_sales.find({"person_id": pid}, {"_id": 0}).to_list(1000)
    def sum_by_status(items, statuses, amount_key="amount"):
        return sum(i[amount_key] * i.get("qty", 1) if amount_key == "unit_price" else i[amount_key] for i in items if i.get("status") in statuses)
    paid_mem = sum(p["amount"] for p in payments if p.get("status") == "Ödendi")
    pending_mem = sum(p["amount"] for p in payments if p.get("status") in ("Bekliyor", "Gecikmiş"))
    partial_mem = sum(p["amount"] for p in payments if p.get("status") == "Kısmi ödendi")
    paid_prod = sum(s["unit_price"] * s.get("qty", 1) for s in sales if s.get("status") == "Ödendi")
    pending_prod = sum(s["unit_price"] * s.get("qty", 1) for s in sales if s.get("status") in ("Bekliyor",))
    partial_prod = sum(s["unit_price"] * s.get("qty", 1) for s in sales if s.get("status") == "Kısmi ödendi")
    return {
        "paid_membership": paid_mem, "paid_product": paid_prod,
        "pending_membership": pending_mem, "pending_product": pending_prod,
        "partial_membership": partial_mem, "partial_product": partial_prod,
        "total": paid_mem + paid_prod + pending_mem + pending_prod + partial_mem + partial_prod,
        "total_receivable": pending_mem + pending_prod + partial_mem + partial_prod,
    }


# --- Dashboard ---
@api.get("/dashboard")
async def dashboard(current=Depends(current_user_dep)):
    today_str = datetime.now(timezone.utc).date().isoformat()
    in_7 = (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat()
    role = current["role"]
    filt_lead: dict = {"lifecycle_status": "lead", "archived": False}
    filt_cust: dict = {"lifecycle_status": "customer"}
    filt_task: dict = {"done": False}
    filt_apt: dict = {"date": {"$gte": today_str, "$lte": today_str + "T23:59:59"}}
    if role != "admin":
        filt_lead["assigned_to"] = current["id"]
        filt_cust["assigned_to"] = current["id"]
        filt_task["assigned_to"] = current["id"]
        filt_apt["assigned_to"] = current["id"]
    unassigned_count = 0
    if role == "admin":
        unassigned_count = await db.persons.count_documents({"lifecycle_status": "lead", "archived": False, "assigned_to": None})
    today_tasks = await db.tasks.count_documents({**filt_task, "due_date": today_str})
    overdue_tasks = await db.tasks.count_documents({**filt_task, "due_date": {"$lt": today_str}})
    today_apts = await db.appointments.count_documents({**{k: v for k, v in filt_apt.items() if k != "date"}, "date": {"$regex": f"^{today_str}"}})
    active_customers = await db.persons.count_documents(filt_cust)
    # renewals in 7 days
    mem_filt: dict = {"end_date": {"$gte": today_str, "$lte": in_7}, "status": "Aktif"}
    memberships_renewing = await db.memberships.find(mem_filt, {"_id": 0}).to_list(200)
    if role != "admin":
        # filter to only assigned persons
        pids = [p["id"] for p in await db.persons.find({"assigned_to": current["id"]}, {"id": 1}).to_list(2000)]
        memberships_renewing = [m for m in memberships_renewing if m["person_id"] in pids]
    # overdue payments
    overdue_pay_filt: dict = {"status": {"$in": ["Bekliyor", "Gecikmiş", "Kısmi ödendi"]}, "due_date": {"$lt": today_str}}
    overdue_payments = await db.payments.count_documents(overdue_pay_filt)
    # by source
    sources = await db.sources.find({}, {"_id": 0}).to_list(50)
    src_map = {s["id"]: s["name"] for s in sources}
    # by source / stage - scope to accessible persons
    person_filter = {} if role == "admin" else {"assigned_to": current["id"]}
    persons = await db.persons.find(person_filter, {"_id": 0, "source_id": 1, "assigned_to": 1, "sales_stage_id": 1, "lifecycle_status": 1, "negative_reason_id": 1}).to_list(5000)
    by_source: dict = {}
    for p in persons:
        n = src_map.get(p.get("source_id"), "Bilinmiyor")
        by_source[n] = by_source.get(n, 0) + 1
    # by stage
    stages = await db.sales_stages.find({}, {"_id": 0}).to_list(50)
    stage_map = {s["id"]: s["name"] for s in stages}
    by_stage: dict = {}
    for p in persons:
        n = stage_map.get(p.get("sales_stage_id"), "-")
        by_stage[n] = by_stage.get(n, 0) + 1
    # negative reasons
    neg_reasons = await db.negative_reasons.find({}, {"_id": 0}).to_list(50)
    neg_map = {r["id"]: r["name"] for r in neg_reasons}
    by_neg: dict = {}
    for p in persons:
        if p.get("negative_reason_id"):
            n = neg_map.get(p["negative_reason_id"], "Diğer")
            by_neg[n] = by_neg.get(n, 0) + 1
    # consultant conversion
    users = await db.users.find({"role": "consultant"}, {"_id": 0}).to_list(100)
    today_iso_str = datetime.now(timezone.utc).date().isoformat()
    conv_by_user = []
    for u in users:
        appointments_count = await db.appointments.count_documents({"assigned_to": u["id"]})
        converted = await db.persons.count_documents({"assigned_to": u["id"], "lifecycle_status": {"$in": ["customer", "graduate"]}})
        rate = round((converted / appointments_count * 100), 1) if appointments_count else 0
        conv_by_user.append({"name": u["name"], "appointments": appointments_count, "converted": converted, "rate": rate})
    # Birthdays today (match MM-DD of birth_date)
    today_md = datetime.now(timezone.utc).strftime("%m-%d")
    bd_filter = {"birth_date": {"$ne": None}}
    if role != "admin":
        bd_filter["assigned_to"] = current["id"]
    bd_docs = await db.persons.find(bd_filter, {"_id": 0, "id": 1, "name": 1, "birth_date": 1, "phone": 1, "lifecycle_status": 1, "assigned_to": 1}).to_list(5000)
    birthdays_today = [p for p in bd_docs if p.get("birth_date") and len(p["birth_date"]) >= 10 and p["birth_date"][5:10] == today_md]
    return {
        "unassigned_leads": unassigned_count,
        "today_tasks": today_tasks,
        "overdue_tasks": overdue_tasks,
        "today_appointments": today_apts,
        "active_customers": active_customers,
        "memberships_renewing": memberships_renewing,
        "overdue_payments": overdue_payments,
        "by_source": [{"name": k, "value": v} for k, v in by_source.items()],
        "by_stage": [{"name": k, "value": v} for k, v in by_stage.items()],
        "by_negative_reason": [{"name": k, "value": v} for k, v in by_neg.items()],
        "conversion_by_consultant": conv_by_user,
        "birthdays_today": birthdays_today,
    }


# --- Reports & Targets ---
@api.get("/reports/kpi")
async def report_kpi(
    user_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current=Depends(current_user_dep),
):
    if current["role"] != "admin":
        user_id = current["id"]
    p_filt: dict = {"lifecycle_status": "lead"}
    if user_id:
        p_filt["assigned_to"] = user_id
    if date_from or date_to:
        rng = {}
        if date_from: rng["$gte"] = date_from
        if date_to: rng["$lte"] = date_to
        p_filt["request_date"] = rng
    persons = await db.persons.find(p_filt, {"_id": 0}).to_list(5000)
    new_leads = len(persons)
    # count conversions in the same date range from customer_since
    conv_filt: dict = {"lifecycle_status": {"$in": ["customer", "graduate"]}}
    if user_id:
        conv_filt["assigned_to"] = user_id
    converted_docs = await db.persons.find(conv_filt, {"_id": 0}).to_list(5000)
    converted = len(converted_docs)
    apts = await db.appointments.count_documents({"assigned_to": user_id} if user_id else {})
    calls = await db.contacts.count_documents({"user_id": user_id} if user_id else {})
    mem_filt: dict = {}
    if user_id:
        # memberships of persons assigned to this user
        pids = [p["id"] for p in await db.persons.find({"assigned_to": user_id}, {"id": 1}).to_list(5000)]
        mem_filt["person_id"] = {"$in": pids}
    if date_from or date_to:
        rng = {}
        if date_from: rng["$gte"] = date_from
        if date_to: rng["$lte"] = date_to
        mem_filt["start_date"] = rng
    memberships = await db.memberships.count_documents(mem_filt)
    tasks_all = await db.tasks.find({"assigned_to": user_id} if user_id else {}, {"_id": 0}).to_list(2000)
    ontime = sum(1 for t in tasks_all if t.get("done") and t.get("done_at") and t["done_at"][:10] <= t["due_date"])
    overdue = sum(1 for t in tasks_all if not t.get("done") and t["due_date"] < datetime.now(timezone.utc).date().isoformat())
    return {
        "new_leads": new_leads,
        "calls": calls,
        "appointments": apts,
        "conversion_rate": round(converted / new_leads * 100, 1) if new_leads else 0,
        "new_memberships": memberships,
        "ontime_tasks": ontime,
        "overdue_tasks": overdue,
    }


@api.get("/targets")
async def list_targets(current=Depends(current_user_dep)):
    filt = {} if current["role"] == "admin" else {"user_id": current["id"]}
    return await db.targets.find(filt, {"_id": 0}).to_list(500)


@api.post("/targets")
async def create_target(body: TargetBody, current=Depends(current_user_dep)):
    require_admin(current)
    t = {"id": new_id(), **body.model_dump()}
    await db.targets.update_one(
        {"user_id": body.user_id, "year": body.year, "month": body.month},
        {"$set": t}, upsert=True
    )
    return t


@api.get("/reports/export/{fmt}")
async def export_report(fmt: str, user_id: Optional[str] = None, current=Depends(current_user_dep)):
    kpi = await report_kpi(user_id=user_id, current=current)
    if fmt == "excel":
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "KPI Raporu"
        ws.append(["Metrik", "Değer"])
        for k, v in kpi.items():
            ws.append([k, v])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                 headers={"Content-Disposition": "attachment; filename=kpi_raporu.xlsx"})
    elif fmt == "pdf":
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(72, 800, "FitAtolye CRM - KPI Raporu")
        c.setFont("Helvetica", 11)
        y = 760
        for k, v in kpi.items():
            c.drawString(72, y, f"{k}: {v}")
            y -= 20
        c.save()
        buf.seek(0)
        return StreamingResponse(buf, media_type="application/pdf",
                                 headers={"Content-Disposition": "attachment; filename=kpi_raporu.pdf"})
    raise HTTPException(400, "Geçersiz format")


# --- WhatsApp Templates ---
class WATemplateBody(BaseModel):
    name: str
    content: str
    active: bool = True
    is_default: bool = False


@api.get("/wa-templates")
async def list_wa_templates(current=Depends(current_user_dep)):
    items = await db.wa_templates.find({"active": True}, {"_id": 0}).sort("is_default", -1).to_list(200)
    return items


@api.post("/wa-templates")
async def create_wa_template(body: WATemplateBody, current=Depends(current_user_dep)):
    require_admin(current)
    if body.is_default:
        await db.wa_templates.update_many({}, {"$set": {"is_default": False}})
    tpl = {"id": new_id(), "created_at": now_iso(), **body.model_dump()}
    await db.wa_templates.insert_one(tpl)
    tpl.pop("_id", None)
    return tpl


@api.patch("/wa-templates/{tid}")
async def update_wa_template(tid: str, body: WATemplateBody, current=Depends(current_user_dep)):
    require_admin(current)
    if body.is_default:
        await db.wa_templates.update_many({"id": {"$ne": tid}}, {"$set": {"is_default": False}})
    await db.wa_templates.update_one({"id": tid}, {"$set": body.model_dump()})
    return await db.wa_templates.find_one({"id": tid}, {"_id": 0})


@api.delete("/wa-templates/{tid}")
async def delete_wa_template(tid: str, current=Depends(current_user_dep)):
    require_admin(current)
    await db.wa_templates.delete_one({"id": tid})
    return {"ok": True}


# --- Coaches (admin: per-coach detailed stats) ---
@api.get("/coaches/stats")
async def coaches_stats(current=Depends(current_user_dep)):
    require_admin(current)
    users = await db.users.find({"role": "consultant"}, {"password_hash": 0, "_id": 0}).to_list(200)
    today_str = datetime.now(timezone.utc).date().isoformat()
    result = []
    for u in users:
        uid = u["id"]
        leads = await db.persons.count_documents({"assigned_to": uid, "lifecycle_status": "lead"})
        active_customers = await db.persons.count_documents({"assigned_to": uid, "lifecycle_status": "customer"})
        graduates = await db.persons.count_documents({"assigned_to": uid, "lifecycle_status": "graduate"})
        appointments = await db.appointments.count_documents({"assigned_to": uid})
        contacts = await db.contacts.count_documents({"user_id": uid})
        open_tasks = await db.tasks.count_documents({"assigned_to": uid, "done": False})
        overdue_tasks = await db.tasks.count_documents({"assigned_to": uid, "done": False, "due_date": {"$lt": today_str}})
        conv_rate = round((active_customers + graduates) / appointments * 100, 1) if appointments else 0
        result.append({
            "id": uid, "name": u["name"], "email": u["email"], "active": u.get("active", True),
            "leads": leads, "active_customers": active_customers, "graduates": graduates,
            "appointments": appointments, "contacts": contacts,
            "open_tasks": open_tasks, "overdue_tasks": overdue_tasks,
            "conversion_rate": conv_rate,
        })
    return result


# --- Settings ---
@api.get("/settings")
async def get_settings(current=Depends(current_user_dep)):
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        await db.settings.insert_one({"id": "global", "auto_enabled": True, "days_unreachable": 1, "days_thinking": 3,
             "days_no_show": 0, "renewal_task_days": 7, "renewal_reminder_days": 3})
        s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    return s


@api.patch("/settings")
async def update_settings(body: SettingsBody, current=Depends(current_user_dep)):
    require_admin(current)
    await db.settings.update_one({"id": "global"}, {"$set": body.model_dump()}, upsert=True)
    return await db.settings.find_one({"id": "global"}, {"_id": 0})


# --- Startup ---
app.include_router(api)

try:
    origins = os.environ.get("CORS_ORIGINS", "*").split(",")
    if origins == ["*"]:
        allow_creds = False
    else:
        allow_creds = True
except Exception:
    origins = ["*"]
    allow_creds = False

app.add_middleware(
    CORSMiddleware,
    allow_credentials=allow_creds,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup():
    global get_current_user
    get_current_user = await get_current_user_factory(db)
    await db.users.create_index("email", unique=True)
    await db.persons.create_index([("phone", 1)])
    await db.persons.create_index([("instagram", 1)])
    # Seed
    from seed import seed_all
    await seed_all(db)
    logger.info("FitAtölye CRM started.")


@app.on_event("shutdown")
async def shutdown():
    client.close()
