"""Фикстура «старого» сохранения: схема до появления личных аккаунтов.

Воспроизводит schema.sql + seed.sql той версии игры, где существовал один
общий игрок player.id=1, — чтобы проверять автоматическую миграцию в аккаунты.
"""
LEGACY_SCHEMA = """
PRAGMA foreign_keys=ON;
CREATE TABLE location(
  id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  sky_top TEXT, sky_bottom TEXT, water_top TEXT, water_bottom TEXT,
  has_current INTEGER DEFAULT 0, has_forest INTEGER DEFAULT 0);
CREATE TABLE rod(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL,
  max_range INTEGER NOT NULL, strength REAL NOT NULL, reel_speed REAL NOT NULL);
CREATE TABLE bait(
  id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  price INTEGER NOT NULL);
CREATE TABLE fish(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL,
  min_kg REAL NOT NULL, max_kg REAL NOT NULL,
  bite_freq REAL NOT NULL, resistance REAL NOT NULL, color TEXT,
  price INTEGER NOT NULL, times TEXT, weather TEXT);
CREATE TABLE fish_location(
  fish_id INTEGER REFERENCES fish(id), location_id INTEGER REFERENCES location(id),
  PRIMARY KEY(fish_id,location_id));
CREATE TABLE fish_bait(
  fish_id INTEGER REFERENCES fish(id), bait_id INTEGER REFERENCES bait(id),
  bite_weight REAL NOT NULL DEFAULT 1, PRIMARY KEY(fish_id,bait_id));
CREATE TABLE player(                             -- единственный игрок (id=1)
  id INTEGER PRIMARY KEY CHECK(id=1), money INTEGER NOT NULL DEFAULT 0,
  tutorial_done INTEGER NOT NULL DEFAULT 0);
CREATE TABLE player_bait(
  bait_id INTEGER PRIMARY KEY REFERENCES bait(id), qty INTEGER NOT NULL DEFAULT 0 CHECK(qty>=0));
CREATE TABLE catch(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fish_id INTEGER NOT NULL REFERENCES fish(id),
  location_id INTEGER NOT NULL REFERENCES location(id),
  weight_kg REAL NOT NULL, kept INTEGER NOT NULL,
  price INTEGER NOT NULL DEFAULT 0, bait_id INTEGER,
  caught_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE world_state(
  id INTEGER PRIMARY KEY CHECK(id=1),
  weather TEXT NOT NULL DEFAULT 'clear', weather_until REAL);
CREATE TABLE quest(
  id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, kind TEXT NOT NULL,
  target TEXT, goal INTEGER NOT NULL, text TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0, claimed INTEGER NOT NULL DEFAULT 0,
  reward_money INTEGER NOT NULL DEFAULT 0, reward_bait TEXT,
  reward_bait_qty INTEGER NOT NULL DEFAULT 0);
CREATE TABLE achievement(
  code TEXT PRIMARY KEY, unlocked_at TEXT NOT NULL);
CREATE TABLE active_cast(
  id INTEGER PRIMARY KEY CHECK(id=1), location_id INTEGER NOT NULL,
  bait_id INTEGER NOT NULL, ready_at REAL NOT NULL);
"""

LEGACY_SEED = """
INSERT INTO location(id,code,name,sky_top,sky_bottom,water_top,water_bottom,has_current,has_forest) VALUES
(1,'lake','Озеро','#9fd3f0','#e6f4fa','#2f7fa8','#1b4d6b',0,0),
(2,'river','Река','#a8d8ea','#f0f7e8','#3b8f8a','#1f5c5a',1,0),
(3,'pond','Лесной пруд','#6f9a78','#b9d1a8','#37604a','#1d3a2c',0,1);
INSERT INTO rod(id,name,max_range,strength,reel_speed) VALUES
(1,'Бамбуковая',300,1.0,1.0),(2,'Спиннинг',400,1.3,1.2),(3,'Карбон',500,1.7,1.5);
INSERT INTO bait(id,code,name,price) VALUES
(1,'worm','Червь',10),(2,'maggot','Опарыш',30),(3,'corn','Кукуруза',60),(4,'spin','Блесна',100);
INSERT INTO fish(id,name,min_kg,max_kg,bite_freq,resistance,color,price,times,weather) VALUES
(1,'Карась',0.3,1.2,3,0.30,'#d8a23a',100,NULL,NULL),(2,'Карп',1,8,1.5,0.75,'#a9733b',250,NULL,NULL),
(3,'Окунь',0.2,1.5,2,0.40,'#6a9a3c',150,'morning,evening',NULL),
(4,'Щука',1,9,1,0.90,'#4f7d4a',300,NULL,NULL),
(5,'Плотва',0.1,0.7,3,0.20,'#b8c4cc',50,'morning,day',NULL),(6,'Лещ',0.5,4,1.5,0.50,'#c9b27a',200,NULL,NULL);
INSERT INTO fish_location VALUES (1,1),(1,3),(2,1),(2,2),(3,1),(3,2),(3,3),(4,1),(4,2),(5,1),(5,2),(5,3),(6,1),(6,2);
INSERT INTO fish_bait(fish_id,bait_id,bite_weight) VALUES
(5,1,1),(1,1,.8),(5,2,1),(1,2,1),(3,2,.7),(5,3,.6),(1,3,.8),(6,3,1),(2,3,.6),
(5,4,.5),(3,4,1),(4,4,.6);
INSERT INTO player(id,money,tutorial_done) VALUES (1,200,0);
INSERT INTO player_bait(bait_id,qty) VALUES (1,10),(2,5),(3,0),(4,0);
INSERT OR IGNORE INTO world_state VALUES (1,'clear',0);
"""


def build(path):
    """Создаёт БД старого формата: один общий игрок, справочники без моря и новых видов."""
    import sqlite3
    c = sqlite3.connect(path)
    c.executescript(LEGACY_SCHEMA)
    c.executescript(LEGACY_SEED)
    c.commit()
    c.close()
