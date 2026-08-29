"""Shared fixtures for FitAtolye CRM backend tests."""
import os
import re
import random
import itertools
from pathlib import Path
from datetime import datetime, timezone, timedelta

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
_base = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not _base:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing from env and /app/frontend/.env")
BASE_URL = _base.rstrip("/")
API = f"{BASE_URL}/api"


def d(days: int = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).date().isoformat()


def _mongo():
    from pymongo import MongoClient
    env = dotenv_values("/app/backend/.env")
    cli = MongoClient(env["MONGO_URL"])
    return cli, cli[env["DB_NAME"]]


_PHONE_SEQ = itertools.count(1)
_RUN_TAG = str(random.randint(1000, 9999))


def uniq_phone() -> str:
    """Unique phone per test run to avoid duplicate-detection collisions."""
    return f"05{_RUN_TAG} {next(_PHONE_SEQ):03d} {random.randint(1000, 9999)}"


@pytest.fixture(scope="session")
def credentials():
    """Read credentials from /app/memory/test_credentials.md"""
    path = Path("/app/memory/test_credentials.md")
    if not path.exists():
        pytest.skip("Missing /app/memory/test_credentials.md")
    content = path.read_text(encoding="utf-8")
    admin_email = re.search(r"(?im)^-\s*Email:\s*(\S+)", content)
    admin_pw = re.search(r"(?im)^-\s*Password:\s*(\S+)", content)
    cons = re.search(r"(?im)^-\s*Email:\s*(\S+)\s*\|\s*Password:\s*(\S+)", content)
    if not admin_email or not admin_pw or not cons:
        pytest.skip("Could not parse credentials file")
    return {
        "admin": {"email": admin_email.group(1), "password": admin_pw.group(1)},
        "consultant": {"email": cons.group(1), "password": cons.group(2)},
    }


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {email}: {r.status_code} {r.text[:300]}")
    return r.json()


@pytest.fixture(scope="session")
def admin_login(credentials):
    return _login(credentials["admin"]["email"], credentials["admin"]["password"])


@pytest.fixture(scope="session")
def consultant_login(credentials):
    return _login(credentials["consultant"]["email"], credentials["consultant"]["password"])


def _client(token=None):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="class")
def anon():
    return _client()


@pytest.fixture(scope="class")
def admin(admin_login):
    return _client(admin_login["token"])


@pytest.fixture(scope="class")
def consultant(consultant_login):
    return _client(consultant_login["token"])


@pytest.fixture(scope="class")
def cleanup_misc():
    """Remove TEST_ products and year-2099 targets created by tests (no DELETE endpoints exist)."""
    yield
    try:
        cli, dbx = _mongo()
        dbx.products.delete_many({"name": {"$regex": "^TEST_"}})
        dbx.targets.delete_many({"year": 2099})
        cli.close()
    except Exception as exc:  # pragma: no cover
        print(f"cleanup skipped: {exc}")


@pytest.fixture(scope="class")
def a_product(admin, cleanup_misc):
    """Return an existing product, or create a TEST_ one (demo products were purged)."""
    items = admin.get(f"{API}/products", timeout=30).json()
    if items:
        return items[0]
    r = admin.post(f"{API}/products", json={"name": "TEST_SaleProduct", "price": 250.0, "active": True}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="class")
def cleanup_coupons():
    """Remove coupons (incl. USED ones kept by cascade rules) for tracked referrer ids."""
    ids = []
    yield ids
    if not ids:
        return
    try:
        cli, dbx = _mongo()
        dbx.coupons.delete_many({"person_id": {"$in": ids}})
        cli.close()
    except Exception as exc:  # pragma: no cover
        print(f"coupon cleanup skipped: {exc}")


@pytest.fixture(scope="class")
def cleanup_persons():
    """Remove TEST_ prefixed persons and their child records after class."""
    ids = []
    yield ids
    if not ids:
        return
    try:
        from pymongo import MongoClient
        env = dotenv_values("/app/backend/.env")
        cli = MongoClient(env["MONGO_URL"])
        dbx = cli[env["DB_NAME"]]
        dbx.persons.delete_many({"id": {"$in": ids}})
        for col in ("memberships", "payments", "measurements", "product_sales", "contacts", "tasks", "appointments"):
            dbx[col].delete_many({"person_id": {"$in": ids}})
        cli.close()
    except Exception as exc:  # pragma: no cover
        print(f"cleanup skipped: {exc}")
