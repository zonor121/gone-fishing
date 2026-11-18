"""Идемпотентное расширение существующих сохранений морской рыбалкой."""
BOAT_PRICE = 10000
BELLS_PRICE = 200
MIN_CATCH_SECONDS = 12
# Последовательный апгрейд удочек: id следующей → цена (бамбуковая бесплатна).
ROD_PRICES = {2: 1200, 3: 4500}
# Снасти: красная зона шкалы натяжения по уровням 1–6 (обрыв на входе в зону).
TACKLE_PRICES = {2: 600, 3: 1500, 4: 3000, 5: 5500, 6: 9000}
TACKLE_ZONES = [.30, .26, .22, .18, .14, .10]
# Катушки: спад натяжения при отпущенной кнопке, долей шкалы в секунду.
REEL_PRICES = {2: 500, 3: 1300, 4: 2800, 5: 5000, 6: 8000}
REEL_RECOVERY = [.5, .6, .7, .8, .9, 1.0]
SEA_FISH_STYLES = {7: 'dart', 8: 'heavy', 9: 'dart', 10: 'dart'}

def migrate(c):
    columns = {r[1] for r in c.execute('PRAGMA table_info(player)')}
    if 'boat_owned' not in columns:
        c.execute('ALTER TABLE player ADD COLUMN boat_owned INTEGER NOT NULL DEFAULT 0')
    if 'bells_owned' not in columns:
        c.execute('ALTER TABLE player ADD COLUMN bells_owned INTEGER NOT NULL DEFAULT 0')
    if 'rod_level' not in columns:
        c.execute('ALTER TABLE player ADD COLUMN rod_level INTEGER NOT NULL DEFAULT 1')
    if 'tackle_level' not in columns:
        c.execute('ALTER TABLE player ADD COLUMN tackle_level INTEGER NOT NULL DEFAULT 1')
    if 'reel_level' not in columns:
        c.execute('ALTER TABLE player ADD COLUMN reel_level INTEGER NOT NULL DEFAULT 1')
    c.execute('''CREATE TABLE IF NOT EXISTS active_cast(
        id INTEGER PRIMARY KEY CHECK(id=1), location_id INTEGER NOT NULL,
        bait_id INTEGER NOT NULL, ready_at REAL NOT NULL)''')
    c.execute("INSERT OR IGNORE INTO location VALUES (4,'sea','Морская рыбалка','#7daec9','#e8eee9','#367e9e','#123e60',0,0)")
    c.execute("INSERT OR IGNORE INTO bait VALUES (5,'shrimp','Креветка',80)")
    # Наживку игрокам не выдаём: строки player_bait создаются при покупке
    # (INSERT OR IGNORE в post_buy) — у каждого аккаунта свои запасы.
    # times/weather: активность по времени суток и погоде (NULL — всегда); тунец охотится днём.
    c.executemany('''INSERT OR IGNORE INTO fish(id,name,min_kg,max_kg,bite_freq,resistance,color,price,times,weather,fight_style)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?)''', [
        (7,'Скумбрия',0.4,2.0,2.5,0.45,'#79abb5',240,None,None,'dart'),
        (8,'Треска',1.0,7.0,1.6,0.72,'#a29b76',420,None,None,'heavy'),
        (9,'Морской окунь',0.5,3.5,2.0,0.58,'#d18369',320,None,None,'dart'),
        (10,'Тунец',3.0,15.0,0.65,0.95,'#537e9a',700,'day',None,'dart')])
    for fish_id, style in SEA_FISH_STYLES.items():
        c.execute('UPDATE fish SET fight_style=? WHERE id=? AND fight_style IS NULL', (style, fish_id))
    c.executemany('INSERT OR IGNORE INTO fish_location VALUES (?,4)', [(i,) for i in range(7,11)])
    c.executemany('INSERT OR IGNORE INTO fish_bait VALUES (?,?,?)', [
        (7,5,1),(7,4,0.7),(8,5,0.8),(9,5,1),(9,4,0.6),(10,4,0.4),(10,5,0.25)])
    c.commit()
