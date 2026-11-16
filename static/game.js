// Игра «Рыбалка»: данные и прогресс хранятся на сервере (через /api/*).
const $ = id => document.getElementById(id);
const cv = $('c'), g = cv.getContext('2d');
const sl = $('sl'), sr = $('sr'), sb = $('sb'), btn = $('btn');
const SX = 400, WY = 355;                 // точка у ног и ближняя вода
// Перспективная проекция дальности: расстояние растёт в глубину сцены.
function waterPoint(distance) {
  const z = Math.max(0, distance), depth = 1 / (1 + z * .006);
  return [400 + 16 * (1-depth), 239 + 116 * depth, .5 + depth * .7];
}
let L = {}, R = [], BL = [], B = {}, F = [];
let M = 0, Q = {}, INV = [], tutDone = true, tut = -1;
let boatOwned = false, boatPrice = 10000, bellsOwned = false, bellsPrice = 200, minCatchSeconds = 12, castPending = false;
const rub = n => n.toLocaleString('ru-RU');   // «10 000» — все суммы в интерфейсе через этот хелпер
// состояния: idle, charge, fly, wait, bite, reel, res (карточка), out (забрать/отпустить)
let S = 'idle', pw = 0, hold = 0, tm = 0, bx = 0, fish = null, w = 0, t = 0, d = 1;
let cast = 0, sd = 0, sg = 2, tt = 0, last = 0, outT = 0, outKeep = false, outMsg = '';
const rnd = (a, b) => a + Math.random() * (b - a);
// Награда зависит от веса: 0.75× базовой цены при min, 1.75× при max — та же формула, что и на сервере.
const priceFor = (f, w) => Math.round(f.price * (f.max > f.min ? .75 + (Math.min(Math.max(w, f.min), f.max) - f.min) / (f.max - f.min) : 1));
const say = s => $('msg').textContent = s;
const lock = v => { sl.disabled = sr.disabled = sb.disabled = v; $('blocations').disabled = v; };
const post = (u, o) => fetch(u, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(o)}).then(r => r.json());
const label = () => btn.textContent = {idle: 'Заброс (удерживайте)', charge: 'Отпустите для заброса…', fly: '…',
  wait: 'Смотать удочку', bite: 'ПОДСЕЧКА!', reel: 'Подмотка (удерживайте)', res: '…', out: '…'}[S];

async function boot() {
  const cfg = await (await fetch('/api/config')).json();
  cfg.locations.forEach(l => { L[l.code] = l; sl.add(new Option(l.name, l.code)); });
  R = cfg.rods; R.forEach((r, i) => sr.add(new Option(r.name, i)));
  BL = cfg.baits; BL.forEach(b => B[b.code] = b.name);
  F = cfg.fish; boatPrice = cfg.boat_price; bellsPrice = cfg.bells_price; minCatchSeconds = cfg.min_catch_seconds;
  if (cfg.world) {  // каталог времени суток и погоды — с сервера, единый источник
    DAY_PARTS = cfg.world.day_parts.map(p => p.code);
    cfg.world.day_parts.forEach(p => DAY_PART_NAMES[p.code] = p.name);
    cfg.world.weathers.forEach(w => WEATHER_NAMES[w.code] = w.name);
  }
  await refresh(); label(); btn.disabled = false; say('Снасти готовы. Можно забрасывать.');
  sl.addEventListener('change', updateLocationInfo); updateLocationInfo();
  initLocations();
  initWorld();
  initGuide();
  if (!tutDone) setTut(0);
  requestAnimationFrame(loop);
}

function updateLocationInfo() {
  const location = L[sl.value];
  $('scene-name').textContent = location.name;
  $('location-current').textContent = location.name;
  $('scene-detail').textContent = location.code === 'sea' ? 'Открытое море · рыбалка с лодки' : location.current ? 'Течение · речной берег' : location.forest ? 'Тихая вода · хвойный лес' : 'Тихая вода · открытый берег';
}

function fillBaits() {
  const v = sb.value || BL[0].code; sb.innerHTML = '';
  BL.forEach(b => sb.add(new Option(`${b.name} ×${Q[b.code] || 0}`, b.code))); sb.value = v;
}
async function refresh() {
  const res = await fetch('/api/state');
  if (res.status === 401 && window.showAuth) { showAuth('login'); return; }   // сессия истекла
  const s = await res.json();
  M = s.money; Q = s.baits; INV = s.inventory; tutDone = s.tutorial_done; boatOwned = s.boat_owned; bellsOwned = s.bells_owned;
  $('username').textContent = s.username || '';
  $('userbox').hidden = !s.username;
  setWorldState(s);
  $('money').textContent = M; fillBaits();
  const n = INV.reduce((a, r) => a + r.n, 0);
  $('stat').textContent = `В инвентаре рыб: ${n}`;
  $('hist').innerHTML = s.last.length ? '<thead><tr><th>Когда</th><th>Рыба</th><th>Вес</th><th>Место</th><th>Результат</th></tr></thead><tbody>' + s.last.map(r => `<tr><td>${r.caught_at}</td><td>${r.fish}</td><td>${r.weight.toFixed(2)} кг</td><td>${r.location}</td><td>${r.kept ? '+' + r.price + ' ₽' : 'отпущена'}</td></tr>`).join('') + '</tbody>' : '<tbody><tr><td class="empty">Здесь появится ваш первый улов.<br>Приготовьте снасти и забросьте удочку.</td></tr></tbody>';
}

// ---- обучение ----
const STEPS = [
  ['Шаг 1/5. Выберите локацию, удочку и наживку (остаток указан в скобках). Затем нажмите «Далее».', 'selrow'],
  ['Шаг 2/5. Нажмите и УДЕРЖИВАЙТЕ кнопку заброса — растёт шкала силы. Отпустите, чтобы забросить (тратится 1 наживка).', 'btn'],
  ['Шаг 3/5. Ждите поклёвку. Когда появится «ПОДСЕЧКА!» — быстро нажмите кнопку.', 'btn'],
  ['Шаг 4/5. Удерживайте кнопку — рыба приближается, но леска натягивается. Отпускайте, чтобы ослабить. Не доводите шкалу до красной зоны!', 'btn'],
  ['Шаг 5/5. «Забрать» — рыба в инвентарь и деньги на счёт. «Отпустить» — рыба уплывёт, денег не будет.', 'card']];
function setTut(n) {
  tut = n;
  document.querySelectorAll('.hl').forEach(e => e.classList.remove('hl'));
  if (n < 0 || n >= STEPS.length) {
    $('tut').style.display = 'none';
    if (n >= STEPS.length) { tut = -1; post('/api/tutorial', {done: 1}); }
    return;
  }
  $('tut').style.display = 'flex'; $('tt').textContent = STEPS[n][0];
  $('tn').style.display = n === 0 ? '' : 'none';
  const el = $(STEPS[n][1]); (el.id === 'card' ? el.firstElementChild : el).classList.add('hl');
}
$('tn').onclick = () => setTut(1);
$('ts').onclick = () => { setTut(-1); post('/api/tutorial', {done: 1}); };
$('btut').onclick = () => { if (S === 'idle') { showGuide(false); setTut(0); } };

// ---- управление ----
function down() {
  if ($('fishing-view').hidden) return;
  if ($('auth') && !$('auth').hidden) return;   // пока не выполнен вход — не рыбачим
  if (S === 'idle') {
    if (sl.value === 'sea' && !boatOwned) { say(`Сначала приобретите лодку за ${rub(boatPrice)} ₽ в магазине.`); return; }
    if (!(Q[sb.value] > 0)) { say('Наживка закончилась — купите в магазине или выберите другую.'); return; }
    S = 'charge'; pw = 0; say('');
  } else if (S === 'wait') { S = 'idle'; fish = null; lock(false); say('Вы смотали удочку.'); }
  else if (S === 'bite') {
    S = 'reel'; t = .2; d = 1; sd = 0; sg = 1; w = rnd(fish.min, fish.max);
    say('Рыба на крючке! Чередуйте подмотку и ослабление.'); if (tut === 2) setTut(3);
  } else if (S === 'reel') hold = 1;
  label();
}
function up() {
  hold = 0;
  if (S === 'charge') {
    S = 'fly'; cast = 0; lock(true); bx = R[sr.value].rng * Math.max(.08, pw) * windRangeFactor();
    castPending = true;
    post('/api/cast', {bait: sb.value, location: sl.value}).then(async r => {
      if (!r.ok) end(r.error || 'Не удалось забросить удочку.');
      else if (r.bait_kept) toast('Блесна не потратилась', 'Заброс обошёлся бесплатно: наживка осталась в запасе.');
      await refresh();
    }).catch(() => end('Нет связи с сервером. Повторите заброс.')).finally(() => { castPending = false; });
    if (tut >= 1 && tut <= 3) setTut(2);
    label();
  }
}
btn.onpointerdown = e => { e.preventDefault(); down(); };
btn.onpointerup = btn.onpointerleave = btn.onpointercancel = up;
addEventListener('keydown', e => { if (e.code === 'Space' && !e.repeat && !e.target.closest('button, select, input, textarea, a') && !document.querySelector('.modal[style*="flex"]')) { e.preventDefault(); down(); } });
addEventListener('keyup', e => { if (e.code === 'Space') up(); });

// ---- логика ----
function pick() {
  // Клюёт только рыба, активная в текущее время суток и погоду (см. world.js).
  const c = F.filter(f => f.locs.includes(sl.value) && f.baits[sb.value] && fishActive(f));
  if (!c.length) { fish = null; return; }
  const rain = currentWeather() === 'rain' ? RAIN_BITE_MULT : 1;   // дождь снижает клёв в целом
  const ws = c.map(f => f.freq * f.baits[sb.value]), sum = ws.reduce((a, b) => a + b) * rain;
  let x = Math.random() * sum, i = 0;
  while (x > ws[i]) { x -= ws[i]; i++; }
  fish = c[i];
  tm = Math.max(minCatchSeconds, rnd(2, 6) * (3 / sum) * (L[sl.value].current ? .85 : 1) + 1);
}
function end(m, fail) {
  S = 'idle'; fish = null; hold = 0; lock(false); say(m); label();
  if (fail && (tut === 2 || tut === 3)) setTut(1);
}
function update(dt) {
  tt += dt;
  if (castPending) return;
  if (S === 'charge') pw = Math.min(1, pw + dt * .7);
  if (S === 'fly') {
    cast += dt / .8;
    if (cast >= 1) { S = 'wait'; pick(); say(fish ? 'Ждём поклёвку…' : 'Тишина… возможно, эта наживка здесь не подходит.'); label(); }
  } else if (S === 'wait' && fish) {
    tm -= dt; if (tm <= 0) { S = 'bite'; tm = 2; say('Поклёвка!'); if (bellsOwned) bellChime(); label(); }
  } else if (S === 'bite') {
    tm -= dt; if (tm <= 0) end('Поклёвка пропущена — рыба ушла.', 1);
  } else if (S === 'reel') {
    const r = R[sr.value], e = fish.res * (.6 + .4 * w / fish.max);
    sg -= dt; if (sg <= 0) { sd = .8; sg = rnd(1.3, 2.6); }
    if (hold) { t += dt * (.4 + .3 * e) / r.str; d -= dt * .16 * r.spd * (1 - e * .5); } else t -= dt * .5;
    if (sd > 0) { sd -= dt; d += dt * .12 * e; t += dt * .35 * e / r.str; }
    t = Math.max(0, t); d = Math.min(d, 1.1);
    if (t >= 1) end('Леска оборвалась! Рыба ушла.', 1);
    else if (d >= 1.08) end('Рыба ушла в глубину.', 1);
    else if (d <= 0) {
      S = 'res'; hold = 0;
      $('cn').textContent = fish.name; $('cw').textContent = w.toFixed(2) + ' кг'; $('cp').textContent = 'Стоимость: ' + priceFor(fish, w) + ' ₽';
      cardFish();
      $('card').style.display = 'flex'; label(); if (tut === 3) setTut(4);
    }
  } else if (S === 'out') {
    outT += dt / .9;
    if (outT >= 1) { end(outMsg); if (tut === 4) setTut(5); }
  }
}
async function finish(keep) {
  $('card').firstElementChild.classList.remove('hl');
  $('card').style.display = 'none';
  S = 'out'; outT = 0; outKeep = keep; label();
  outMsg = keep ? `Рыба в инвентаре, +${priceFor(fish, w)} ₽.` : 'Рыба отпущена.';
  try {
    const result = await post('/api/catch', {fish_id: fish.id, location: sl.value, weight: w, kept: keep});
    if (!result.ok) { outMsg = result.error || 'Улов не сохранён.'; say(outMsg); }
    (result.new_achievements || []).forEach(code => {
      const a = ACHS.find(x => x.code === code);
      if (a) toast('Новое достижение!', `${a.name} — ${a.hint}`);
    });
    await refresh();
  } catch (e) { outMsg = 'Нет связи с сервером: улов не подтверждён.'; say(outMsg); }
}
$('keep').onclick = () => S === 'res' && finish(true);
$('rel').onclick = () => S === 'res' && finish(false);

// ---- магазин и инвентарь ----
let modalTrigger = null;
function modal(id, on) {
  const el = $(id);
  if (on) { modalTrigger = document.activeElement; el.style.display = 'flex'; document.body.style.overflow = 'hidden'; el.querySelector('button').focus(); }
  else if (el.style.display === 'flex') { el.style.display = 'none'; document.body.style.overflow = ''; if (modalTrigger) modalTrigger.focus(); }
}
document.querySelectorAll('.modal').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) modal(el.id, false); });
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') modal(el.id, false);
    if (e.key !== 'Tab') return;
    const buttons = [...el.querySelectorAll('button:not(:disabled)')], first = buttons[0], last = buttons[buttons.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
});
document.querySelectorAll('.x').forEach(b => b.onclick = () => modal(b.closest('.modal').id, false));
function renderShop() {
  $('shopbody').innerHTML = `<div>На счёте: <b>${M} ₽</b></div><table>` + BL.map(b => {
    const fl = F.filter(f => f.baits[b.code]).map(f => f.name).join(', ');
    return `<tr><td><b>${b.name}</b> — ${b.price} ₽<div class="fl">Ловится: ${fl}</div></td><td>в запасе: ${Q[b.code] || 0}</td>
      <td><button data-b="${b.code}" data-n="1">+1</button> <button data-b="${b.code}" data-n="10">+10</button></td></tr>`;
  }).join('') + `</table><section class="boat-product"><div><h3>Лодка</h3><p>Откройте морскую рыбалку навсегда. Четыре новых вида рыб, открытая вода и ловля с лодки.</p><p class="boat-progress">${boatOwned ? 'Лодка приобретена · море открыто' : `Накоплено ${M.toLocaleString('ru-RU')} из ${rub(boatPrice)} ₽`}</p></div><button data-boat ${boatOwned ? 'disabled' : ''}>${boatOwned ? 'Уже куплена' : `Купить лодку · ${rub(boatPrice)} ₽`}</button></section><section class="boat-product"><div><h3>Колокольчики</h3><p>Звон при каждой поклёвке — подсечку не пропустите. Работает во всех локациях, покупка навсегда.</p><p class="boat-progress">${bellsOwned ? 'Колокольчики приобретены · звон включён' : `Накоплено ${M.toLocaleString('ru-RU')} из ${rub(bellsPrice)} ₽`}</p></div><button data-bells ${bellsOwned ? 'disabled' : ''}>${bellsOwned ? 'Уже куплены' : `Купить колокольчики · ${rub(bellsPrice)} ₽`}</button></section>`;
}
$('shopbody').onclick = async e => {
  if (e.target.closest('[data-boat]')) {
    e.target.disabled = true;
    const r = await post('/api/buy', {item: 'boat'}).catch(() => ({}));
    $('shopmsg').textContent = r.ok ? 'Лодка приобретена! Морская рыбалка открыта навсегда.' : (r.error || 'Нет связи с сервером. Повторите покупку.');
    await refresh(); renderShop(); return;
  }
  if (e.target.closest('[data-bells]')) {
    e.target.disabled = true;
    const r = await post('/api/buy', {item: 'bells'}).catch(() => ({}));
    $('shopmsg').textContent = r.ok ? 'Колокольчики приобретены! Теперь поклёвка сопровождается звоном.' : (r.error || 'Нет связи с сервером. Повторите покупку.');
    await refresh(); renderShop(); return;
  }
  const b = e.target.dataset.b; if (!b) return;
  const r = await post('/api/buy', {bait: b, qty: +e.target.dataset.n}).catch(() => ({}));
  $('shopmsg').textContent = r.ok ? '' : (r.error || 'Ошибка покупки');
  await refresh(); renderShop();
};
$('bshop').onclick = () => { $('shopmsg').textContent = ''; renderShop(); modal('shop', 1); };
function renderInv() {
  $('invbody').innerHTML = `<h3>Лодка</h3><p>${boatOwned ? 'В собственности · морская рыбалка открыта навсегда' : `Не приобретена · ${rub(boatPrice)} ₽ в магазине`}</p><h3>Колокольчики</h3><p>${bellsOwned ? 'В собственности · звон при каждой поклёвке' : `Не приобретены · ${rub(bellsPrice)} ₽ в магазине`}</p><h3>Удочки</h3><table>` + R.map((r, i) =>
    `<tr><td>${r.name}</td><td class="fl">дальность ${r.rng}, прочность ×${r.str}, скорость ×${r.spd}</td>
     <td>${+sr.value === i ? 'выбрана' : `<button data-r="${i}" ${sr.disabled ? 'disabled' : ''}>Выбрать</button>`}</td></tr>`).join('') +
    '</table><h3>Наживка</h3><table>' + BL.map(b =>
    `<tr><td>${b.name}</td><td>×${Q[b.code] || 0}</td><td>${sb.value === b.code ? 'выбрана' : `<button data-b="${b.code}" ${sb.disabled ? 'disabled' : ''}>Выбрать</button>`}</td></tr>`).join('') +
    '</table><h3>Рыба</h3>' + (INV.length ? '<table><tr><th>Вид</th><th>Шт.</th><th>Вес, кг</th><th>Рекорд</th></tr>' +
    INV.map(r => `<tr><td>${r.name}</td><td>${r.n}</td><td>${r.kg}</td><td>${r.best.toFixed(2)}</td></tr>`).join('') + '</table>' : '<div class="fl">Пока пусто</div>');
}
$('invbody').onclick = e => {
  if (e.target.dataset.r !== undefined) sr.value = e.target.dataset.r;
  else if (e.target.dataset.b) sb.value = e.target.dataset.b; else return;
  renderInv();
};
$('binv').onclick = () => { renderInv(); modal('inv', 1); };

// ---- отрисовка ----
function rodTip() {
  const bend = S === 'reel' ? t * 65 : 0;
  const back = S === 'charge' ? pw : S === 'fly' ? Math.max(0, 1-cast*4) * pw : 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sway = reduce ? 0 : Math.sin(tt*1.4)*1.3;
  const twitch = !reduce && S === 'bite' ? Math.sin(tt*30)*1.6*Math.max(0, tm/2) : 0;
  const jerk = !reduce && S === 'reel' && sd > 0 ? sd*7 : 0;
  return [448 + back*110 - bend*.2 + sway + jerk*.6 + twitch, 150 - back*115 - bend*.55 + sway + jerk + twitch*.6];
}
function bar(x, y, wd, v, lab, col, dz) {
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x, y, wd, 16);
  g.fillStyle = col; g.fillRect(x, y, wd * Math.min(1, v), 16);
  if (dz) { g.fillStyle = 'rgba(255,60,50,.35)'; g.fillRect(x + wd * .8, y, wd * .2, 16); }
  g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(x, y, wd, 16);
  g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(lab, x, y - 4);
}
function drawFish(px, py, gc = g) {
  const rx = 8 + Math.min(20, w * 3 + 6), ry = 6 + Math.min(10, w * 1.2);
  gc.save(); gc.translate(px, py);
  const sheen = gc.createLinearGradient(0, -ry, 0, ry);
  sheen.addColorStop(0, '#425c49'); sheen.addColorStop(.4, fish.color); sheen.addColorStop(1, '#dfd8b4');
  shape(gc, [[rx-2,0],[rx+13,-ry*.85],[rx+10,0],[rx+13,ry*.85]], fish.color);
  shape(gc, [[-rx*.3,-ry+2],[rx*.2,-ry-6],[rx*.5,-ry+3]], '#687653');
  gc.fillStyle = sheen; gc.beginPath(); gc.ellipse(0,0,rx,ry,0,0,7); gc.fill();
  gc.strokeStyle = 'rgba(42,61,44,.3)'; gc.lineWidth = .7;
  for(let x=-rx+8;x<rx-2;x+=5) for(let y=-ry+4;y<ry-2;y+=5){gc.beginPath();gc.arc(x,y,2,-1,1);gc.stroke();}
  gc.beginPath();gc.ellipse(-rx*.55,0,3,ry*.75,0,-1.5,1.5);gc.stroke();
  shape(gc, [[-3,2],[6,ry+3],[8,3]], '#8d986f');
  gc.fillStyle = '#e7e1c3'; gc.beginPath();gc.arc(-rx+5,-2,2.5,0,7);gc.fill();
  gc.fillStyle = '#182d28'; gc.beginPath();gc.arc(-rx+5,-2,1.4,0,7);gc.fill();gc.restore();
}
function cardFish() {
  const cg = $('cfish').getContext('2d');
  cg.setTransform(2, 0, 0, 2, 0, 0);
  cg.clearRect(0, 0, 150, 80);
  cg.save(); cg.translate(65, 42); cg.scale(1.5, 1.5); drawFish(0, 0, cg); cg.restore();
}
function draw() {
  const l = L[sl.value];
  g.setTransform(2, 0, 0, 2, 0, 0);
  const time = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : tt;
  g.save();
  if(l.code==='sea') { drawSea(time); g.save();drawBoat(time);g.restore(); }
  else {
  drawEnvironment(l,time);
  drawFirstPersonDock();
  }
  drawFog(g, time);
  const [tx, ty] = rodTip(), target=waterPoint(bx);
  let px=null, py=0, scale=1;
  if(S==='fly') {px=tx+(target[0]-tx)*cast;py=ty+(target[1]-ty)*cast-Math.sin(cast*Math.PI)*90;scale=1-cast*.35;}
  else if(S==='wait'||S==='bite') {px=target[0]+windDrift(time);py=target[1]+(S==='bite'?5+Math.sin(tt*30)*3:Math.sin(time*2)*1.3);scale=target[2];}
  else if(S==='reel'||S==='res') {const p=waterPoint(bx*Math.max(0,d));px=p[0]+Math.sin(time*6)*(sd>0?10:2);py=p[1];scale=p[2];}
  if(px!==null){
    g.strokeStyle='rgba(217,235,217,.35)';g.lineWidth=1;
    for(let i=0;i<(S==='fly'?0:2);i++){const r=6+((time*9+i*12)%24);g.beginPath();g.ellipse(px,py+5,r*scale,r*scale*.22,0,0,7);g.stroke();}
    g.strokeStyle=S==='reel'&&t>.8?'#ff8b72':'rgba(246,244,218,.85)';g.lineWidth=.9;
    g.beginPath();g.moveTo(tx,ty);g.quadraticCurveTo((tx+px)/2,(ty+py)/2+(S==='reel'?(1-t)*28:20),px,py);g.stroke();
    if(S==='reel'&&sd>0){g.strokeStyle='rgba(233,244,226,.7)';g.lineWidth=1.2;
      for(let i=0;i<3;i++){const a=-Math.PI/2+(i-1)*.55,r=(9+sd*12)*scale;
        g.beginPath();g.moveTo(px+Math.cos(a)*r*.35,py+Math.sin(a)*r*.35);g.lineTo(px+Math.cos(a)*r,py+Math.sin(a)*r);g.stroke();}}
    // Рыба видна только в воздухе: анимация «забрать/отпустить» после решения.
    if(S==='fly'||S==='wait'||S==='bite'){g.save();g.translate(px,py);g.scale(scale,scale);g.strokeStyle='#eee5c8';g.lineWidth=1;g.beginPath();g.moveTo(0,-12);g.lineTo(0,4);g.stroke();g.fillStyle='#ef613f';g.beginPath();g.ellipse(0,-5,3,6,0,0,7);g.fill();g.fillStyle='#f0e8cd';g.fillRect(-2,-2,4,4);g.restore();}
  } else if(S!=='out'){
    g.strokeStyle='rgba(246,244,218,.8)';g.lineWidth=.8;g.beginPath();g.moveTo(tx,ty);g.lineTo(tx+3,ty+38);g.stroke();
  }
  if(S==='out'){
    const u=outT;
    g.save();g.translate(400+(outKeep?140*u:0),355-(outKeep?-90*u:100*Math.sin(Math.PI*u)));g.scale(outKeep?1+u:1-u*.6,outKeep?1+u:1-u*.6);drawFish(0,0);g.restore();
    if(!outKeep&&u>.75){g.strokeStyle='rgba(233,244,226,.7)';g.beginPath();g.ellipse(400,355,60*(u-.75),15*(u-.75),0,0,7);g.stroke();}
  }
  drawFirstPersonRod(tx,ty,time);
  g.restore();
  // Оттенок времени суток и эффекты погоды поверх сцены (см. world.js).
  dayTint(g); drawWeatherEffects(g, time);
  if(S==='bite'){g.fillStyle='#fff3d2';g.font='600 28px sans-serif';g.textAlign='center';g.fillText('ПОДСЕКАЙ!',400,60);g.textAlign='left';}
  if(S==='charge') bar(24,30,200,pw,'Сила заброса '+Math.round(pw*100)+'%','#f2b632');
  if(S==='reel') {bar(24,30,220,t,'Натяжение лески',t>.8?'#ff5a4d':'#5fd08a',true);bar(280,30,220,1-Math.min(1,d),'Рыба приближается','#58b4f0');}
}
let accumulator = 0;
function loop(ts) {
  if ($('fishing-view').hidden) { last = ts; accumulator = 0; requestAnimationFrame(loop); return; }
  accumulator += Math.min(.1, (ts - last) / 1000 || 0); last = ts;
  while(accumulator >= 1/60) {update(1/60);accumulator -= 1/60;}
  draw(); requestAnimationFrame(loop);
}
// Первый boot() вызывает auth.js: он проверяет сессию (GET /api/state)
// и запускает игру только после входа или успешной регистрации.

// ---- полноэкранный режим сцены ----
// Fullscreen API там, где он есть; на iPhone и при отказе работает CSS-режим (.is-fs).
(() => {
  const game = document.querySelector('.game'), fsb = $('bfs');
  const moved = ['toasts', 'locations'].map(id => { const el = $(id); return { el, parent: el.parentNode, next: el.nextSibling }; });
  const nativeEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  const isFs = () => game.classList.contains('is-fs');
  const modalOpen = () => document.querySelector('.modal[style*="flex"]');
  function apply(on) {
    game.classList.toggle('is-fs', on);
    document.documentElement.classList.toggle('fs-lock', on);
    // всплывающие окна и уведомления должны быть видны внутри полноэкранного блока
    moved.forEach(m => on ? game.appendChild(m.el) : m.parent.insertBefore(m.el, m.next && m.next.parentNode === m.parent ? m.next : null));
    const t = on ? 'Выйти из полноэкранного режима (F)' : 'Полноэкранный режим (F)';
    fsb.setAttribute('aria-pressed', on); fsb.setAttribute('aria-label', t); fsb.title = t;
  }
  function enter() {
    apply(true);
    const r = game.requestFullscreen || game.webkitRequestFullscreen;
    if (r) try { Promise.resolve(r.call(game)).catch(() => {}); } catch (e) {}
  }
  function exit() {
    apply(false);
    if (nativeEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  }
  const toggle = () => isFs() ? exit() : enter();
  fsb.addEventListener('click', e => { toggle(); if (e.detail) fsb.blur(); });   // после клика мышью пробел снова забрасывает удочку
  const onChange = () => { if (!nativeEl() && isFs()) apply(false); };          // выход по Esc
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
  addEventListener('keydown', e => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || modalOpen()) return;
    if (e.code === 'KeyF' && !e.target.closest('input, textarea, select')) { e.preventDefault(); toggle(); }
    else if (e.key === 'Escape' && isFs() && !nativeEl()) exit();
  });
})();
