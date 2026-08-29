"""Dashboard, reports KPI, exports, targets, users."""
from conftest import API, d


class TestDashboard:
    def test_admin_dashboard_shape(self, admin):
        r = admin.get(f"{API}/dashboard")
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ("unassigned_leads", "active_customers", "by_source", "by_stage",
                    "conversion_by_consultant", "today_tasks", "overdue_tasks",
                    "today_appointments", "memberships_renewing", "overdue_payments",
                    "by_negative_reason"):
            assert key in data, f"missing {key}"
        assert isinstance(data["by_source"], list) and len(data["by_source"]) > 0
        assert isinstance(data["by_stage"], list) and len(data["by_stage"]) > 0
        assert all({"name", "value"} <= set(x) for x in data["by_source"])
        assert isinstance(data["active_customers"], int) and data["active_customers"] >= 2
        conv = data["conversion_by_consultant"]
        assert len(conv) >= 3
        assert all({"name", "total", "converted", "rate"} <= set(c) for c in conv)
        assert all("_id" not in m for m in data["memberships_renewing"])

    def test_consultant_dashboard_scoped(self, consultant, admin, consultant_login):
        cd = consultant.get(f"{API}/dashboard")
        assert cd.status_code == 200, cd.text
        data = cd.json()
        assert data["unassigned_leads"] == 0
        own = len([p for p in admin.get(f"{API}/persons", params={"lifecycle": "customer"}).json()
                   if p.get("assigned_to") == consultant_login["user"]["id"]])
        assert data["active_customers"] == own

    def test_dashboard_requires_auth(self, anon):
        assert anon.get(f"{API}/dashboard").status_code == 401

    def test_dashboard_charts_scoped_for_consultant(self, consultant, consultant_login, admin):
        """by_source/by_stage should reflect only the consultant's own persons."""
        data = consultant.get(f"{API}/dashboard").json()
        total_charted = sum(x["value"] for x in data["by_source"])
        own_total = len([p for p in admin.get(f"{API}/persons").json()
                         if p.get("assigned_to") == consultant_login["user"]["id"]])
        assert total_charted == own_total, (
            f"consultant dashboard charts aggregate all {total_charted} persons "
            f"instead of own {own_total} (data leak)")


class TestReports:
    def test_kpi_admin(self, admin):
        r = admin.get(f"{API}/reports/kpi")
        assert r.status_code == 200, r.text
        k = r.json()
        for key in ("new_leads", "calls", "appointments", "conversion_rate",
                    "ontime_tasks", "overdue_tasks", "new_memberships"):
            assert key in k, f"missing {key}"
        assert isinstance(k["new_leads"], int) and k["new_leads"] > 0
        assert 0 <= k["conversion_rate"] <= 100

    def test_kpi_date_filter(self, admin):
        r = admin.get(f"{API}/reports/kpi", params={"date_from": d(-3650), "date_to": d(0)})
        assert r.status_code == 200, r.text
        assert r.json()["new_leads"] > 0
        empty = admin.get(f"{API}/reports/kpi", params={"date_from": d(3650), "date_to": d(3660)})
        assert empty.status_code == 200
        assert empty.json()["new_leads"] == 0
        assert empty.json()["conversion_rate"] == 0

    def test_kpi_consultant_forced_to_self(self, consultant, consultant_login, admin):
        c = consultant.get(f"{API}/reports/kpi", params={"user_id": "someone-else"}).json()
        own = len([p for p in admin.get(f"{API}/persons").json()
                   if p.get("assigned_to") == consultant_login["user"]["id"]])
        assert c["new_leads"] == own

    def test_export_excel(self, admin):
        r = admin.get(f"{API}/reports/export/excel")
        assert r.status_code == 200, r.text
        assert "spreadsheetml" in r.headers.get("content-type", "")
        assert r.content[:2] == b"PK" and len(r.content) > 1000

    def test_export_pdf(self, admin):
        r = admin.get(f"{API}/reports/export/pdf")
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"

    def test_export_invalid_format(self, admin):
        r = admin.get(f"{API}/reports/export/csv")
        assert r.status_code == 400

    def test_targets_crud(self, admin, consultant, consultant_login, cleanup_misc):
        uid = consultant_login["user"]["id"]
        body = {"user_id": uid, "year": 2099, "month": 12, "new_leads": 50, "calls": 100,
                "appointments": 20, "new_memberships": 5, "renewals": 2, "ontime_tasks": 30}
        r = admin.post(f"{API}/targets", json=body)
        assert r.status_code == 200, r.text
        listed = [t for t in admin.get(f"{API}/targets").json()
                  if t["year"] == 2099 and t["user_id"] == uid]
        assert len(listed) == 1 and listed[0]["new_leads"] == 50
        admin.post(f"{API}/targets", json={**body, "new_leads": 60})
        listed2 = [t for t in admin.get(f"{API}/targets").json()
                   if t["year"] == 2099 and t["user_id"] == uid]
        assert len(listed2) == 1 and listed2[0]["new_leads"] == 60
        cons_targets = consultant.get(f"{API}/targets").json()
        assert all(t["user_id"] == uid for t in cons_targets)
        r2 = consultant.post(f"{API}/targets", json=body)
        assert r2.status_code == 403


class TestUsers:
    def test_admin_list_users(self, admin):
        r = admin.get(f"{API}/users")
        assert r.status_code == 200, r.text
        users = r.json()
        assert len(users) >= 4
        assert all("password_hash" not in u and "_id" not in u for u in users)

    def test_consultant_cannot_list_users(self, consultant):
        r = consultant.get(f"{API}/users")
        assert r.status_code == 403, \
            f"consultant can list all users (got {r.status_code}); directory should be admin-only"

    def test_consultant_cannot_create_user(self, consultant):
        r = consultant.post(f"{API}/users", json={"email": "test_x@example.com",
                                                  "password": "Abc12345!", "name": "TEST"})
        assert r.status_code == 403

    def test_admin_create_duplicate_email_400(self, admin, credentials):
        r = admin.post(f"{API}/users", json={"email": credentials["consultant"]["email"],
                                             "password": "Abc12345!", "name": "TEST dup"})
        assert r.status_code == 400
