"""Server-only Supabase Data API client (no third-party dependencies)."""
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen, HTTPRedirectHandler, build_opener


class DatabaseError(Exception):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward credentials to a redirect target.


def load_env(path):
    """Small dotenv subset: NAME=value, optional quotes; process env takes priority."""
    path = Path(path)
    if not path.exists():
        return
    for number, line in enumerate(path.read_text(encoding='utf-8-sig').splitlines(), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('export '):
            line = line[7:]
        key, sep, value = line.partition('=')
        key, value = key.strip(), value.strip()
        if not sep or not key.isidentifier():
            raise DatabaseError(f'Invalid .env entry at line {number}')
        if value[:1] in ('"', "'"):
            if len(value) < 2 or value[-1] != value[0]:
                raise DatabaseError(f'Invalid .env quotes at line {number}')
            value = value[1:-1]
        else:
            value = value.split(' #', 1)[0].rstrip()
        os.environ.setdefault(key, value)


class Supabase:
    def __init__(self):
        url = os.environ.get('SUPABASE_URL', '').rstrip('/')
        self.key = os.environ.get('SUPABASE_SECRET_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
        parts = urlsplit(url)
        if parts.scheme != 'https' or not parts.hostname or parts.username or parts.password or parts.query or parts.fragment or parts.path:
            raise DatabaseError('SUPABASE_URL must be an HTTPS project origin')
        if not self.key or self.key.startswith('sb_publishable_'):
            raise DatabaseError('Set the server-only SUPABASE_SECRET_KEY in .env')
        self.url = url + '/rest/v1/rpc/fishing_api'
        try:
            self.opener = build_opener(NoRedirect())
        except OSError:
            raise DatabaseError('Cannot initialize HTTPS; check the Python TLS installation') from None

    def rpc(self, action, payload=None):
        headers = {'apikey': self.key, 'Content-Type': 'application/json'}
        # New secret keys are not JWTs; only legacy service_role needs Bearer.
        if not self.key.startswith('sb_secret_'):
            headers['Authorization'] = 'Bearer ' + self.key
        request = Request(self.url, json.dumps({'action': action, 'payload': payload or {}}, allow_nan=False).encode(), headers, method='POST')
        try:
            with self.opener.open(request, timeout=15) as response:
                return json.load(response)
        except HTTPError as exc:
            # Do not expose response bodies, request headers or secrets in logs.
            raise DatabaseError(f'Supabase API HTTP {exc.code}') from None
        except (URLError, TimeoutError, OSError, ValueError):
            raise DatabaseError('Supabase API unavailable or invalid response') from None


def game(client, action, data, uid):
    result = client.rpc(action, {'uid': uid, 'data': data})
    return result['status'], result['body']


def register(client, data, headers=None):
    import auth
    username, password = data.get('username'), data.get('password')
    if not isinstance(username, str) or not auth.USERNAME_RE.fullmatch(username.strip()):
        return 400, {'ok': False, 'error': 'Логин — 3–20 символов: буквы, цифры, точка, дефис или подчёркивание.'}, None
    if not isinstance(password, str) or len(password) < auth.MIN_PASSWORD_LEN:
        return 400, {'ok': False, 'error': 'Пароль — минимум 6 символов.'}, None
    import secrets
    import time
    token = secrets.token_urlsafe(32)
    result = client.rpc('register', {'username': username.strip(), 'password_hash': auth.hash_password(password),
                                    'token': token, 'expires_at': time.time() + auth.SESSION_TTL})
    if result.get('error'):
        return 400, {'ok': False, 'error': result['error']}, None
    return 200, {'ok': True, 'username': result['username']}, auth.set_cookie(token)


def login(client, data, headers=None):
    import auth
    import time
    import secrets
    username, password = data.get('username'), data.get('password')
    if not isinstance(username, str) or not isinstance(password, str):
        return 400, {'ok': False, 'error': 'Некорректный запрос'}, None
    row = client.rpc('login_lookup', {'username': username.strip()})
    if not row or not auth.verify_password(password, row['password_hash']):
        time.sleep(.3)
        return 401, {'ok': False, 'error': 'Неверный логин или пароль.'}, None
    token = secrets.token_urlsafe(32)
    client.rpc('session_create', {'uid': row['uid'], 'token': token, 'expires_at': time.time() + auth.SESSION_TTL})
    return 200, {'ok': True, 'username': row['username']}, auth.set_cookie(token)


def logout(client, data, headers=None):
    import auth
    client.rpc('session_drop', {'token': auth.cookie_token(headers.get('Cookie') if headers else None)})
    return 200, {'ok': True}, auth.CLEAR_COOKIE


def current_user(client, headers):
    import auth
    import time
    token = auth.cookie_token(headers.get('Cookie'))
    if not token:
        return None
    row = client.rpc('session_user', {'token': token, 'now': time.time()})
    return (row['uid'], row['username']) if row else None
