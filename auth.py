"""Аккаунты игроков: регистрация, вход, сессии и миграция личных сохранений.

У каждого пользователя собственный прогресс (деньги, наживка, улов, задания,
достижения). Пароли хранятся только в виде PBKDF2-хеша, вход держится на
HttpOnly-cookie «fishing_session» с токеном сессии из таблицы session.
"""
import hashlib, hmac, http.cookies, re, secrets, time

PBKDF2_ITERATIONS = 100_000
SESSION_TTL = 30 * 24 * 3600                      # 30 дней между входами
COOKIE = 'fishing_session'
# Старое общее сохранение (player.id=1) переезжает в этот аккаунт при миграции.
LEGACY_USER, LEGACY_PASSWORD = 'fisherman', 'fisherman'
USERNAME_RE = re.compile(r'^[A-Za-zА-Яа-яЁё0-9_.-]{3,20}$')
MIN_PASSWORD_LEN = 6
STARTER_BAITS = (('worm', 10), ('maggot', 5))     # стартовый набор, как у старого игрока id=1

CLEAR_COOKIE = f'{COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'


def set_cookie(token):
    return f'{COOKIE}={token}; Path=/; Max-Age={SESSION_TTL}; HttpOnly; SameSite=Lax'


def cookie_token(header):
    """Достаёт токен сессии из заголовка Cookie; None, если его нет."""
    if not header:
        return None
    try:
        morsel = http.cookies.SimpleCookie(header).get(COOKIE)
        return morsel.value if morsel else None
    except http.cookies.CookieError:
        return None


# ---------- пароли ----------
def hash_password(password, salt=None, iterations=PBKDF2_ITERATIONS):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), bytes.fromhex(salt), iterations)
    return f'pbkdf2_sha256${iterations}${salt}${digest.hex()}'


def verify_password(password, stored):
    try:
        _, iterations, salt, digest = stored.split('$')
        candidate = hash_password(password, salt, int(iterations))
    except (ValueError, TypeError, AttributeError):
        return False
    return hmac.compare_digest(candidate.rsplit('$', 1)[1], digest)


# ---------- регистрация и вход ----------
def register(c, username, password):
    """Создаёт аккаунт и стартовый профиль. Возвращает (user_id, None) или (None, текст ошибки)."""
    username = (username or '').strip()
    if not USERNAME_RE.match(username):
        return None, 'Логин — 3–20 символов: буквы, цифры, точка, дефис или подчёркивание.'
    if not password or len(password) < MIN_PASSWORD_LEN:
        return None, f'Пароль — минимум {MIN_PASSWORD_LEN} символов.'
    if c.execute('SELECT 1 FROM user WHERE username=?', (username,)).fetchone():
        return None, 'Такой логин уже занят.'
    c.execute('INSERT INTO user(username,password_hash) VALUES (?,?)', (username, hash_password(password)))
    uid = c.execute('SELECT id FROM user WHERE username=?', (username,)).fetchone()[0]
    _create_profile(c, uid)
    return uid, None


def authenticate(c, username, password):
    """Проверяет логин и пароль. Возвращает (user_id, None) или (None, текст ошибки)."""
    row = c.execute('SELECT id,password_hash FROM user WHERE username=?',
                    ((username or '').strip(),)).fetchone()
    if not row or not verify_password(password or '', row['password_hash']):
        return None, 'Неверный логин или пароль.'
    return row['id'], None


def _create_profile(c, uid):
    """Стартовое состояние рыбака: 200 ₽ и стартовый набор наживки."""
    c.execute('INSERT OR IGNORE INTO player(user_id) VALUES (?)', (uid,))
    for code, qty in STARTER_BAITS:
        bait = c.execute('SELECT id FROM bait WHERE code=?', (code,)).fetchone()
        if bait:
            c.execute('INSERT OR IGNORE INTO player_bait(user_id,bait_id,qty) VALUES (?,?,?)',
                      (uid, bait['id'], qty))


# ---------- сессии ----------
def create_session(c, uid):
    """Новый токен сессии; просроченные записи подчищаются попутно."""
    token = secrets.token_urlsafe(32)
    now = time.time()
    c.execute('DELETE FROM session WHERE expires_at < ?', (now,))
    c.execute('INSERT INTO session(token,user_id,expires_at) VALUES (?,?,?)', (token, uid, now + SESSION_TTL))
    return token


def session_user(c, header):
    """(user_id, username) по cookie сессии, иначе None."""
    token = cookie_token(header)
    if not token:
        return None
    row = c.execute('''SELECT u.id, u.username FROM session s JOIN user u ON u.id=s.user_id
                       WHERE s.token=? AND s.expires_at>?''', (token, time.time())).fetchone()
    return (row['id'], row['username']) if row else None


def drop_session(c, token):
    if token:
        c.execute('DELETE FROM session WHERE token=?', (token,))


# ---------- миграция старых сохранений ----------
def migrate(c):
    """Идемпотентный перевод существующего сохранения на личные аккаунты.

    Старая схема хранила единственного игрока (player.id=1), общим для всех
    посетителей URL. Он переезжает в аккаунт fisherman (пароль fisherman),
    а новые регистрации получают собственные строки player/player_bait/... .
    """
    c.executescript('''
        CREATE TABLE IF NOT EXISTS user(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL COLLATE NOCASE,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')));
        CREATE TABLE IF NOT EXISTS session(
          token TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          expires_at REAL NOT NULL);''')
    cols = {r[1] for r in c.execute('PRAGMA table_info(player)')}
    if cols and 'user_id' not in cols:
        uid = _legacy_uid(c)
        _rebuild_player(c, uid)
        _rebuild_player_bait(c, uid)
        _tag_user(c, 'catch', uid)
        _tag_user(c, 'quest', uid)
        _rebuild_achievement(c, uid)
        _rebuild_active_cast(c, uid)
    # Страховка: у каждого аккаунта есть профиль (для старых БД с частичными данными).
    c.execute('INSERT INTO player(user_id) SELECT id FROM user WHERE id NOT IN (SELECT user_id FROM player)')
    c.commit()


def _legacy_uid(c):
    """Аккаунт, в который переезжает старое общее сохранение (player.id=1)."""
    row = c.execute('SELECT id FROM user WHERE username=?', (LEGACY_USER,)).fetchone()
    if row:
        return row['id']
    c.execute('INSERT INTO user(username,password_hash) VALUES (?,?)',
              (LEGACY_USER, hash_password(LEGACY_PASSWORD)))
    print(f'Старое общее сохранение перенесено в аккаунт «{LEGACY_USER}» '
          f'(пароль «{LEGACY_PASSWORD}»). Войдите под ним, чтобы продолжить прежний прогресс.', flush=True)
    return c.execute('SELECT id FROM user WHERE username=?', (LEGACY_USER,)).fetchone()[0]


def _rebuild_player(c, uid):
    c.execute('ALTER TABLE player RENAME TO player_migrate_old')
    c.execute('''CREATE TABLE player(
        user_id INTEGER PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
        money INTEGER NOT NULL DEFAULT 200,
        tutorial_done INTEGER NOT NULL DEFAULT 0,
        boat_owned INTEGER NOT NULL DEFAULT 0,
        bells_owned INTEGER NOT NULL DEFAULT 0,
        rod_level INTEGER NOT NULL DEFAULT 1)''')
    c.execute('''INSERT INTO player(user_id,money,tutorial_done,boat_owned,bells_owned,rod_level)
                 SELECT ?,money,tutorial_done,boat_owned,bells_owned,rod_level FROM player_migrate_old''', (uid,))
    c.execute('DROP TABLE player_migrate_old')


def _rebuild_player_bait(c, uid):
    c.execute('ALTER TABLE player_bait RENAME TO player_bait_migrate_old')
    c.execute('''CREATE TABLE player_bait(
        user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        bait_id INTEGER NOT NULL REFERENCES bait(id),
        qty INTEGER NOT NULL DEFAULT 0 CHECK(qty>=0),
        PRIMARY KEY(user_id,bait_id))''')
    c.execute('INSERT INTO player_bait(user_id,bait_id,qty) SELECT ?,bait_id,qty FROM player_bait_migrate_old', (uid,))
    c.execute('DROP TABLE player_bait_migrate_old')


def _tag_user(c, table, uid):
    """Таблицам без составного ключа (catch, quest) достаточно колонки user_id."""
    cols = {r[1] for r in c.execute(f'PRAGMA table_info({table})')}
    if 'user_id' not in cols:
        c.execute(f'ALTER TABLE {table} ADD COLUMN user_id INTEGER')
    c.execute(f'UPDATE {table} SET user_id=? WHERE user_id IS NULL', (uid,))


def _rebuild_achievement(c, uid):
    c.execute('ALTER TABLE achievement RENAME TO achievement_migrate_old')
    c.execute('''CREATE TABLE achievement(
        user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        code TEXT NOT NULL, unlocked_at TEXT NOT NULL,
        PRIMARY KEY(user_id,code))''')
    c.execute('''INSERT INTO achievement(user_id,code,unlocked_at)
                 SELECT ?,code,unlocked_at FROM achievement_migrate_old''', (uid,))
    c.execute('DROP TABLE achievement_migrate_old')


def _rebuild_active_cast(c, uid):
    c.execute('ALTER TABLE active_cast RENAME TO active_cast_migrate_old')
    c.execute('''CREATE TABLE active_cast(
        user_id INTEGER PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
        location_id INTEGER NOT NULL, bait_id INTEGER NOT NULL, ready_at REAL NOT NULL)''')
    c.execute('''INSERT INTO active_cast(user_id,location_id,bait_id,ready_at)
                 SELECT ?,location_id,bait_id,ready_at FROM active_cast_migrate_old''', (uid,))
    c.execute('DROP TABLE active_cast_migrate_old')
