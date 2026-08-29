"""Persons module: leads listing, RBAC scoping, create validation, duplicates, bulk assign."""
from conftest import API, d, uniq_phone


class TestPersonsListing:
    def test_admin_sees_leads(self, admin):
        """Demo data was intentionally purged; assert shape + filter correctness only."""
        r = admin.get(f"{API}/persons", params={"lifecycle": "lead"})
        assert r.status_code == 200, r.text
        leads = r.json()
        assert isinstance(leads, list)
        assert all(p["lifecycle_status"] == "lead" for p in leads)
        assert all("_id" not in p for p in leads)

    def test_admin_lifecycle_filters(self, admin):
        for lc in ("customer", "graduate"):
            r = admin.get(f"{API}/persons", params={"lifecycle": lc})
            assert r.status_code == 200, r.text
            items = r.json()
            assert isinstance(items, list)
            assert all(p["lifecycle_status"] == lc for p in items)
            assert all("_id" not in p for p in items)

    def test_consultant_scoped_to_own_leads(self, consultant, consultant_login):
        r = consultant.get(f"{API}/persons", params={"lifecycle": "lead"})
        assert r.status_code == 200
        leads = r.json()
        assert all(p["assigned_to"] == consultant_login["user"]["id"] for p in leads), \
            "consultant sees leads not assigned to them"

    def test_search_filter(self, admin, cleanup_persons):
        """Create a person then search it by name (no reliance on purged demo data)."""
        sid = admin.get(f"{API}/ref/sources").json()[0]["id"]
        r = admin.post(f"{API}/persons", json={"name": "TEST_AhmetSearch", "phone": uniq_phone(),
                                               "source_id": sid, "request_date": d(0), "force": True})
        assert r.status_code == 200, r.text
        cleanup_persons.append(r.json()["id"])
        s = admin.get(f"{API}/persons", params={"q": "AhmetSearch"})
        assert s.status_code == 200
        assert any("TEST_AhmetSearch" == p["name"] for p in s.json())

    def test_get_person_404(self, admin):
        assert admin.get(f"{API}/persons/nope-000").status_code == 404

    def test_consultant_cannot_read_other_person(self, admin, consultant, consultant_login):
        others = [p for p in admin.get(f"{API}/persons").json()
                  if p.get("assigned_to") != consultant_login["user"]["id"]]
        assert others, "no person assigned to another consultant to test with"
        r = consultant.get(f"{API}/persons/{others[0]['id']}")
        assert r.status_code == 403


class TestPersonCreate:
    def test_missing_phone_and_instagram_400(self, admin):
        src = admin.get(f"{API}/ref/sources").json()[0]["id"]
        r = admin.post(f"{API}/persons", json={"name": "TEST_NoContact", "source_id": src,
                                               "request_date": d(0)})
        assert r.status_code == 400, r.text
        assert "detail" in r.json()

    def test_create_lead_defaults(self, admin, cleanup_persons):
        src = admin.get(f"{API}/ref/sources").json()[0]["id"]
        stages = admin.get(f"{API}/ref/stages").json()
        payload = {"name": "TEST_Lead A", "phone": uniq_phone(), "source_id": src,
                   "request_date": d(0), "priority": "high", "last_note": "TEST note"}
        r = admin.post(f"{API}/persons", json=payload)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p.get("duplicate") is None
        cleanup_persons.append(p["id"])
        assert p["lifecycle_status"] == "lead"
        assert p["archived"] is False
        assert p["sales_stage_id"] == stages[0]["id"]
        assert p["priority"] == "high"
        # GET verifies persistence
        got = admin.get(f"{API}/persons/{p['id']}")
        assert got.status_code == 200
        assert got.json()["name"] == "TEST_Lead A"
        assert got.json()["phone"] == payload["phone"]

    def test_duplicate_phone_returns_duplicate_flag(self, admin, cleanup_persons):
        src = admin.get(f"{API}/ref/sources").json()[0]["id"]
        dup_phone = uniq_phone()
        payload = {"name": "TEST_Dup", "phone": dup_phone, "source_id": src, "request_date": d(0)}
        first = admin.post(f"{API}/persons", json=payload)
        assert first.status_code == 200
        cleanup_persons.append(first.json()["id"])
        second = admin.post(f"{API}/persons", json=payload)
        assert second.status_code == 200, second.text
        body = second.json()
        assert body.get("duplicate") is True, f"expected duplicate flag, got {body}"
        assert body["existing"]["id"] == first.json()["id"]
        # ensure not created twice
        found = [p for p in admin.get(f"{API}/persons", params={"q": dup_phone}).json()]
        assert len(found) == 1, f"duplicate record was created ({len(found)} found)"

    def test_force_duplicate_admin_only(self, admin, consultant, cleanup_persons):
        src = admin.get(f"{API}/ref/sources").json()[0]["id"]
        base = {"name": "TEST_Force", "phone": uniq_phone(), "source_id": src, "request_date": d(0)}
        first = admin.post(f"{API}/persons", json=base)
        cleanup_persons.append(first.json()["id"])
        r_cons = consultant.post(f"{API}/persons", json={**base, "force": True})
        assert r_cons.status_code == 403, r_cons.text
        r_admin = admin.post(f"{API}/persons", json={**base, "force": True})
        assert r_admin.status_code == 200, r_admin.text
        cleanup_persons.append(r_admin.json()["id"])

    def test_consultant_created_lead_is_self_assigned(self, consultant, consultant_login, cleanup_persons):
        src = consultant.get(f"{API}/ref/sources").json()[0]["id"]
        r = consultant.post(f"{API}/persons", json={"name": "TEST_ConsLead", "phone": uniq_phone(),
                                                    "source_id": src, "request_date": d(0)})
        assert r.status_code == 200, r.text
        p = r.json()
        cleanup_persons.append(p["id"])
        assert p["assigned_to"] == consultant_login["user"]["id"]


class TestPersonUpdateAndAssign:
    def test_bulk_assign_admin(self, admin, cleanup_persons):
        src = admin.get(f"{API}/ref/sources").json()[0]["id"]
        ids = []
        for i in range(2):
            r = admin.post(f"{API}/persons", json={"name": f"TEST_BA{i}", "phone": uniq_phone(),
                                                   "source_id": src, "request_date": d(0)})
            assert r.status_code == 200, r.text
            ids.append(r.json()["id"])
            cleanup_persons.append(r.json()["id"])
        users = admin.get(f"{API}/users").json()
        target = [u for u in users if u["role"] == "consultant"][0]["id"]
        r = admin.post(f"{API}/persons/bulk-assign", json={"person_ids": ids, "assigned_to": target})
        assert r.status_code == 200, r.text
        assert r.json()["updated"] == 2
        for pid in ids:
            assert admin.get(f"{API}/persons/{pid}").json()["assigned_to"] == target

    def test_consultant_cannot_bulk_assign(self, consultant):
        r = consultant.post(f"{API}/persons/bulk-assign", json={"person_ids": [], "assigned_to": "x"})
        assert r.status_code == 403

    def test_consultant_cannot_change_assigned_to(self, admin, consultant, consultant_login, cleanup_persons):
        src = admin.get(f"{API}/ref/sources").json()[0]["id"]
        r = admin.post(f"{API}/persons", json={"name": "TEST_Reassign", "phone": uniq_phone(),
                                               "source_id": src, "request_date": d(0),
                                               "assigned_to": consultant_login["user"]["id"]})
        pid = r.json()["id"]
        cleanup_persons.append(pid)
        others = [u for u in admin.get(f"{API}/users").json()
                  if u["role"] == "consultant" and u["id"] != consultant_login["user"]["id"]]
        res = consultant.patch(f"{API}/persons/{pid}", json={"assigned_to": others[0]["id"]})
        assert res.status_code == 403, res.text
        assert admin.get(f"{API}/persons/{pid}").json()["assigned_to"] == consultant_login["user"]["id"]

    def test_admin_patch_person_persists(self, admin, cleanup_persons):
        src = admin.get(f"{API}/ref/sources").json()[0]["id"]
        stages = admin.get(f"{API}/ref/stages").json()
        r = admin.post(f"{API}/persons", json={"name": "TEST_Patch", "phone": uniq_phone(),
                                               "source_id": src, "request_date": d(0)})
        pid = r.json()["id"]
        cleanup_persons.append(pid)
        upd = admin.patch(f"{API}/persons/{pid}", json={"sales_stage_id": stages[2]["id"],
                                                        "priority": "low", "last_note": "TEST updated"})
        assert upd.status_code == 200, upd.text
        got = admin.get(f"{API}/persons/{pid}").json()
        assert got["sales_stage_id"] == stages[2]["id"]
        assert got["priority"] == "low"
        assert got["last_note"] == "TEST updated"
        assert got["updated_by"]

    def test_patch_nonexistent_person_404(self, admin):
        assert admin.patch(f"{API}/persons/nope-111", json={"priority": "low"}).status_code == 404
