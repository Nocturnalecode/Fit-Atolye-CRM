"""Auth module tests: login, JWT bearer, /auth/me, role, security posture."""
import requests
from conftest import API


class TestAuth:
    def test_admin_login(self, credentials, anon):
        r = anon.post(f"{API}/auth/login", json=credentials["admin"])
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("token"), str) and len(data["token"]) > 20
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == credentials["admin"]["email"].lower()
        assert "password_hash" not in data["user"]

    def test_consultant_login(self, credentials, anon):
        r = anon.post(f"{API}/auth/login", json=credentials["consultant"])
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "consultant"

    def test_login_wrong_password(self, credentials, anon):
        r = anon.post(f"{API}/auth/login", json={"email": credentials["admin"]["email"], "password": "WrongPass1!"})
        assert r.status_code == 401
        assert "detail" in r.json()

    def test_login_unknown_email(self, anon):
        r = anon.post(f"{API}/auth/login", json={"email": "nobody_TEST@example.com", "password": "x"})
        assert r.status_code == 401

    def test_login_invalid_email_format(self, anon):
        r = anon.post(f"{API}/auth/login", json={"email": "not-an-email", "password": "x"})
        assert r.status_code == 422

    def test_me_with_token(self, admin, credentials):
        r = admin.get(f"{API}/auth/me")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == credentials["admin"]["email"].lower()
        assert data["role"] == "admin"
        assert "_id" not in data and "password_hash" not in data

    def test_me_without_token(self, anon):
        r = anon.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_bad_token(self, anon):
        r = anon.get(f"{API}/auth/me", headers={"Authorization": "Bearer garbage.token.value"})
        assert r.status_code == 401

    def test_logout_endpoint_exists(self, admin):
        """credentials file documents POST /api/auth/logout"""
        r = admin.post(f"{API}/auth/logout")
        assert r.status_code != 404, "POST /api/auth/logout documented in test_credentials.md but returns 404"

    def test_login_sets_httponly_cookie(self, credentials):
        """auth.py falls back to access_token cookie; verify login actually sets it."""
        r = requests.post(f"{API}/auth/login", json=credentials["admin"], timeout=30)
        assert "access_token" in r.cookies, "login does not set httpOnly access_token cookie"

    def test_bruteforce_lockout(self):
        """6 consecutive bad logins should lock/throttle (expect 423/429).

        Uses a throwaway identifier so real seeded accounts are not locked for 15 min
        (lockout key is client_ip:email).
        """
        probe = "test_lockout_probe@fitatolye.com"
        codes = []
        try:
            for _ in range(6):
                r = requests.post(f"{API}/auth/login",
                                  json={"email": probe, "password": "Bad!123456"},
                                  timeout=30)
                codes.append(r.status_code)
            assert any(c in (423, 429) for c in codes), (
                f"no brute-force lockout, codes={codes}. RCA: login_attempts identifier is "
                "f'{request.client.host}:{email}' and the ingress fronts requests from multiple "
                "proxy IPs, so failed attempts are split across identifiers and the 5-fail "
                "threshold is never reached reliably. Key the counter on email (or X-Forwarded-For).")
        finally:
            try:
                from conftest import _mongo
                cli, dbx = _mongo()
                dbx.login_attempts.delete_many({"identifier": {"$regex": f"{probe}$"}})
                cli.close()
            except Exception as exc:
                print(f"lockout cleanup skipped: {exc}")

    def test_valid_login_works_when_not_locked(self, credentials):
        """Valid credentials must succeed when no active lockout exists."""
        try:
            from conftest import _mongo
            cli, dbx = _mongo()
            dbx.login_attempts.delete_many(
                {"identifier": {"$regex": f"{credentials['consultant']['email']}$"}})
            cli.close()
        except Exception as exc:
            print(f"pre-clean skipped: {exc}")
        r = requests.post(f"{API}/auth/login", json=credentials["consultant"], timeout=30)
        assert r.status_code == 200, r.text
        assert "token" in r.json()


class TestCors:
    def test_cors_credentials_not_wildcard(self, credentials):
        origin = "https://evil.example.com"
        r = requests.post(f"{API}/auth/login", json=credentials["admin"],
                          headers={"Origin": origin}, timeout=30)
        acao = r.headers.get("access-control-allow-origin")
        acac = r.headers.get("access-control-allow-credentials")
        assert not (acac == "true" and acao in ("*", origin)), (
            f"CORS reflects arbitrary origin ({acao}) with Allow-Credentials:true - "
            "allow_origins must be an explicit list, not ['*']"
        )
