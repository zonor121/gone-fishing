"""Мультиплеер: кто сейчас на рыбалке и живая лента уловов всех игроков."""
import time

# Игрок считается онлайн, если его хартбит не старше ONLINE_TIMEOUT секунд.
ONLINE_TIMEOUT = 15
# Лента: последние уловы других игроков за FEED_WINDOW секунд, не больше FEED_LIMIT.
FEED_WINDOW = 600
FEED_LIMIT = 12
# Статусы для сцены: готовит снасти / ждёт поклёвку / вываживает.
STATUSES = ('idle', 'wait', 'fight')


def migrate(c):
    c.execute('''CREATE TABLE IF NOT EXISTS presence(
        user_id INTEGER PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
        location_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'idle',
        seen_at REAL NOT NULL)''')
    c.commit()


def touch(c, uid, location_id, status, now=None):
    """Хартбит игрока: обновляет его присутствие и чистит давно ушедших."""
    now = time.time() if now is None else now
    c.execute('INSERT OR REPLACE INTO presence(user_id,location_id,status,seen_at) VALUES (?,?,?,?)',
              (uid, location_id, status if status in STATUSES else 'idle', now))
    c.execute('DELETE FROM presence WHERE seen_at < ?', (now - ONLINE_TIMEOUT * 4,))


def snapshot(c, uid, location_id, now=None):
    """Игроки в той же локации, счётчики онлайн по локациям и лента чужих уловов."""
    now = time.time() if now is None else now
    fresh = now - ONLINE_TIMEOUT
    players = [{'username': r['username'], 'status': r['status']}
               for r in c.execute('''SELECT u.username, p.status FROM presence p
                   JOIN user u ON u.id=p.user_id
                   WHERE p.location_id=? AND p.user_id<>? AND p.seen_at>=?
                   ORDER BY u.username''', (location_id, uid, fresh))]
    counts = {r['code']: r['n'] for r in c.execute('''SELECT l.code, COUNT(*) n FROM presence p
        JOIN location l ON l.id=p.location_id WHERE p.seen_at>=? GROUP BY l.code''', (fresh,))}
    feed = [{'id': r['id'], 'username': r['username'], 'fish': r['fish'],
             'location': r['location'], 'location_code': r['location_code'],
             'weight': r['weight'], 'trophy': bool(r['trophy']), 'kept': bool(r['kept']),
             'caught_at': r['caught_at']}
            for r in c.execute('''SELECT c.id, u.username, f.name fish, l.name location, l.code location_code,
                       c.weight_kg weight, c.trophy, c.kept, c.caught_at
                FROM catch c JOIN user u ON u.id=c.user_id
                JOIN fish f ON f.id=c.fish_id JOIN location l ON l.id=c.location_id
                WHERE c.user_id<>? AND c.caught_at>=datetime('now', ?)
                ORDER BY c.id DESC LIMIT ?''', (uid, f'-{FEED_WINDOW} seconds', FEED_LIMIT))]
    return {'ok': True, 'players': players, 'online': sum(counts.values()),
            'counts': counts, 'feed': feed}