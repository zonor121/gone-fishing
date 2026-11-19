// Мир игры: вкладки заданий/достижений/дневника, чип погоды, эффекты на сцене.
// Сервер авторитетен: время суток и погода приходят из /api/state, клиент ведёт их между опросами.
let WORLD = null, QUESTS = [], ACHS = [], DIARY = null;
let DAY_PARTS = ['morning', 'day', 'evening', 'night'];
let WEATHER_NAMES = { clear: 'Ясно', rain: 'Дождь', fog: 'Туман', wind: 'Ветер' };
let DAY_PART_NAMES = { morning: 'Утро', day: 'День', evening: 'Вечер', night: 'Ночь' };
let RAIN_BITE_MULT = .75;               // в дождь общая вероятность поклёвки ниже
let worldSyncAt = 0;                    // Date.now() последнего обновления мира

function setWorldState(s) {
  QUESTS = s.quests || []; ACHS = s.achievements || []; DIARY = s.diary || null;
  if (s.world) { WORLD = s.world; worldSyncAt = Date.now(); }
  updateWorldUI();
}

// Текущая часть суток/погода с учётом прошедшего после опроса времени.
function currentDayPart() {
  if (!WORLD) return 'day';
  const left = WORLD.day_part_left - (Date.now() - worldSyncAt) / 1000;
  if (left > 0) return WORLD.day_part;
  const shift = Math.ceil(-left / 180);
  return DAY_PARTS[(DAY_PARTS.indexOf(WORLD.day_part) + shift) % 4];
}
function currentDayBlend() {
  if (!WORLD) return {part: 'day', next: 'day', amount: 0};
  const elapsed = (Date.now() - worldSyncAt) / 1000;
  const position = DAY_PARTS.indexOf(WORLD.day_part) * 180 + 180 - WORLD.day_part_left + elapsed;
  const cycle = ((position % 720) + 720) % 720;
  const index = Math.floor(cycle / 180);
  const progress = Math.max(0, (cycle % 180 - 90) / 90);
  // Микрошаги ниже точности цвета не должны менять округление на границе фаз.
  const amount = Math.round(progress * progress * (3 - 2 * progress) * 1e6) / 1e6;
  return {part: DAY_PARTS[index], next: DAY_PARTS[(index + 1) % 4], amount};
}
function currentWeather() { return WORLD ? WORLD.weather : 'clear'; }

// Активна ли рыба сейчас: по времени суток и погоде (null — клюёт всегда).
function fishActive(f, part = currentDayPart(), wx = currentWeather()) {
  return (!f.times || f.times.includes(part)) && (!f.weather || f.weather.includes(wx));
}
function activityLabel(f) {
  const t = f.times ? f.times.map(p => DAY_PART_NAMES[p] || p).join(' и ').toLowerCase() : null;
  const w = f.weather ? f.weather.map(x => WEATHER_NAMES[x] || x).join(' и ').toLowerCase() : null;
  if (t && w) return `${t} · ${w}`;
  if (t) return t[0].toUpperCase() + t.slice(1);
  if (w) return `Только в ${w}`;
  return 'Клюёт в любое время';
}

// ---------- переключение вкладок ----------
const VIEW_IDS = { fishing: 'fishing-view', guide: 'guide-view', quests: 'quests-view', ach: 'ach-view', diary: 'diary-view', lb: 'lb-view' };
const VIEW_BUTTONS = { fishing: 'bplay', guide: 'bguide', quests: 'bquests', ach: 'bach', diary: 'bdiary', lb: 'blb' };
function showView(name) {
  if (!VIEW_IDS[name]) name = 'fishing';
  hold = 0;
  Object.entries(VIEW_IDS).forEach(([k, id]) => { $(id).hidden = k !== name; });
  Object.entries(VIEW_BUTTONS).forEach(([k, id]) => { $(id).setAttribute('aria-pressed', String(k === name)); });
}

// ---------- уведомления ----------
function toast(title, text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<b>${title}</b>${text ? `<span>${text}</span>` : ''}`;
  $('toasts').appendChild(el);
  setTimeout(() => { el.classList.add('gone'); setTimeout(() => el.remove(), 500); }, 5200);
}

// ---------- чип погоды/времени ----------
function updateWorldChip() {
  if (!WORLD) return;
  $('world-time').textContent = DAY_PART_NAMES[currentDayPart()] || currentDayPart();
  $('world-weather').textContent = WEATHER_NAMES[WORLD.weather] || WORLD.weather;
  const w = $('world-chip');
  w.className = `world-chip wx-${WORLD.weather} tp-${currentDayPart()}`;
}

// ---------- вкладки ----------
function renderQuests() {
  const done = QUESTS.filter(q => q.progress >= q.goal).length;
  $('quests-summary').textContent = `Выполнено ${done} из ${QUESTS.length} · обновятся завтра`;
  $('quests-list').innerHTML = QUESTS.map(q => {
    const ready = q.progress >= q.goal, pct = Math.min(100, Math.round(q.progress / q.goal * 100));
    const reward = [q.reward.money ? `${q.reward.money} ₽` : null,
                    q.reward.bait && q.reward.bait_qty ? `${q.reward.bait_qty} × ${B[q.reward.bait] || q.reward.bait}` : null]
      .filter(Boolean).join(' + ');
    const action = q.claimed ? '<span class="quest-done">Награда получена</span>'
      : ready ? `<button data-claim="${q.id}">Получить награду</button>`
      : '<span class="quest-locked">В процессе</span>';
    return `<article class="quest-card${ready ? ' ready' : ''}${q.claimed ? ' claimed' : ''}"><h3>${q.text}</h3>
      <div class="quest-bar" role="progressbar" aria-valuenow="${Math.min(q.progress, q.goal)}" aria-valuemin="0" aria-valuemax="${q.goal}"><span style="width:${pct}%"></span></div>
      <p class="quest-count">${Math.min(q.progress, q.goal)} / ${q.goal} · Награда: ${reward}</p>${action}</article>`;
  }).join('') || '<p class="guide-note">Задания появятся после первого обращения к серверу.</p>';
}
function renderAchievements() {
  const unlocked = ACHS.filter(a => a.unlocked_at).length;
  $('ach-summary').textContent = `Открыто ${unlocked} из ${ACHS.length}`;
  $('ach-list').innerHTML = ACHS.map(a => `<article class="ach-card${a.unlocked_at ? ' on' : ''}">
    <div class="ach-badge" aria-hidden="true">${a.unlocked_at ? '★' : '·'}</div>
    <h3>${a.name}</h3><p>${a.hint}</p>
    <small>${a.unlocked_at ? 'Открыто: ' + a.unlocked_at : 'Не открыто'}</small></article>`).join('');
}
function renderDiary() {
  if (!DIARY) return;
  const heaviest = DIARY.heaviest ? `${DIARY.heaviest.name} · ${DIARY.heaviest.weight.toFixed(2)} кг${DIARY.heaviest.trophy ? ' · трофей' : ''}` : 'пока никого';
  $('diary-summary').textContent = `${DIARY.total} рыб за всё время`;
  const caught = new Map(DIARY.species.map(s => [s.id, s]));
  const rows = F.map(f => {
    const s = caught.get(f.id);
    return `<tr><td>${s ? f.name : '<span class="diary-unknown">? — вид не открыт</span>'}</td><td>${s ? s.n : '—'}</td><td>${s ? s.best.toFixed(2) + ' кг' : '—'}</td></tr>`;
  }).join('');
  $('diary-body').innerHTML = `<div class="diary-cards">
      <div class="diary-card"><small>Всего поймано</small><b>${DIARY.total}</b></div>
      <div class="diary-card"><small>Самая тяжёлая рыба</small><b>${heaviest}</b></div>
      <div class="diary-card"><small>Открыто видов</small><b>${DIARY.discovered} из ${DIARY.species_total}</b></div>
    </div><div class="table-scroll"><table aria-label="Статистика по видам"><thead><tr><th>Вид</th><th>Поймано</th><th>Рекорд</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function updateWorldUI() { updateWorldChip(); renderQuests(); renderAchievements(); renderDiary(); }

function initWorld() {
  ['quests', 'ach', 'diary'].forEach(name => {
    $(VIEW_BUTTONS[name]).disabled = false;
    $(VIEW_BUTTONS[name]).onclick = () => showView(name);
    $(`${name === 'ach' ? 'ach' : name}-return`).onclick = () => { showView('fishing'); $('bplay').focus(); };
  });
  $('quests-list').onclick = async e => {
    const button = e.target.closest('button[data-claim]');
    if (!button) return;
    button.disabled = true;
    const r = await post('/api/quest/claim', { id: +button.dataset.claim }).catch(() => ({}));
    if (r.ok) {
      const parts = [r.money ? `+${r.money} ₽` : null, r.bait && r.bait_qty ? `+${r.bait_qty} × ${B[r.bait] || r.bait}` : null].filter(Boolean);
      toast('Задание выполнено!', `Награда получена: ${parts.join(', ')}`);
    } else button.disabled = false;
    await refresh(); if (currentViewName() !== 'fishing') renderQuests();
  };
  // Погода и задания живут на сервере: подтягиваем их в фоне, пока игрок на рыбалке.
  setInterval(() => { if (S === 'idle' && !document.hidden && $('fishing-view') && !$('fishing-view').hidden) refresh().catch(() => {}); }, 30000);
}
function currentViewName() {
  return Object.keys(VIEW_IDS).find(k => !$(VIEW_IDS[k]).hidden) || 'fishing';
}

// ---------- эффекты погоды и времени суток на сцене ----------
function dayTint(g2) {
  const {part, next, amount} = currentDayBlend();
  const tints = {morning: [255,220,150,.05], day: [0,0,0,0], evening: [255,140,60,.08], night: [10,18,44,.22]};
  const a = tints[part], b = tints[next], alpha = a[3] * (1 - amount) + b[3] * amount;
  if (alpha > 0) {
    const rgb = a.slice(0, 3).map((v, i) => Math.round((v * a[3] * (1 - amount) + b[i] * b[3] * amount) / alpha));
    g2.fillStyle = `rgba(${rgb.join(',')},${alpha})`; g2.fillRect(0, 0, 800, 420);
  }
  const v = g2.createRadialGradient(400, 210, 180, 400, 210, 520);
  v.addColorStop(0, 'rgba(8,14,18,0)'); v.addColorStop(1, 'rgba(8,14,18,.22)');
  g2.fillStyle = v; g2.fillRect(0, 0, 800, 420);
}
function drawWeatherEffects(g2, time2) {
  const wx = currentWeather(), night = getPalette().night;
  if (wx === 'rain') {
    drawRain(g2, time2);
  } else if (wx === 'wind') {
    g2.strokeStyle = 'rgba(235,240,235,.28)'; g2.lineWidth = .7;
    for (let i = 0; i < 9; i++) {
      const y = 60 + noise(i + 970) * 300, x = (time2 * (60 + i * 12)) % 960 - 80;
      g2.beginPath(); g2.moveTo(x, y); g2.quadraticCurveTo(x + 34, y - 4, x + 70, y + 2); g2.stroke();
    }
  }
  if (night > 0 && (S === 'wait' || S === 'bite')) {
    // Ночью поплавок подсвечен, чтобы оставаться заметным.
    const p = waterPoint(bx);
    p[0] += windDrift(time2);
    p[1] += S === 'bite' ? 5 + Math.sin(tt*30)*3 : Math.sin(time2*2)*1.3;
    const glow = g2.createRadialGradient(p[0], p[1], 2, p[0], p[1], 26);
    glow.addColorStop(0, `rgba(255,214,120,${.5 * night})`); glow.addColorStop(1, 'rgba(255,214,120,0)');
    g2.fillStyle = glow; g2.beginPath(); g2.arc(p[0], p[1], 26, 0, 7); g2.fill();
  }
}
// Туман: вуаль у горизонта и два дрейфующих слоя мягких хлопььев вместо плоских эллипсов.
// Рисуется до поплавка и снастей: дальность тонет, передний план остаётся читаемым.
function weatherTexture(mask) {
  const canvas = document.createElement('canvas'); canvas.width = mask.width; canvas.height = mask.height;
  return {mask, canvas, color: null};
}
function tintWeatherTexture(texture, color) {
  if (texture.color === color) return;
  const c = texture.canvas.getContext('2d');
  c.clearRect(0, 0, texture.canvas.width, texture.canvas.height);
  c.drawImage(texture.mask, 0, 0);
  c.globalCompositeOperation = 'source-in'; c.fillStyle = color;
  c.fillRect(0, 0, texture.canvas.width, texture.canvas.height);
  c.globalCompositeOperation = 'source-over'; texture.color = color;
}
let fogTex = null;
function fogColor() {
  const P = getPalette();
  return mix(mix(P.haze, '#e9eee9', .65), mix(P.haze, '#8fa0b4', .4), P.night);
}
function buildFogTex(col) {
  const mk = (h, n, seed, rMax, squash) => {
    const cv = document.createElement('canvas'); cv.width = 960; cv.height = h;
    const c = cv.getContext('2d');
    for (let i = 0; i < n; i++) {
      const x = noise(i + seed) * 960, y = h * (.3 + noise(i + seed + 1) * .4);
      const r = rMax * (.45 + noise(i + seed + 2) * .55), a = .12 + noise(i + seed + 3) * .18;
      // Копии со сдвигом на ширину полотна дают бесшовный горизонтальный луп.
      for (const ox of [-960, 0, 960]) {
        c.save(); c.translate(x + ox, y); c.scale(1, squash);
        const rad = c.createRadialGradient(0, 0, r * .15, 0, 0, r);
        rad.addColorStop(0, rgba(col, a)); rad.addColorStop(1, rgba(col, 0));
        c.fillStyle = rad; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.restore();
      }
    }
    return cv;
  };
  return [mk(180, 54, 5100, 95, .5), mk(120, 38, 5200, 70, .42)];
}
function drawFog(g2, time2) {
  if (currentWeather() !== 'fog') return;
  const col = fogColor();
  if (!fogTex) fogTex = buildFogTex('#ffffff').map(weatherTexture);
  fogTex.forEach(texture => tintWeatherTexture(texture, col));
  const veil = g2.createLinearGradient(0, 108, 0, 262);
  veil.addColorStop(0, rgba(col, 0)); veil.addColorStop(.48, rgba(col, .55)); veil.addColorStop(1, rgba(col, 0));
  g2.fillStyle = veil; g2.fillRect(0, 108, 800, 154);
  const tile = (tex, y, h, speed, alpha, bob) => {
    const off = (time2 * speed) % 960;
    g2.globalAlpha = alpha;
    g2.drawImage(tex, -off, y + bob, 960, h);
    g2.drawImage(tex, 960 - off, y + bob, 960, h);
    g2.globalAlpha = 1;
  };
  tile(fogTex[0].canvas, 128, 124, 6, 1, Math.sin(time2 * .23) * 2);
  tile(fogTex[1].canvas, 222, 94, 14, .7, Math.sin(time2 * .35 + 1) * 3);
}
// Дождь: три слоя глубины (дальний мелкий/тусклый → ближний крупный/яркий),
// tapered-штрихи из предрендеренного спрайта, наклон от ветра и всплески на воде.
const RAIN_LAYERS = [
  { n: 46, seed: 900, speed: 300, len: 11, w: .7, alpha: .26, slant: .10 },
  { n: 34, seed: 940, speed: 470, len: 18, w: .95, alpha: .40, slant: .16 },
  { n: 22, seed: 980, speed: 660, len: 27, w: 1.25, alpha: .58, slant: .22 }
];
let rainTex = null;
function rainColor() {
  const P = getPalette();
  return mix(mix('#cfe0ee', '#7f93ad', P.night), P.haze, .25);
}
function buildRainStreak(col) {
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 36;
  const c = cv.getContext('2d');
  const gr = c.createLinearGradient(0, 0, 0, 36);
  gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(.55, rgba(col, .45)); gr.addColorStop(1, rgba(col, 1));
  c.strokeStyle = gr; c.lineWidth = 1.6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(2, 1); c.lineTo(2, 35); c.stroke();
  return cv;
}
function drawRain(g2, time2) {
  const col = rainColor();
  if (!rainTex) rainTex = weatherTexture(buildRainStreak('#ffffff'));
  tintWeatherTexture(rainTex, col);
  const gust = Math.sin(time2 * .3) * .04;
  const wrap = (v, m) => ((v % m) + m) % m;
  for (const L of RAIN_LAYERS) {
    const ang = L.slant + gust;
    for (let i = 0; i < L.n; i++) {
      const x = wrap(noise(i + L.seed) * 900 - time2 * 24, 900) - 50;
      const y = wrap(noise(i + L.seed + 1) * 460 + time2 * L.speed, 460) - 20;
      const len = L.len * (.8 + noise(i + L.seed + 2) * .45);
      g2.save();
      g2.globalAlpha = L.alpha * (.7 + noise(i + L.seed + 3) * .5);
      g2.translate(x, y); g2.rotate(ang); g2.scale(L.w, len / 36);
      g2.drawImage(rainTex.canvas, -2, -36);
      g2.restore();
    }
  }
  // Всплески: расходящиеся затухающие кольца с перспективой (мельче у горизонта).
  const ring = mix(col, '#ffffff', .35);
  g2.lineWidth = .8;
  for (let i = 0; i < 26; i++) {
    const t = noise(i + 1020);                       // 0 горизонт → 1 ближняя вода
    const x = noise(i + 1030) * 800, y = 245 + t * 150, sc = .45 + t * .85;
    const prog = wrap(time2 / 1.1 + noise(i + 1040), 1);
    const r = 9 * prog * sc, a = (1 - prog) * .5;
    g2.strokeStyle = rgba(ring, a);
    g2.beginPath(); g2.ellipse(x, y, r, r * .32, 0, 0, 7); g2.stroke();
    if (prog > .2) {
      g2.strokeStyle = rgba(ring, a * .5);
      g2.beginPath(); g2.ellipse(x, y, r * .55, r * .18, 0, 0, 7); g2.stroke();
    }
    if (prog < .18) {                                // корона в момент удара
      g2.strokeStyle = rgba(ring, (1 - prog / .18) * .55);
      for (let k = -1; k <= 1; k++) {
        g2.beginPath(); g2.moveTo(x + k * 2 * sc, y);
        g2.lineTo(x + k * 3.4 * sc, y - (4 - Math.abs(k)) * sc); g2.stroke();
      }
    }
  }
  g2.globalAlpha = 1;
}
// Ветер сносит заброс: разброс дальности при каждом забросе.
function windRangeFactor() { return currentWeather() === 'wind' ? .88 + Math.random() * .24 : 1; }
function windDrift(time2) { return currentWeather() === 'wind' ? Math.sin(time2 * .5) * 12 + 14 : 0; }
