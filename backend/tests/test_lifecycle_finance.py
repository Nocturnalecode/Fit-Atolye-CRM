"""Lead->Customer conversion, memberships, payments, measurements, product sales, financial summary."""
import pytest
from conftest import API, d, uniq_phone


def _make_lead(client, cleanup, name, assigned_to=None):
    src = client.get(f"{API}/ref/sources").json()[0]["id"]
    payload = {"name": name, "phone": uniq_phone(), "source_id": src, "request_date": d(0)}
    if assigned_to:
        payload["assigned_to"] = assigned_to
    r = client.post(f"{API}/persons", json=payload)
    assert r.status_code == 200, r.text
    p = r.json()
    assert "id" in p, p
    cleanup.append(p["id"])
    return p


class TestConversion:
    def test_convert_pesin_creates_membership_and_single_payment(self, admin, cleanup_persons):
        lead = _make_lead(admin, cleanup_persons, "TEST_ConvPesin")
        body = {"start_date": d(0), "monthly_fee": 6000, "payment_method": "Havale/EFT",
                "payment_plan": "peşin"}
        r = admin.post(f"{API}/persons/{lead['id']}/convert", json=body)
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["status"] == "Aktif"
        assert m["start_date"] == d(0)
        assert m["end_date"] == d(30), f"end_date should be start+30, got {m['end_date']}"
        assert m["monthly_fee"] == 6000
        person = admin.get(f"{API}/persons/{lead['id']}").json()
        assert person["lifecycle_status"] == "customer"
        assert person["customer_since"] == d(0)
        mems = admin.get(f"{API}/memberships", params={"person_id": lead["id"]}).json()
        assert len(mems) == 1 and mems[0]["id"] == m["id"]
        pays = admin.get(f"{API}/payments", params={"person_id": lead["id"]}).json()
        assert len(pays) == 1, f"peşin should create 1 payment, got {len(pays)}"
        assert pays[0]["status"] == "Ödendi"
        assert pays[0]["amount"] == 6000
        assert pays[0]["membership_id"] == m["id"]

    def test_convert_4w_creates_four_installments(self, admin, cleanup_persons):
        lead = _make_lead(admin, cleanup_persons, "TEST_Conv4w")
        r = admin.post(f"{API}/persons/{lead['id']}/convert",
                       json={"start_date": d(0), "monthly_fee": 8000,
                             "payment_method": "Kredi kartı", "payment_plan": "4w"})
        assert r.status_code == 200, r.text
        pays = admin.get(f"{API}/payments", params={"person_id": lead["id"]}).json()
        assert len(pays) == 4, f"4w should create 4 payments, got {len(pays)}"
        assert sum(p["amount"] for p in pays) == 8000
        assert [p["status"] for p in pays] == ["Ödendi", "Bekliyor", "Bekliyor", "Bekliyor"]
        assert [p["due_date"] for p in pays] == [d(0), d(7), d(14), d(21)]

    def test_convert_unknown_person_404(self, admin):
        r = admin.post(f"{API}/persons/nope-555/convert",
                       json={"start_date": d(0), "monthly_fee": 100,
                             "payment_method": "Havale/EFT", "payment_plan": "peşin"})
        assert r.status_code == 404

    def test_consultant_cannot_convert_others_lead(self, admin, consultant, consultant_login):
        others = [p for p in admin.get(f"{API}/persons", params={"lifecycle": "lead"}).json()
                  if p.get("assigned_to") != consultant_login["user"]["id"]]
        assert others
        r = consultant.post(f"{API}/persons/{others[0]['id']}/convert",
                            json={"start_date": d(0), "monthly_fee": 100,
                                  "payment_method": "Havale/EFT", "payment_plan": "peşin"})
        assert r.status_code == 403


class TestMembershipLifecycle:
    @pytest.fixture(scope="class")
    def customer(self, admin, cleanup_persons):
        lead = _make_lead(admin, cleanup_persons, "TEST_MemCust")
        m = admin.post(f"{API}/persons/{lead['id']}/convert",
                       json={"start_date": d(0), "monthly_fee": 5000,
                             "payment_method": "Havale/EFT", "payment_plan": "peşin"}).json()
        return {"person": lead, "membership": m}

    def test_freeze_days_extends_end_date(self, admin, customer):
        mid = customer["membership"]["id"]
        r = admin.patch(f"{API}/memberships/{mid}", json={"freeze_days": 7})
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["end_date"] == d(37), f"freeze 7 days should extend end_date to {d(37)}, got {m['end_date']}"
        assert m["freeze_days"] == 7

    def test_refund_calculation(self, admin, customer):
        mid = customer["membership"]["id"]
        r = admin.post(f"{API}/memberships/{mid}/refund", params={"days_used": 10})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["unused_days"] == 16
        assert data["daily_fee"] == round(5000 / 26, 2)
        assert data["refund_amount"] == round(16 * (5000 / 26), 2)

    def test_graduate_status_updates_person(self, admin, customer):
        mid = customer["membership"]["id"]
        r = admin.patch(f"{API}/memberships/{mid}", json={"status": "Mezun edildi"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "Mezun edildi"
        person = admin.get(f"{API}/persons/{customer['person']['id']}").json()
        assert person["lifecycle_status"] == "graduate"

    def test_patch_unknown_membership_404(self, admin):
        assert admin.patch(f"{API}/memberships/nope-666", json={"status": "Aktif"}).status_code == 404


class TestPaymentsMeasurementsSales:
    @pytest.fixture(scope="class")
    def customer(self, admin, cleanup_persons, consultant_login):
        lead = _make_lead(admin, cleanup_persons, "TEST_FinCust",
                          assigned_to=consultant_login["user"]["id"])
        m = admin.post(f"{API}/persons/{lead['id']}/convert",
                       json={"start_date": d(0), "monthly_fee": 4000,
                             "payment_method": "Havale/EFT", "payment_plan": "peşin"}).json()
        return {"person": lead, "membership": m}

    def test_overdue_payment_marked_gecikmis(self, admin, customer):
        pid = customer["person"]["id"]
        r = admin.post(f"{API}/payments", json={"person_id": pid, "amount": 1000,
                                                "due_date": d(-5), "method": "Havale/EFT",
                                                "status": "Bekliyor", "note": "TEST gecikmiş"})
        assert r.status_code == 200, r.text
        pay_id = r.json()["id"]
        listed = {p["id"]: p for p in admin.get(f"{API}/payments", params={"person_id": pid}).json()}
        assert listed[pay_id]["status"] == "Gecikmiş", "overdue payment not shown as Gecikmiş"
        overdue = admin.get(f"{API}/payments", params={"person_id": pid, "overdue": "true"}).json()
        assert pay_id in [p["id"] for p in overdue]

    def test_payment_mark_paid_sets_paid_date(self, admin, customer):
        pid = customer["person"]["id"]
        pay = admin.post(f"{API}/payments", json={"person_id": pid, "amount": 500,
                                                  "due_date": d(3), "method": "Kredi kartı"}).json()
        r = admin.patch(f"{API}/payments/{pay['id']}", json={"status": "Ödendi"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "Ödendi"
        assert r.json()["paid_date"] == d(0)
        dele = admin.delete(f"{API}/payments/{pay['id']}")
        assert dele.status_code == 200
        assert pay["id"] not in [p["id"] for p in admin.get(f"{API}/payments", params={"person_id": pid}).json()]

    def test_measurement_rejected_for_lead(self, admin, cleanup_persons):
        lead = _make_lead(admin, cleanup_persons, "TEST_MeasLead")
        r = admin.post(f"{API}/measurements", json={"person_id": lead["id"], "date": d(0), "weight": 80})
        assert r.status_code == 400, f"measurement on lead should be 400, got {r.status_code}"

    def test_measurement_for_customer(self, admin, customer):
        pid = customer["person"]["id"]
        r = admin.post(f"{API}/measurements", json={"person_id": pid, "date": d(0),
                                                    "weight": 85.5, "bmi": 27.1, "note": "TEST ölçüm"})
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["weight"] == 85.5 and m["user_name"]
        got = admin.get(f"{API}/measurements", params={"person_id": pid}).json()
        assert any(x["id"] == m["id"] and x["bmi"] == 27.1 for x in got)
        upd = admin.patch(f"{API}/measurements/{m['id']}",
                          json={"person_id": pid, "date": d(0), "weight": 84.0})
        assert upd.status_code == 200, upd.text
        assert upd.json()["weight"] == 84.0
        assert admin.delete(f"{API}/measurements/{m['id']}").status_code == 200

    def test_product_sale_rejected_for_lead(self, admin, cleanup_persons, a_product):
        lead = _make_lead(admin, cleanup_persons, "TEST_SaleLead")
        prod = a_product
        r = admin.post(f"{API}/product-sales", json={"person_id": lead["id"], "product_id": prod["id"],
                                                     "qty": 1, "unit_price": prod["price"],
                                                     "sale_date": d(0), "method": "Nakit"})
        assert r.status_code == 400, f"expected 400 for lead sale, got {r.status_code}"

    def test_product_sale_for_customer_and_scoping(self, admin, consultant, customer, a_product):
        pid = customer["person"]["id"]
        prod = a_product
        r = consultant.post(f"{API}/product-sales", json={"person_id": pid, "product_id": prod["id"],
                                                          "qty": 2, "unit_price": 300.0,
                                                          "sale_date": d(0), "method": "Nakit"})
        assert r.status_code == 200, r.text
        sale = r.json()
        assert sale["product_name"] == prod["name"]
        assert sale["seller_name"]
        listed = admin.get(f"{API}/product-sales", params={"person_id": pid}).json()
        assert any(s["id"] == sale["id"] and s["qty"] == 2 for s in listed)

    def test_consultant_cannot_sell_to_other_consultants_customer(self, admin, consultant, consultant_login, a_product):
        cust = [p for p in admin.get(f"{API}/persons", params={"lifecycle": "customer"}).json()
                if p.get("assigned_to") != consultant_login["user"]["id"]]
        if not cust:
            pytest.skip("no customer assigned to another consultant")
        prod = a_product
        r = consultant.post(f"{API}/product-sales", json={"person_id": cust[0]["id"], "product_id": prod["id"],
                                                          "qty": 1, "unit_price": 100.0,
                                                          "sale_date": d(0), "method": "Nakit"})
        assert r.status_code == 403

    def test_financial_summary(self, admin, customer):
        pid = customer["person"]["id"]
        r = admin.get(f"{API}/persons/{pid}/financial")
        assert r.status_code == 200, r.text
        f = r.json()
        for key in ("paid_membership", "pending_membership", "total", "total_receivable"):
            assert key in f
        assert f["paid_membership"] >= 4000
        assert f["total"] == (f["paid_membership"] + f["paid_product"] + f["pending_membership"]
                              + f["pending_product"] + f["partial_membership"] + f["partial_product"])
        assert f["total_receivable"] == (f["pending_membership"] + f["pending_product"]
                                         + f["partial_membership"] + f["partial_product"])

    def test_payments_list_scoped_for_consultant(self, admin, consultant, consultant_login):
        """A consultant should not see payments of persons assigned to other consultants."""
        all_persons = {p["id"]: p for p in admin.get(f"{API}/persons").json()}
        pays = consultant.get(f"{API}/payments").json()
        foreign = [p for p in pays
                   if all_persons.get(p["person_id"], {}).get("assigned_to") not in
                   (None, consultant_login["user"]["id"])]
        assert not foreign, f"consultant sees {len(foreign)} payments belonging to other consultants"
