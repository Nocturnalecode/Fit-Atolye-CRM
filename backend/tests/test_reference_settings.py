"""Reference data (sources/stages/response_categories/negative_reasons/tags), settings, products."""
import pytest
from conftest import API

REF_KINDS = ["sources", "stages", "response_categories", "negative_reasons", "tags"]


class TestReferenceData:
    @pytest.mark.parametrize("kind", REF_KINDS)
    def test_ref_seeded(self, admin, kind):
        r = admin.get(f"{API}/ref/{kind}")
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list) and len(items) > 0, f"{kind} not seeded"
        assert all("id" in i and "name" in i for i in items)
        assert all("_id" not in i for i in items)

    def test_stages_ordered(self, admin):
        items = admin.get(f"{API}/ref/stages").json()
        orders = [i["order"] for i in items]
        assert orders == sorted(orders)
        assert items[0]["name"] == "Yeni talep"

    def test_response_categories_auto_config(self, admin):
        items = admin.get(f"{API}/ref/response_categories").json()
        by_name = {i["name"]: i for i in items}
        assert by_name["Ulaşılamadı"]["auto_enabled"] is True
        assert by_name["Ulaşılamadı"]["auto_task_days"] == 1
        assert by_name["Olumlu"]["auto_enabled"] is False

    def test_ref_requires_auth(self, anon):
        assert anon.get(f"{API}/ref/sources").status_code == 401

    def test_ref_invalid_kind_returns_4xx_not_500(self, admin):
        r = admin.get(f"{API}/ref/does_not_exist")
        assert r.status_code in (400, 404), f"expected 4xx for unknown ref kind, got {r.status_code}"

    def test_consultant_cannot_create_ref(self, consultant):
        r = consultant.post(f"{API}/ref/tags", json={"name": "TEST_tag"})
        assert r.status_code == 403


class TestProducts:
    def test_products_seeded(self, admin):
        r = admin.get(f"{API}/products")
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 5
        assert all("price" in p for p in items)

    def test_admin_create_and_patch_product(self, admin, cleanup_misc):
        r = admin.post(f"{API}/products", json={"name": "TEST_Ürün", "price": 100.0, "active": True})
        assert r.status_code == 200, r.text
        prod = r.json()
        assert prod["name"] == "TEST_Ürün" and prod["price"] == 100.0
        pid = prod["id"]
        r2 = admin.patch(f"{API}/products/{pid}", json={"name": "TEST_Ürün2", "price": 150.0, "active": False})
        assert r2.status_code == 200, r2.text
        assert r2.json()["price"] == 150.0 and r2.json()["active"] is False
        # verify persistence
        listed = {p["id"]: p for p in admin.get(f"{API}/products").json()}
        assert listed[pid]["name"] == "TEST_Ürün2"
        # active filter
        act = admin.get(f"{API}/products", params={"active": "true"}).json()
        assert pid not in [p["id"] for p in act]

    def test_consultant_cannot_create_product(self, consultant):
        r = consultant.post(f"{API}/products", json={"name": "TEST_x", "price": 10})
        assert r.status_code == 403

    def test_consultant_cannot_patch_product(self, consultant, admin):
        pid = admin.get(f"{API}/products").json()[0]["id"]
        r = consultant.patch(f"{API}/products/{pid}", json={"name": "hack", "price": 1})
        assert r.status_code == 403


class TestSettings:
    def test_admin_get_and_patch(self, admin):
        r = admin.get(f"{API}/settings")
        assert r.status_code == 200, r.text
        s = r.json()
        for key in ("auto_enabled", "days_unreachable", "days_thinking", "renewal_task_days"):
            assert key in s
        original = {k: s[k] for k in ("auto_enabled", "days_unreachable", "days_thinking",
                                     "days_no_show", "renewal_task_days", "renewal_reminder_days")}
        body = dict(original)
        body["days_thinking"] = 5
        r2 = admin.patch(f"{API}/settings", json=body)
        assert r2.status_code == 200, r2.text
        assert r2.json()["days_thinking"] == 5
        assert admin.get(f"{API}/settings").json()["days_thinking"] == 5
        # restore
        admin.patch(f"{API}/settings", json=original)
        assert admin.get(f"{API}/settings").json()["days_thinking"] == original["days_thinking"]

    def test_consultant_cannot_patch(self, consultant, admin):
        s = admin.get(f"{API}/settings").json()
        body = {k: s[k] for k in ("auto_enabled", "days_unreachable", "days_thinking",
                                 "days_no_show", "renewal_task_days", "renewal_reminder_days")}
        r = consultant.patch(f"{API}/settings", json=body)
        assert r.status_code == 403

    def test_consultant_can_read_settings(self, consultant):
        assert consultant.get(f"{API}/settings").status_code == 200
