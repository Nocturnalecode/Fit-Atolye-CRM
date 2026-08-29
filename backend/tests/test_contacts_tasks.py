"""Contacts (with auto follow-up task), Tasks CRUD, Appointments CRUD."""
import pytest
from conftest import API, d, uniq_phone


@pytest.fixture(scope="class")
def lead(admin, cleanup_persons):
    src = admin.get(f"{API}/ref/sources").json()[0]["id"]
    users = admin.get(f"{API}/users").json()
    cons = [u for u in users if u["role"] == "consultant"][0]
    r = admin.post(f"{API}/persons", json={"name": "TEST_ContactLead", "phone": uniq_phone(),
                                           "source_id": src, "request_date": d(0),
                                           "assigned_to": cons["id"]})
    assert r.status_code == 200, r.text
    p = r.json()
    cleanup_persons.append(p["id"])
    return p


class TestContacts:
    def test_contact_creates_auto_followup_task(self, admin, lead):
        cats = {c["name"]: c for c in admin.get(f"{API}/ref/response_categories").json()}
        cat = cats["Ulaşılamadı"]  # auto_enabled, auto_task_days=1
        before = admin.get(f"{API}/tasks", params={"person_id": lead["id"]}).json()
        r = admin.post(f"{API}/contacts", json={"person_id": lead["id"], "channel": "Telefon",
                                                "response_category_id": cat["id"],
                                                "note": "TEST ulaşılamadı"})
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["person_id"] == lead["id"]
        assert c["channel"] == "Telefon"
        assert c["user_name"]
        # contact persisted
        hist = admin.get(f"{API}/contacts", params={"person_id": lead["id"]})
        assert hist.status_code == 200
        assert any(x["id"] == c["id"] for x in hist.json())
        # person updated
        person = admin.get(f"{API}/persons/{lead['id']}").json()
        assert person["response_category_id"] == cat["id"]
        assert person["last_note"] == "TEST ulaşılamadı"
        # auto task created for tomorrow, assigned to person's consultant
        after = admin.get(f"{API}/tasks", params={"person_id": lead["id"]}).json()
        assert len(after) == len(before) + 1, "auto follow-up task was not created"
        task = [t for t in after if t["id"] not in [b["id"] for b in before]][0]
        assert task["due_date"] == d(1)
        assert task["assigned_to"] == lead["assigned_to"]
        assert task["done"] is False

    def test_contact_without_auto_category_creates_no_task(self, admin, lead):
        cats = {c["name"]: c for c in admin.get(f"{API}/ref/response_categories").json()}
        cat = cats["Olumlu"]
        before = admin.get(f"{API}/tasks", params={"person_id": lead["id"]}).json()
        r = admin.post(f"{API}/contacts", json={"person_id": lead["id"], "channel": "WhatsApp",
                                                "response_category_id": cat["id"], "note": "TEST olumlu"})
        assert r.status_code == 200, r.text
        after = admin.get(f"{API}/tasks", params={"person_id": lead["id"]}).json()
        assert len(after) == len(before), "task created for non-auto category"

    def test_contact_next_followup_date_applied(self, admin, lead):
        target = d(9)
        r = admin.post(f"{API}/contacts", json={"person_id": lead["id"], "channel": "Instagram DM",
                                                "note": "TEST takip", "next_followup_date": target})
        assert r.status_code == 200, r.text
        assert admin.get(f"{API}/persons/{lead['id']}").json()["next_followup_date"] == target

    def test_contact_on_unknown_person_404(self, admin):
        r = admin.post(f"{API}/contacts", json={"person_id": "nope-222", "channel": "Telefon", "note": "x"})
        assert r.status_code == 404

    def test_consultant_cannot_add_contact_to_others_person(self, admin, consultant, consultant_login):
        others = [p for p in admin.get(f"{API}/persons").json()
                  if p.get("assigned_to") != consultant_login["user"]["id"]]
        r = consultant.post(f"{API}/contacts", json={"person_id": others[0]["id"],
                                                     "channel": "Telefon", "note": "TEST"})
        assert r.status_code == 403


class TestTasks:
    def test_task_crud(self, admin):
        r = admin.post(f"{API}/tasks", json={"due_date": d(2), "title": "TEST_Task 1", "type": "call"})
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["done"] is False and t["assigned_to"]
        tid = t["id"]
        # done=true sets done_at
        upd = admin.patch(f"{API}/tasks/{tid}", json={"done": True})
        assert upd.status_code == 200, upd.text
        assert upd.json()["done"] is True
        assert upd.json().get("done_at"), "done_at not set when task completed"
        # persisted
        listed = {x["id"]: x for x in admin.get(f"{API}/tasks").json()}
        assert listed[tid]["done"] is True
        # reopen
        re_open = admin.patch(f"{API}/tasks/{tid}", json={"done": False})
        assert re_open.status_code == 200
        assert re_open.json()["done"] is False, "cannot reopen a task (done=false ignored)"
        # delete
        dele = admin.delete(f"{API}/tasks/{tid}")
        assert dele.status_code == 200
        assert tid not in [x["id"] for x in admin.get(f"{API}/tasks").json()]

    def test_task_filters(self, admin):
        today = admin.post(f"{API}/tasks", json={"due_date": d(0), "title": "TEST_Today"}).json()
        late = admin.post(f"{API}/tasks", json={"due_date": d(-3), "title": "TEST_Overdue"}).json()
        try:
            ids_today = [t["id"] for t in admin.get(f"{API}/tasks", params={"today": "true"}).json()]
            ids_over = [t["id"] for t in admin.get(f"{API}/tasks", params={"overdue": "true"}).json()]
            assert today["id"] in ids_today
            assert late["id"] in ids_over
            assert late["id"] not in ids_today
            open_ids = [t["id"] for t in admin.get(f"{API}/tasks", params={"only_open": "true"}).json()]
            assert today["id"] in open_ids
        finally:
            admin.delete(f"{API}/tasks/{today['id']}")
            admin.delete(f"{API}/tasks/{late['id']}")

    def test_consultant_only_sees_own_tasks(self, consultant, consultant_login):
        tasks = consultant.get(f"{API}/tasks").json()
        assert all(t["assigned_to"] == consultant_login["user"]["id"] for t in tasks)

    def test_consultant_cannot_modify_others_task(self, admin, consultant, consultant_login):
        others = [u for u in admin.get(f"{API}/users").json()
                  if u["id"] != consultant_login["user"]["id"]]
        t = admin.post(f"{API}/tasks", json={"due_date": d(1), "title": "TEST_Others",
                                             "assigned_to": others[0]["id"]}).json()
        try:
            r = consultant.patch(f"{API}/tasks/{t['id']}", json={"title": "hacked"})
            assert r.status_code == 403, f"consultant could edit another user's task ({r.status_code})"
            r2 = consultant.delete(f"{API}/tasks/{t['id']}")
            assert r2.status_code == 403, f"consultant could delete another user's task ({r2.status_code})"
        finally:
            admin.delete(f"{API}/tasks/{t['id']}")

    def test_patch_unknown_task_404(self, admin):
        r = admin.patch(f"{API}/tasks/nope-333", json={"done": True})
        assert r.status_code == 404, f"expected 404 for unknown task, got {r.status_code}"


class TestAppointments:
    def test_appointment_crud(self, admin, lead):
        when = f"{d(1)}T10:00:00"
        r = admin.post(f"{API}/appointments", json={"person_id": lead["id"], "date": when,
                                                    "duration_min": 45, "note": "TEST randevu"})
        assert r.status_code == 200, r.text
        a = r.json()
        assert a["status"] == "Planlandı"
        assert a["assigned_to"] == lead["assigned_to"]
        assert a["duration_min"] == 45
        aid = a["id"]
        upd = admin.patch(f"{API}/appointments/{aid}", json={"status": "Geldi"})
        assert upd.status_code == 200, upd.text
        assert upd.json()["status"] == "Geldi"
        listed = {x["id"]: x for x in admin.get(f"{API}/appointments", params={"person_id": lead["id"]}).json()}
        assert listed[aid]["status"] == "Geldi"
        dele = admin.delete(f"{API}/appointments/{aid}")
        assert dele.status_code == 200
        assert aid not in [x["id"] for x in admin.get(f"{API}/appointments", params={"person_id": lead['id']}).json()]

    def test_appointment_date_range_filter(self, admin, lead):
        past = admin.post(f"{API}/appointments", json={"person_id": lead["id"], "date": f"{d(-5)}T09:00:00"}).json()
        future = admin.post(f"{API}/appointments", json={"person_id": lead["id"], "date": f"{d(5)}T09:00:00"}).json()
        try:
            res = admin.get(f"{API}/appointments", params={"date_from": d(0)}).json()
            ids = [x["id"] for x in res]
            assert future["id"] in ids
            assert past["id"] not in ids
        finally:
            admin.delete(f"{API}/appointments/{past['id']}")
            admin.delete(f"{API}/appointments/{future['id']}")

    def test_appointment_unknown_person_404(self, admin):
        r = admin.post(f"{API}/appointments", json={"person_id": "nope-444", "date": f"{d(1)}T10:00:00"})
        assert r.status_code == 404
