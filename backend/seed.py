"""Seed demo/reference data for FitAtölye CRM."""
import os
import uuid
from datetime import datetime, timezone, timedelta
from auth import hash_password


def _id():
    return str(uuid.uuid4())


def now():
    return datetime.now(timezone.utc).isoformat()


async def seed_all(db):
    await _seed_users(db)
    await _seed_reference(db)
    await _seed_settings(db)
    await _seed_wa_templates(db)
    await _seed_demo_persons(db)


async def _seed_wa_templates(db):
    if await db.wa_templates.count_documents({}) > 0:
        return
    templates = [
        {"name": "Genel Karşılama", "content": "Merhaba {name}, ben {consultant} - FitAtölye danışmanınızım. Görüşme talebiniz hakkında size ulaşıyorum. 🌿", "is_default": True, "active": True},
        {"name": "Randevu Hatırlatma", "content": "Merhaba {name}, {consultant} olarak yaklaşan randevunuzu hatırlatmak istedim. Görüşmek üzere! 📅", "is_default": False, "active": True},
        {"name": "Kısa Takip", "content": "Merhaba {name}, FitAtölye'den {consultant}. Müsait olduğunuzda kısa bir görüşme yapabilir miyiz? 🙋‍♀️", "is_default": False, "active": True},
    ]
    for t in templates:
        await db.wa_templates.insert_one({"id": _id(), "created_at": now(), **t})


async def _seed_users(db):
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@fitatolye.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin123!")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": _id(), "email": admin_email, "password_hash": hash_password(admin_password),
            "name": "Yönetici", "role": "admin", "active": True, "created_at": now(),
        })
    else:
        # keep in sync with .env password
        from auth import verify_password
        if not verify_password(admin_password, existing["password_hash"]):
            await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    consultants = [
        ("ayse@fitatolye.com", "Ayşe Demir"),
        ("mehmet@fitatolye.com", "Mehmet Kaya"),
        ("zeynep@fitatolye.com", "Zeynep Yıldız"),
    ]
    for email, name in consultants:
        if not await db.users.find_one({"email": email}):
            await db.users.insert_one({
                "id": _id(), "email": email, "password_hash": hash_password("Danisman123!"),
                "name": name, "role": "consultant", "active": True, "created_at": now(),
            })


async def _seed_reference(db):
    if await db.sources.count_documents({}) == 0:
        for n in ["Saha", "Cilt Bakımı", "Etki Çevresi", "Referans", "Instagram", "Facebook", "Google", "Talep", "Kontak", "Etkinlik"]:
            await db.sources.insert_one({"id": _id(), "name": n, "active": True})

    if await db.sales_stages.count_documents({}) == 0:
        stages = [
            "Yeni talep", "İlk arama bekliyor", "Arandı", "Görüşmeye davet edildi",
            "Randevu oluşturuldu", "Randevuya geldi", "Üyelik önerildi",
            "Karar bekliyor", "Üyelik başladı", "Olumsuz sonuçlandı"
        ]
        for i, n in enumerate(stages, 1):
            await db.sales_stages.insert_one({"id": _id(), "name": n, "order": i, "active": True})

    if await db.response_categories.count_documents({}) == 0:
        cats = [
            ("Olumlu", None, False),
            ("Düşünecek", 3, True),
            ("Fiyat yüksek geldi", None, False),
            ("Şu an zamanı uygun değil", 7, True),
            ("Ulaşılamadı", 1, True),
            ("Randevu oluşturuldu", None, False),
            ("Randevuya gelmedi", 0, True),
            ("İlgilenmiyor", None, False),
            ("Daha sonra tekrar aranacak", None, False),
            ("Diğer", None, False),
        ]
        for name, days, auto in cats:
            await db.response_categories.insert_one({
                "id": _id(), "name": name, "active": True, "auto_task_days": days, "auto_enabled": auto
            })

    if await db.negative_reasons.count_documents({}) == 0:
        for n in ["Fiyat", "Uzaklık", "Zaman", "İlgisiz", "Ulaşılamadı", "Diğer"]:
            await db.negative_reasons.insert_one({"id": _id(), "name": n, "active": True})

    if await db.tags.count_documents({}) == 0:
        for n in ["VIP", "Yakın Takip", "İkinci Görüşme", "Sabırlı"]:
            await db.tags.insert_one({"id": _id(), "name": n, "active": True})

    if await db.products.count_documents({}) == 0:
        for name, price in [
            ("Protein Tozu 1kg", 850),
            ("Multivitamin 60 tablet", 450),
            ("Yağ Yakıcı", 620),
            ("BCAA Amino", 720),
            ("Kreatin Monohidrat 300g", 550),
        ]:
            await db.products.insert_one({"id": _id(), "name": name, "price": price, "active": True, "demo": True, "created_at": now()})


async def _seed_settings(db):
    if not await db.settings.find_one({"id": "global"}):
        await db.settings.insert_one({
            "id": "global", "auto_enabled": True,
            "days_unreachable": 1, "days_thinking": 3, "days_no_show": 0,
            "renewal_task_days": 7, "renewal_reminder_days": 3,
        })


async def _seed_demo_persons(db):
    if await db.persons.count_documents({"demo": True}) > 0:
        return
    sources = await db.sources.find({}).to_list(20)
    stages = await db.sales_stages.find({}).sort("order", 1).to_list(20)
    cats = await db.response_categories.find({}).to_list(20)
    consultants = await db.users.find({"role": "consultant"}).to_list(10)
    if not consultants or not sources or not stages:
        return

    today = datetime.now(timezone.utc)
    def d(days):
        return (today + timedelta(days=days)).date().isoformat()

    demo_leads = [
        ("Ahmet Demir", "0532 111 2233", "@ahmetd", 0, 0, "high"),
        ("Selin Aksoy", "0533 222 3344", "@selin_a", 4, 2, "normal"),
        ("Burak Şen", "0535 333 4455", None, 1, 4, "normal"),
        ("Merve Kılıç", None, "@merve.k", 3, 1, "high"),
        ("Emre Toprak", "0537 555 6677", "@emret", 2, 3, "low"),
        ("Fatma Öz", "0538 666 7788", None, 5, 5, "normal"),
        ("Kerem Aslan", "0539 777 8899", "@keremm", 6, 6, "normal"),
        ("Ece Yılmaz", "0530 888 9900", "@ece.y", 7, 7, "normal"),
        ("Deniz Kara", "0541 999 0011", None, 8, 4, "high"),
    ]
    for name, phone, ig, src_i, stg_i, pri in demo_leads:
        cons = consultants[hash(name) % len(consultants)]
        await db.persons.insert_one({
            "id": _id(), "name": name, "phone": phone, "instagram": ig,
            "source_id": sources[src_i % len(sources)]["id"],
            "assigned_to": cons["id"],
            "request_date": d(-(hash(name) % 20)),
            "sales_stage_id": stages[stg_i % len(stages)]["id"],
            "response_category_id": cats[hash(name) % len(cats)]["id"],
            "negative_reason_id": None,
            "priority": pri, "tags": [],
            "next_followup_date": d((hash(name) % 5) - 2),
            "last_note": "Demo veri - ilk görüşme yapıldı.",
            "lifecycle_status": "lead", "archived": False,
            "updated_at": now(), "updated_by": "Sistem", "created_at": now(),
            "demo": True,
        })
    # 2 aktif müşteri
    for name, phone, mfee in [("Cem Aktaş", "0501 111 0001", 6500), ("Nurten Ergün", "0502 222 0002", 5800)]:
        pid = _id()
        cons = consultants[0]
        await db.persons.insert_one({
            "id": pid, "name": name, "phone": phone, "instagram": None,
            "source_id": sources[3]["id"], "assigned_to": cons["id"],
            "request_date": d(-40), "sales_stage_id": stages[8]["id"],
            "response_category_id": cats[0]["id"], "negative_reason_id": None,
            "priority": "normal", "tags": [], "next_followup_date": None,
            "last_note": "Demo aktif müşteri.", "lifecycle_status": "customer",
            "customer_since": d(-25), "archived": False,
            "updated_at": now(), "updated_by": "Sistem", "created_at": now(), "demo": True,
        })
        mid = _id()
        await db.memberships.insert_one({
            "id": mid, "person_id": pid, "start_date": d(-25),
            "end_date": d(5), "monthly_fee": mfee, "payment_method": "Havale/EFT",
            "payment_plan": "peşin", "status": "Aktif", "days_used": 25, "freeze_days": 0,
            "created_at": now(), "updated_at": now(), "updated_by": "Sistem", "demo": True,
        })
        await db.payments.insert_one({
            "id": _id(), "person_id": pid, "membership_id": mid, "amount": mfee,
            "due_date": d(-25), "paid_date": d(-25), "method": "Havale/EFT",
            "status": "Ödendi", "note": "Peşin", "kind": "membership", "created_at": now(), "demo": True,
        })
        await db.measurements.insert_one({
            "id": _id(), "person_id": pid, "date": d(-25), "weight": 82.4, "bmi": 26.1,
            "body_fat": 24.5, "muscle": 35.2, "water": 55.1, "chest": 102, "waist": 92,
            "belly": 96, "user_id": cons["id"], "user_name": cons["name"],
            "note": "İlk ölçüm.", "created_at": now(), "demo": True,
        })
        await db.measurements.insert_one({
            "id": _id(), "person_id": pid, "date": d(-5), "weight": 79.8, "bmi": 25.3,
            "body_fat": 22.1, "muscle": 36.1, "water": 56.4, "chest": 100, "waist": 89,
            "belly": 93, "user_id": cons["id"], "user_name": cons["name"],
            "note": "3 haftalık gelişim.", "created_at": now(), "demo": True,
        })
    # 1 mezun
    pid = _id()
    cons = consultants[1]
    await db.persons.insert_one({
        "id": pid, "name": "Hasan Yıldırım", "phone": "0505 000 9999", "instagram": None,
        "source_id": sources[4]["id"], "assigned_to": cons["id"],
        "request_date": d(-120), "sales_stage_id": stages[8]["id"],
        "response_category_id": cats[0]["id"], "negative_reason_id": None,
        "priority": "normal", "tags": [], "last_note": "Mezun oldu.",
        "lifecycle_status": "graduate", "customer_since": d(-100), "archived": False,
        "updated_at": now(), "updated_by": "Sistem", "created_at": now(), "demo": True,
    })
    # Demo tasks
    for name, days in [("İlk arama - Selin", 0), ("Takip görüşmesi - Emre", 1), ("Randevu hatırlatma - Merve", -1)]:
        await db.tasks.insert_one({
            "id": _id(), "person_id": None, "assigned_to": consultants[0]["id"],
            "due_date": d(days), "type": "call", "title": name, "done": False,
            "created_at": now(), "demo": True,
        })
