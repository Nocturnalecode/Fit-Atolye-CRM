"""Referral discount coupons + Reports Excel/PDF export tests."""
import os

import pytest
from conftest import API, uniq_phone, d, _mongo


# ---------- helpers ----------
def _source_id(admin):
    r = admin.get(f"{API}/ref/sources", timeout=30)
    assert r.status_code == 200, r.text
    srcs = r.json()
    assert len(srcs) > 0, "No sources seeded"
    return srcs[0]["id"]


def _create_person(admin, name, source_id, referred_by=None, assigned_to=None):
    payload = {
        "name": name,
        "phone": uniq_phone(),
        "source_id": source_id,
        "request_date": d(0),
        "force": True,
    }
    if referred_by:
        payload["referred_by_person_id"] = referred_by
    if assigned_to:
        payload["assigned_to"] = assigned_to
    r = admin.post(f"{API}/persons", json=payload, timeout=30)
    assert r.status_code == 200, f"create person failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    assert body.get("duplicate") is not True, f"unexpected duplicate response: {body}"
    assert "id" in body
    return body


# ---------- Reports export ----------
class TestReportExports:
    def test_excel_export(self, admin):
        r = admin.get(f"{API}/reports/export/excel", timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert r.headers.get("content-type", "").startswith(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ), r.headers.get("content-type")
        assert r.content[:2] == b"PK", "not a zip/xlsx payload"
        assert len(r.content) > 500

    def test_pdf_export(self, admin):
        r = admin.get(f"{API}/reports/export/pdf", timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:5] == b"%PDF-", r.content[:20]

    def test_exports_with_user_filter(self, admin, consultant_login):
        cid = consultant_login["user"]["id"]
        rx = admin.get(f"{API}/reports/export/excel", params={"user_id": cid}, timeout=60)
        assert rx.status_code == 200, rx.text[:300]
        assert rx.content[:2] == b"PK"
        rp = admin.get(f"{API}/reports/export/pdf", params={"user_id": cid}, timeout=60)
        assert rp.status_code == 200, rp.text[:300]
        assert rp.content[:5] == b"%PDF-"

    def test_invalid_format(self, admin):
        r = admin.get(f"{API}/reports/export/csv", timeout=30)
        assert r.status_code == 400, r.status_code

    def test_export_requires_auth(self, anon):
        r = anon.get(f"{API}/reports/export/excel", timeout=30)
        assert r.status_code in (401, 403), r.status_code


# ---------- Referral coupons ----------
class TestReferralCoupons:
    def test_auto_create_coupon_on_referral(self, admin, cleanup_persons, cleanup_coupons):
        sid = _source_id(admin)
        referrer = _create_person(admin, "TEST_Referrer_A", sid)
        cleanup_persons.append(referrer["id"])
        cleanup_coupons.append(referrer["id"])

        referred = _create_person(admin, "TEST_Referred_A1", sid, referred_by=referrer["id"])
        cleanup_persons.append(referred["id"])

        r = admin.get(f"{API}/persons/{referrer['id']}/coupons", timeout=30)
        assert r.status_code == 200, r.text[:300]
        coupons = r.json()
        assert isinstance(coupons, list)
        assert len(coupons) == 1, f"expected 1 coupon, got {len(coupons)}"
        c = coupons[0]
        assert c["discount_pct"] == 15
        assert c["status"] == "unused"
        assert c["referred_person_id"] == referred["id"]
        assert c["referred_person_name"] == "TEST_Referred_A1"
        assert c["used_at"] is None and c["used_by"] is None
        assert "_id" not in c

    def test_multiple_referrals_independent_coupons(self, admin, cleanup_persons, cleanup_coupons):
        sid = _source_id(admin)
        referrer = _create_person(admin, "TEST_Referrer_B", sid)
        cleanup_persons.append(referrer["id"])
        cleanup_coupons.append(referrer["id"])
        r1 = _create_person(admin, "TEST_Referred_B1", sid, referred_by=referrer["id"])
        r2 = _create_person(admin, "TEST_Referred_B2", sid, referred_by=referrer["id"])
        cleanup_persons += [r1["id"], r2["id"]]

        coupons = admin.get(f"{API}/persons/{referrer['id']}/coupons", timeout=30).json()
        assert len(coupons) == 2, f"expected 2 coupons, got {coupons}"
        assert all(c["discount_pct"] == 15 for c in coupons)
        assert all(c["status"] == "unused" for c in coupons)
        assert sum(c["discount_pct"] for c in coupons if c["status"] == "unused") == 30
        names = {c["referred_person_name"] for c in coupons}
        assert names == {"TEST_Referred_B1", "TEST_Referred_B2"}

        # Mark coupon A used -> B untouched (independent lifecycle)
        a, b = coupons[0], coupons[1]
        pr = admin.patch(f"{API}/coupons/{a['id']}", json={"status": "used"}, timeout=30)
        assert pr.status_code == 200, pr.text[:300]
        pa = pr.json()
        assert pa["status"] == "used"
        assert pa["used_at"] and pa["used_by"] and pa["used_by_name"]

        after = admin.get(f"{API}/persons/{referrer['id']}/coupons", timeout=30).json()
        by_id = {c["id"]: c for c in after}
        assert by_id[a["id"]]["status"] == "used"
        assert by_id[b["id"]]["status"] == "unused", "coupon B changed when A was used"
        assert by_id[b["id"]]["used_at"] is None

        # Toggle back to unused clears fields (persisted)
        back = admin.patch(f"{API}/coupons/{a['id']}", json={"status": "unused"}, timeout=30)
        assert back.status_code == 200
        assert back.json()["status"] == "unused"
        again = {c["id"]: c for c in admin.get(f"{API}/persons/{referrer['id']}/coupons", timeout=30).json()}
        assert again[a["id"]]["status"] == "unused"
        assert again[a["id"]]["used_at"] is None
        assert again[a["id"]]["used_by"] is None
        assert again[a["id"]]["used_by_name"] is None

    def test_patch_invalid_status_and_404(self, admin, cleanup_persons, cleanup_coupons):
        sid = _source_id(admin)
        referrer = _create_person(admin, "TEST_Referrer_C", sid)
        cleanup_persons.append(referrer["id"])
        cleanup_coupons.append(referrer["id"])
        ref = _create_person(admin, "TEST_Referred_C1", sid, referred_by=referrer["id"])
        cleanup_persons.append(ref["id"])
        cid = admin.get(f"{API}/persons/{referrer['id']}/coupons", timeout=30).json()[0]["id"]

        bad = admin.patch(f"{API}/coupons/{cid}", json={"status": "bogus"}, timeout=30)
        assert bad.status_code == 400, bad.status_code
        nf = admin.patch(f"{API}/coupons/does-not-exist", json={"status": "used"}, timeout=30)
        assert nf.status_code == 404, nf.status_code

    def test_delete_cascade_keeps_used_coupons(self, admin, cleanup_persons, cleanup_coupons):
        sid = _source_id(admin)
        referrer = _create_person(admin, "TEST_Referrer_D", sid)
        cleanup_persons.append(referrer["id"])
        cleanup_coupons.append(referrer["id"])
        used_ref = _create_person(admin, "TEST_Referred_D_used", sid, referred_by=referrer["id"])
        unused_ref = _create_person(admin, "TEST_Referred_D_unused", sid, referred_by=referrer["id"])
        cleanup_persons += [used_ref["id"], unused_ref["id"]]

        coupons = admin.get(f"{API}/persons/{referrer['id']}/coupons", timeout=30).json()
        used_c = next(c for c in coupons if c["referred_person_id"] == used_ref["id"])
        unused_c = next(c for c in coupons if c["referred_person_id"] == unused_ref["id"])
        assert admin.patch(f"{API}/coupons/{used_c['id']}", json={"status": "used"}, timeout=30).status_code == 200

        # delete the referred person whose coupon is USED -> coupon must remain
        dr = admin.delete(f"{API}/persons/{used_ref['id']}", timeout=30)
        assert dr.status_code == 200, dr.text[:300]
        remaining = admin.get(f"{API}/persons/{referrer['id']}/coupons", timeout=30).json()
        ids = {c["id"] for c in remaining}
        assert used_c["id"] in ids, "USED coupon was deleted with referred person"

        # delete referred person whose coupon is UNUSED -> coupon removed
        dr2 = admin.delete(f"{API}/persons/{unused_ref['id']}", timeout=30)
        assert dr2.status_code == 200
        remaining2 = {c["id"] for c in admin.get(f"{API}/persons/{referrer['id']}/coupons", timeout=30).json()}
        assert unused_c["id"] not in remaining2, "UNUSED coupon not deleted with referred person"
        assert used_c["id"] in remaining2

    def test_delete_referrer_keeps_used_coupons(self, admin, cleanup_persons, cleanup_coupons):
        sid = _source_id(admin)
        referrer = _create_person(admin, "TEST_Referrer_E", sid)
        cleanup_coupons.append(referrer["id"])
        r1 = _create_person(admin, "TEST_Referred_E1", sid, referred_by=referrer["id"])
        r2 = _create_person(admin, "TEST_Referred_E2", sid, referred_by=referrer["id"])
        cleanup_persons += [r1["id"], r2["id"]]
        coupons = admin.get(f"{API}/persons/{referrer['id']}/coupons", timeout=30).json()
        used_c, keep_unused = coupons[0], coupons[1]
        admin.patch(f"{API}/coupons/{used_c['id']}", json={"status": "used"}, timeout=30)

        assert admin.delete(f"{API}/persons/{referrer['id']}", timeout=30).status_code == 200
        cli, dbx = _mongo()
        try:
            assert dbx.coupons.find_one({"id": used_c["id"]}) is not None, "USED coupon deleted with referrer"
            assert dbx.coupons.find_one({"id": keep_unused["id"]}) is None, "UNUSED coupon kept after referrer delete"
            # referral pointers cleared
            assert dbx.persons.find_one({"id": r1["id"]})["referred_by_person_id"] is None
        finally:
            cli.close()

    @pytest.mark.skipif(
        os.environ.get("RUN_RESTART_TESTS") != "1",
        reason="restarts backend; run standalone with RUN_RESTART_TESTS=1 (verified PASS)",
    )
    def test_backfill_creates_missing_coupons(self, admin, cleanup_persons, cleanup_coupons):
        """Simulate legacy data: referral pair without coupon -> backfill on startup creates it."""
        sid = _source_id(admin)
        referrer = _create_person(admin, "TEST_Referrer_F", sid)
        cleanup_persons.append(referrer["id"])
        cleanup_coupons.append(referrer["id"])
        ref = _create_person(admin, "TEST_Referred_F1", sid, referred_by=referrer["id"])
        cleanup_persons.append(ref["id"])
        cli, dbx = _mongo()
        try:
            dbx.coupons.delete_many({"person_id": referrer["id"]})
            assert dbx.coupons.count_documents({"person_id": referrer["id"]}) == 0
        finally:
            cli.close()
        import subprocess, time
        subprocess.run(["sudo", "supervisorctl", "restart", "backend"], capture_output=True)
        for _ in range(30):
            time.sleep(2)
            try:
                if admin.get(f"{API}/ref/sources", timeout=10).status_code == 200:
                    break
            except Exception:
                pass
        coupons = admin.get(f"{API}/persons/{referrer['id']}/coupons", timeout=30).json()
        assert len(coupons) == 1, f"backfill did not create coupon: {coupons}"
        assert coupons[0]["status"] == "unused" and coupons[0]["discount_pct"] == 15

    def test_access_control(self, admin, consultant, consultant_login, cleanup_persons, cleanup_coupons):
        sid = _source_id(admin)
        cons_id = consultant_login["user"]["id"]
        # person NOT assigned to consultant
        other = _create_person(admin, "TEST_Referrer_G_other", sid)
        cleanup_persons.append(other["id"])
        cleanup_coupons.append(other["id"])
        o_ref = _create_person(admin, "TEST_Referred_G_other", sid, referred_by=other["id"])
        cleanup_persons.append(o_ref["id"])

        # person assigned to consultant
        mine = _create_person(admin, "TEST_Referrer_G_mine", sid, assigned_to=cons_id)
        cleanup_persons.append(mine["id"])
        cleanup_coupons.append(mine["id"])
        m_ref = _create_person(admin, "TEST_Referred_G_mine", sid, referred_by=mine["id"], assigned_to=cons_id)
        cleanup_persons.append(m_ref["id"])

        assert consultant.get(f"{API}/persons/{other['id']}/coupons", timeout=30).status_code == 403
        assert admin.get(f"{API}/persons/{other['id']}/coupons", timeout=30).status_code == 200

        ok = consultant.get(f"{API}/persons/{mine['id']}/coupons", timeout=30)
        assert ok.status_code == 200, ok.text[:300]
        my_coupon = ok.json()[0]
        other_coupon = admin.get(f"{API}/persons/{other['id']}/coupons", timeout=30).json()[0]

        # consultant cannot patch a coupon of a non-assigned person
        assert consultant.patch(f"{API}/coupons/{other_coupon['id']}", json={"status": "used"}, timeout=30).status_code == 403
        # consultant can patch own assigned person's coupon
        pr = consultant.patch(f"{API}/coupons/{my_coupon['id']}", json={"status": "used"}, timeout=30)
        assert pr.status_code == 200, pr.text[:300]
        assert pr.json()["status"] == "used"

    def test_coupons_404_for_unknown_person(self, admin):
        r = admin.get(f"{API}/persons/no-such-person/coupons", timeout=30)
        assert r.status_code == 404, r.status_code
