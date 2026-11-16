"""Сервер игры «Рыбалка»: только стандартная библиотека Python 3.8+.
Запуск: python server.py  ->  http://localhost:8000"""
import json, os, random, sqlite3, sys, time
from contextlib import closing
from sea import migrate as migrate_sea, BOAT_PRICE, BELLS_PRICE, MIN_CATCH_SECONDS, ROD_PRICES
import auth
import world
from world import SPIN_BAIT_SPEND_CHANCE, TROPHY_CHANCE, TROPHY_MAX_MULT, TROPHY_PRICE_MULT
import supabase_db
supabase_db.load_env(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))
DB_BACKEND = os.environ.get('DB_BACKEND', 'supabase').lower()
SUPABASE = None
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE = os.path.dirname(os.path.abspath(__file__))
# На Render путь к БД задаётся через DB_PATH (каталог постоянного диска, напр. /var/data).
DB = os.environ.get('DB_PATH') or os.path.join(BASE, 'db', 'fishing.db')
STATIC = os.path.join(BASE, 'static')
MAX_BODY = 4096                         # тела запросов крошечные; защита от гигантских POST
SERVE_TESTS = os.environ.get('SERVE_TESTS') == '1'   # /tests/*.html — только для разработки

def conn():
    c = sqlite3.connect(DB, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    return c

def init_db():
    global SUPABASE
    if DB_BACKEND == 'supabase':
        SUPABASE = supabase_db.Supabase()
        SUPABASE.rpc('health')
        return
    if DB_BACKEND != 'sqlite':
        raise supabase_db.DatabaseError('DB_BACKEND must be supabase or sqlite')
    os.makedirs(os.path.dirname(os.path.abspath(DB)), exist_ok=True)
    with closing(conn()) as c:
        fresh = c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='player'").fetchone() is None
        if fresh:
            for name in ('schema.sql', 'seed.sql'):
                with open(os.path.join(BASE, 'db', name), encoding='utf-8') as f:
                    c.executescript(f.read())
        # Порядок важен: world.migrate добавляет колонки fish.times/weather и catch.bait_id,
        # без которых sea.migrate не может вставить новых рыб в старое сохранение;
        # auth.migrate (личные сохранения) — последним, когда boat_owned и active_cast уже на месте.
        world.migrate(c)
        migrate_sea(c)
        auth.migrate(c)

# ---------- чтение ----------
def get_config():
    with closing(conn()) as c:
        return _get_config(c)

def _get_config(c):
    locs = [{'id': r['id'], 'code': r['code'], 'name': r['name'],
             'sky': [r['sky_top'], r['sky_bottom']], 'water': [r['water_top'], r['water_bottom']],
             'current': bool(r['has_current']), 'forest': bool(r['has_forest'])}
            for r in c.execute('SELECT * FROM location ORDER BY id')]
    rods = [dict(r) for r in c.execute(
        'SELECT id,name,max_range AS rng,strength AS str,reel_speed AS spd FROM rod ORDER BY id')]
    for r in rods:
        r['price'] = ROD_PRICES.get(r['id'], 0)
    baits = [dict(r) for r in c.execute('SELECT id,code,name,price FROM bait ORDER BY price')]
    fish = []
    for r in c.execute('SELECT * FROM fish ORDER BY price'):
        fish.append({'id': r['id'], 'name': r['name'], 'min': r['min_kg'], 'max': r['max_kg'],
                     'freq': r['bite_freq'], 'res': r['resistance'], 'color': r['color'], 'price': r['price'],
                     'style': r['fight_style'],
                     'times': r['times'].split(',') if r['times'] else None,
                     'weather': r['weather'].split(',') if r['weather'] else None,
                     'locs': [x['code'] for x in c.execute(
                         'SELECT l.code FROM fish_location fl JOIN location l ON l.id=fl.location_id WHERE fl.fish_id=?', (r['id'],))],
                     'baits': {x['code']: x['bite_weight'] for x in c.execute(
                         'SELECT b.code,fb.bite_weight FROM fish_bait fb JOIN bait b ON b.id=fb.bait_id WHERE fb.fish_id=?', (r['id'],))}})
    return {'locations': locs, 'rods': rods, 'baits': baits, 'fish': fish,
            'boat_price': BOAT_PRICE, 'bells_price': BELLS_PRICE, 'min_catch_seconds': MIN_CATCH_SECONDS,
            'rod_prices': ROD_PRICES, 'trophy_chance': TROPHY_CHANCE,
            'world': {'day_parts': [{'code': p, 'name': world.DAY_PART_NAMES[p]} for p in world.DAY_PARTS],
                      'day_part_seconds': world.DAY_PART_SECONDS,
                      'weathers': [{'code': w, 'name': world.WEATHER_NAMES[w]} for w in world.WEATHER_CODES]}}

def get_state(uid):
    with closing(conn()) as c:
        return _get_state(c, uid)

def _get_state(c, uid):
    p = c.execute('''SELECT u.username, p.money, p.tutorial_done, p.boat_owned, p.bells_owned, p.rod_level
                     FROM player p JOIN user u ON u.id=p.user_id WHERE p.user_id=?''', (uid,)).fetchone()
    baits = {r['code']: r['qty'] for r in c.execute(
        '''SELECT b.code,pb.qty FROM player_bait pb JOIN bait b ON b.id=pb.bait_id WHERE pb.user_id=?''', (uid,))}
    inv = [dict(r) for r in c.execute(
        '''SELECT f.name, COUNT(*) n, ROUND(SUM(c.weight_kg),2) kg, MAX(c.weight_kg) best, SUM(c.price) earned
           FROM catch c JOIN fish f ON f.id=c.fish_id WHERE c.kept=1 AND c.user_id=?
           GROUP BY f.id ORDER BY f.price''', (uid,))]
    last = [dict(r) for r in c.execute(
        '''SELECT f.name fish, l.name location, c.weight_kg weight, c.kept, c.price, c.trophy, c.caught_at
           FROM catch c JOIN fish f ON f.id=c.fish_id JOIN location l ON l.id=c.location_id
           WHERE c.user_id=? ORDER BY c.id DESC LIMIT 8''', (uid,))]
    weather, weather_until = world.roll_weather(c)
    world.ensure_quests(c, uid)
    now = time.time()
    quests = [{'id': q['id'], 'text': q['text'], 'goal': q['goal'], 'progress': q['progress'],
               'claimed': bool(q['claimed']),
               'reward': {'money': q['reward_money'], 'bait': q['reward_bait'], 'bait_qty': q['reward_bait_qty']}}
              for q in c.execute('SELECT * FROM quest WHERE user_id=? ORDER BY id', (uid,))]
    unlocked = {r['code']: r['unlocked_at'] for r in
                c.execute('SELECT code,unlocked_at FROM achievement WHERE user_id=?', (uid,))}
    achievements = [{'code': code, 'name': name, 'hint': hint, 'unlocked_at': unlocked.get(code)}
                    for code, name, hint in world.ACHIEVEMENTS]
    diary = world.diary(c, uid)
    return {'username': p['username'], 'money': p['money'], 'tutorial_done': bool(p['tutorial_done']),
            'baits': baits, 'inventory': inv, 'last': last, 'boat_owned': bool(p['boat_owned']),
            'bells_owned': bool(p['bells_owned']), 'rod_level': p['rod_level'],
            'world': {'day_part': world.day_part(now), 'day_part_left': world.day_part_left(now),
                      'weather': weather, 'weather_left': max(0, int(weather_until - now))},
            'quests': quests, 'achievements': achievements, 'diary': diary}

# ---------- лидерборд: лучшие уловы всех игроков ----------
def get_leaderboard(uid):
    with closing(conn()) as c:
        names = {r['id']: r['username'] for r in c.execute('SELECT id, username FROM user')}
        # По весу идут все уловы (и отпущенные); у каждого игрока — только его лучший.
        best = c.execute('''SELECT fish_id, user_id, weight_kg, caught_at FROM (
              SELECT c.*, ROW_NUMBER() OVER (PARTITION BY fish_id, user_id ORDER BY weight_kg DESC, id) rn
              FROM catch c) WHERE rn=1 ORDER BY fish_id, weight_kg DESC, id''').fetchall()
        boards = {}
        for r in best:
            rows = boards.setdefault(r['fish_id'], [])
            if len(rows) < 10:
                rows.append({'username': names[r['user_id']], 'weight': r['weight_kg'],
                             'caught_at': r['caught_at'], 'you': r['user_id'] == uid})
        order = [r['id'] for r in c.execute('SELECT id FROM fish ORDER BY price, id')]
        # По стоимости — самая дорогая одиночная рыба (отпущенные имеют цену 0 и не участвуют).
        fish_names = {r['id']: r['name'] for r in c.execute('SELECT id, name FROM fish')}
        top = c.execute('''SELECT user_id, fish_id, weight_kg, price, caught_at FROM (
              SELECT c.*, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY price DESC, id) rn
              FROM catch c WHERE kept=1 AND price>0) WHERE rn=1 ORDER BY price DESC, id LIMIT 10''').fetchall()
        price = [{'username': names[r['user_id']], 'fish': fish_names[r['fish_id']], 'weight': r['weight_kg'],
                  'price': r['price'], 'caught_at': r['caught_at'], 'you': r['user_id'] == uid} for r in top]
    return {'price': price, 'fish': [{'id': fid, 'rows': boards.get(fid, [])} for fid in order]}

# ---------- запись: каждая функция возвращает (http_code, json) ----------
def weighted_price(fish, w):
    """Награда зависит от веса: 0.75× базовой цены при min_kg, 1.75× при max_kg (линейно)."""
    lo, hi = fish['min_kg'], fish['max_kg']
    mult = (0.75 + (min(max(w, lo), hi) - lo) / (hi - lo)) if hi > lo else 1.0
    return int(fish['price'] * mult + 0.5)
# Все игровые действия привязаны к uid из cookie-сессии.
def post_cast(d, uid):                     # заброс: -1 наживка
    with closing(conn()) as c:
        c.execute('BEGIN IMMEDIATE')
        loc = c.execute('SELECT id,code FROM location WHERE code=?', (d.get('location'),)).fetchone()
        if not loc:
            return 400, {'ok': False, 'error': 'Неизвестная локация.'}
        owned = c.execute('SELECT boat_owned FROM player WHERE user_id=?', (uid,)).fetchone()[0]
        if loc['code'] == 'sea' and not owned:
            return 403, {'ok': False, 'error': f'Для морской рыбалки необходимо приобрести лодку за {BOAT_PRICE:,} ₽.'.replace(',', ' ')}
        bait = c.execute('SELECT id,code FROM bait WHERE code=?', (d.get('bait'),)).fetchone()
        if not bait:
            return 400, {'ok': False, 'error': 'Неизвестная наживка'}
        row = c.execute('SELECT qty FROM player_bait WHERE user_id=? AND bait_id=?', (uid, bait['id'])).fetchone()
        if not row or row['qty'] < 1:
            return 400, {'ok': False, 'error': 'Наживка закончилась'}
        # блесна расходуется не с каждого заброса: шанс потратить SPIN_BAIT_SPEND_CHANCE
        bait_kept = bait['code'] == 'spin' and random.random() >= SPIN_BAIT_SPEND_CHANCE
        if not bait_kept:
            cur = c.execute('UPDATE player_bait SET qty=qty-1 WHERE user_id=? AND bait_id=? AND qty>0',
                            (uid, bait['id']))
            if cur.rowcount != 1:
                return 400, {'ok': False, 'error': 'Наживка закончилась'}
        c.execute('INSERT OR REPLACE INTO active_cast(user_id,location_id,bait_id,ready_at) VALUES (?,?,?,?)',
                  (uid, loc['id'], bait['id'], time.time() + MIN_CATCH_SECONDS))
        c.commit()
    return 200, {'ok': True, 'bait_kept': bool(bait_kept)}

def post_buy(d, uid):
    n = int(d.get('qty', 1))
    with closing(conn()) as c:
        c.execute('BEGIN IMMEDIATE')
        if d.get('item') == 'boat':
            p = c.execute('SELECT money,boat_owned FROM player WHERE user_id=?', (uid,)).fetchone()
            if p['boat_owned']:
                return 409, {'ok': False, 'error': 'Лодка уже приобретена'}
            if p['money'] < BOAT_PRICE:
                return 400, {'ok': False, 'error': f'Не хватает денег: лодка стоит {BOAT_PRICE:,} ₽.'.replace(',', ' ')}
            c.execute('UPDATE player SET money=money-?,boat_owned=1 WHERE user_id=?', (BOAT_PRICE, uid))
            c.commit()
            return 200, {'ok': True}
        if d.get('item') == 'bells':
            p = c.execute('SELECT money,bells_owned FROM player WHERE user_id=?', (uid,)).fetchone()
            if p['bells_owned']:
                return 409, {'ok': False, 'error': 'Колокольчики уже приобретены'}
            if p['money'] < BELLS_PRICE:
                return 400, {'ok': False, 'error': f'Не хватает денег: колокольчики стоят {BELLS_PRICE} ₽.'}
            c.execute('UPDATE player SET money=money-?,bells_owned=1 WHERE user_id=?', (BELLS_PRICE, uid))
            c.commit()
            return 200, {'ok': True}
        if d.get('item') == 'rod':
            p = c.execute('SELECT money,rod_level FROM player WHERE user_id=?', (uid,)).fetchone()
            top = c.execute('SELECT MAX(id) FROM rod').fetchone()[0]
            if p['rod_level'] >= top:
                return 409, {'ok': False, 'error': 'Все удочки уже приобретены'}
            nxt = p['rod_level'] + 1
            price = ROD_PRICES.get(nxt, 0)
            rod = c.execute('SELECT name FROM rod WHERE id=?', (nxt,)).fetchone()
            if not price or not rod or p['money'] < price:
                return 400, {'ok': False, 'error': f'Не хватает денег: {rod["name"] if rod else "удочка"} стоит {price:,} ₽.'.replace(',', ' ')}
            c.execute('UPDATE player SET money=money-?,rod_level=? WHERE user_id=?', (price, nxt, uid))
            c.commit()
            return 200, {'ok': True}
        b = c.execute('SELECT id,price FROM bait WHERE code=?', (d.get('bait'),)).fetchone()
        money = c.execute('SELECT money FROM player WHERE user_id=?', (uid,)).fetchone()['money']
        if not b or not 1 <= n <= 99 or money < b['price'] * n:
            return 400, {'ok': False, 'error': 'Не хватает денег'}
        c.execute('UPDATE player SET money=money-? WHERE user_id=?', (b['price'] * n, uid))
        c.execute('INSERT OR IGNORE INTO player_bait(user_id,bait_id,qty) VALUES (?,?,0)', (uid, b['id']))
        c.execute('UPDATE player_bait SET qty=qty+? WHERE user_id=? AND bait_id=?', (n, uid, b['id']))
        c.commit()
    return 200, {'ok': True}

def post_catch(d, uid):                    # «Забрать» -> деньги, «Отпустить» -> 0
    with closing(conn()) as c:
        c.execute('BEGIN IMMEDIATE')
        active = c.execute('SELECT * FROM active_cast WHERE user_id=?', (uid,)).fetchone()
        valid = c.execute('''SELECT 1 FROM fish_location fl JOIN location l ON l.id=fl.location_id
            JOIN fish_bait fb ON fb.fish_id=fl.fish_id WHERE fl.fish_id=? AND l.code=?
            AND fb.bait_id=? AND fl.location_id=?''',
            (d.get('fish_id'), d.get('location'), active['bait_id'] if active else -1,
             active['location_id'] if active else -1)).fetchone()
        owned = c.execute('SELECT boat_owned FROM player WHERE user_id=?', (uid,)).fetchone()[0]
        if not active or not valid or time.time() < active['ready_at'] or (d.get('location') == 'sea' and not owned):
            return 400, {'ok': False, 'error': 'Улов не соответствует забросу или рыбалка ещё не завершена.'}
        f = c.execute('SELECT min_kg,max_kg,price FROM fish WHERE id=?', (d.get('fish_id'),)).fetchone()
        l = c.execute('SELECT id FROM location WHERE code=?', (d.get('location'),)).fetchone()
        w = float(d.get('weight', 0))
        trophy = 1 if d.get('trophy') else 0
        if not f or not l:
            return 400, {'ok': False, 'error': 'Недопустимый вес улова.'}
        # Трофей — единственный легальный способ поймать рыбу тяжелее max_kg (до ×1.5).
        lo = f['max_kg'] if trophy else f['min_kg']
        hi = f['max_kg'] * TROPHY_MAX_MULT if trophy else f['max_kg']
        if not (lo - 0.01 <= w <= hi + 0.01):
            return 400, {'ok': False, 'error': 'Недопустимый вес улова.'}
        kept = 1 if d.get('kept') else 0
        price = weighted_price(f, w) * (TROPHY_PRICE_MULT if trophy else 1) if kept else 0
        c.execute('INSERT INTO catch(user_id,fish_id,location_id,weight_kg,kept,price,bait_id,trophy) VALUES (?,?,?,?,?,?,?,?)',
                  (uid, d['fish_id'], l['id'], round(w, 2), kept, price, active['bait_id'], trophy))
        c.execute('DELETE FROM active_cast WHERE user_id=?', (uid,))
        c.execute('UPDATE player SET money=money+? WHERE user_id=?', (price, uid))
        # Прогресс ежедневных заданий и достижения считаются тем же уловом.
        world.quest_progress(c, uid, d['fish_id'], w, active['bait_id'], d.get('location'))
        new_achievements = world.check_achievements(c, uid)
        c.commit()
    return 200, {'ok': True, 'price': price, 'new_achievements': new_achievements}

def post_quest_claim(d, uid):              # забор награды выполненного задания
    with closing(conn()) as c:
        c.execute('BEGIN IMMEDIATE')
        q = c.execute('SELECT * FROM quest WHERE id=? AND user_id=? AND day=?',
                      (d.get('id'), uid, time.strftime('%Y-%m-%d'))).fetchone()
        if not q or q['claimed'] or q['progress'] < q['goal']:
            return 400, {'ok': False, 'error': 'Задание ещё не выполнено'}
        c.execute('UPDATE quest SET claimed=1 WHERE id=?', (q['id'],))
        c.execute('UPDATE player SET money=money+? WHERE user_id=?', (q['reward_money'], uid))
        if q['reward_bait']:
            bait = c.execute('SELECT id FROM bait WHERE code=?', (q['reward_bait'],)).fetchone()
            if bait:
                c.execute('INSERT OR IGNORE INTO player_bait(user_id,bait_id,qty) VALUES (?,?,0)', (uid, bait['id']))
                c.execute('UPDATE player_bait SET qty=qty+? WHERE user_id=? AND bait_id=?',
                          (q['reward_bait_qty'], uid, bait['id']))
        c.commit()
    return 200, {'ok': True, 'money': q['reward_money'],
                 'bait': q['reward_bait'], 'bait_qty': q['reward_bait_qty']}

def post_tutorial(d, uid):
    with closing(conn()) as c:
        c.execute('UPDATE player SET tutorial_done=? WHERE user_id=?', (1 if d.get('done') else 0, uid))
        c.commit()
    return 200, {'ok': True}

# ---------- аккаунты: регистрация, вход, выход ----------
def post_register(d, headers=None):
    with closing(conn()) as c:
        c.execute('BEGIN IMMEDIATE')
        try:
            uid, err = auth.register(c, d.get('username'), d.get('password'))
        except sqlite3.IntegrityError:      # гонка двух регистраций одного логина
            return 400, {'ok': False, 'error': 'Такой логин уже занят.'}, None
        if err:
            return 400, {'ok': False, 'error': err}, None
        token = auth.create_session(c, uid)
        username = c.execute('SELECT username FROM user WHERE id=?', (uid,)).fetchone()[0]
        c.commit()
    return 200, {'ok': True, 'username': username}, auth.set_cookie(token)

def post_login(d, headers=None):
    with closing(conn()) as c:
        c.execute('BEGIN IMMEDIATE')
        uid, err = auth.authenticate(c, d.get('username'), d.get('password'))
        if err:
            c.commit()
            time.sleep(.3)                  # лёгкое торможение перебора паролей
            return 401, {'ok': False, 'error': err}, None
        token = auth.create_session(c, uid)
        username = c.execute('SELECT username FROM user WHERE id=?', (uid,)).fetchone()[0]
        c.commit()
    return 200, {'ok': True, 'username': username}, auth.set_cookie(token)

def post_logout(d, headers=None):
    with closing(conn()) as c:
        auth.drop_session(c, auth.cookie_token(headers.get('Cookie') if headers else None))
        c.commit()
    return 200, {'ok': True}, auth.CLEAR_COOKIE

def current_user(headers):
    """(uid, username) по cookie запроса или None."""
    with closing(conn()) as c:
        return auth.session_user(c, headers.get('Cookie'))

def health():
    with closing(conn()) as c:
        c.execute('SELECT 1 FROM player LIMIT 1').fetchone()
    return {'ok': True}

# SQLite remains available explicitly for offline tests and legacy saves.
_sqlite_current_user, _sqlite_config, _sqlite_state, _sqlite_health, _sqlite_leaderboard = \
    current_user, get_config, get_state, health, get_leaderboard

def client():
    global SUPABASE
    if SUPABASE is None:
        SUPABASE = supabase_db.Supabase()
    return SUPABASE

def current_user(headers):
    return supabase_db.current_user(client(), headers) if DB_BACKEND == 'supabase' else _sqlite_current_user(headers)

def get_config():
    return client().rpc('config') if DB_BACKEND == 'supabase' else _sqlite_config()

def get_state(uid):
    return client().rpc('state', {'uid': uid}) if DB_BACKEND == 'supabase' else _sqlite_state(uid)

def get_leaderboard(uid):
    return client().rpc('leaderboard', {'uid': uid}) if DB_BACKEND == 'supabase' else _sqlite_leaderboard(uid)

def health():
    return client().rpc('health') if DB_BACKEND == 'supabase' else _sqlite_health()

def remote_game(action, fallback):
    def call(data, uid):
        return supabase_db.game(client(), action, data, uid) if DB_BACKEND == 'supabase' else fallback(data, uid)
    return call

def remote_auth(fn, fallback):
    def call(data, headers=None):
        return fn(client(), data, headers) if DB_BACKEND == 'supabase' else fallback(data, headers)
    return call

post_cast = remote_game('cast', post_cast)
post_buy = remote_game('buy', post_buy)
post_catch = remote_game('catch', post_catch)
post_quest_claim = remote_game('quest_claim', post_quest_claim)
post_tutorial = remote_game('tutorial', post_tutorial)
post_register = remote_auth(supabase_db.register, post_register)
post_login = remote_auth(supabase_db.login, post_login)
post_logout = remote_auth(supabase_db.logout, post_logout)

POST = {'/api/cast': post_cast, '/api/buy': post_buy, '/api/catch': post_catch,
        '/api/quest/claim': post_quest_claim, '/api/tutorial': post_tutorial}
AUTH_POST = {'/api/register': post_register, '/api/login': post_login, '/api/logout': post_logout}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=STATIC, **kw)

    def send_json(self, obj, code=200, extra_headers=()):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        for name, value in extra_headers:
            self.send_header(name, value)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split('?', 1)[0]
        try:
            if path in ('/healthz', '/api/health'): return self.send_json(health())
            if path == '/api/config': return self.send_json(get_config())
            if path == '/api/state':
                user = current_user(self.headers)
                if not user:
                    return self.send_json({'ok': False, 'error': 'Требуется вход'}, 401)
                return self.send_json(get_state(user[0]))
            if path == '/api/leaderboard':
                user = current_user(self.headers)
                if not user:
                    return self.send_json({'ok': False, 'error': 'Требуется вход'}, 401)
                return self.send_json(get_leaderboard(user[0]))
        except (sqlite3.Error, supabase_db.DatabaseError) as e:
            print('DB error:', e, file=sys.stderr)
            return self.send_json({'ok': False, 'error': 'База данных недоступна'}, 503)
        if path.startswith('/tests/') and not SERVE_TESTS:
            return self.send_error(404)
        super().do_GET()

    def do_POST(self):
        path = self.path.split('?', 1)[0]
        game_fn, auth_fn = POST.get(path), AUTH_POST.get(path)
        if not game_fn and not auth_fn:
            return self.send_json({'ok': False, 'error': 'not found'}, 404)
        cookie = None
        try:
            n = int(self.headers.get('Content-Length', 0))
            if not 0 <= n <= MAX_BODY:
                return self.send_json({'ok': False, 'error': 'Слишком большой запрос'}, 413)
            d = json.loads(self.rfile.read(n) or b'{}')
            if not isinstance(d, dict):
                raise ValueError('body must be an object')
            if auth_fn:
                code, obj, cookie = auth_fn(d, self.headers)
            else:
                user = current_user(self.headers)
                if not user:
                    return self.send_json({'ok': False, 'error': 'Требуется вход: зарегистрируйтесь или войдите.'}, 401)
                code, obj = game_fn(d, user[0])
        except (ValueError, KeyError, TypeError, AttributeError,
                sqlite3.InterfaceError, sqlite3.ProgrammingError):
            code, obj, cookie = 400, {'ok': False, 'error': 'Некорректный запрос'}, None
        except (sqlite3.Error, supabase_db.DatabaseError) as e:
            print('DB error:', e, file=sys.stderr)
            code, obj, cookie = 503, {'ok': False, 'error': 'База данных занята, повторите'}, None
        self.send_json(obj, code, [('Set-Cookie', cookie)] if cookie else ())

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 8000))   # Render передаёт PORT (по умолчанию 10000)
    print(f'Хранилище: {DB_BACKEND}\nИгра: http://localhost:{port}', flush=True)
    ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
