// Мультиплеер: рыбаки рядом и живая лента уловов.
// Сервер авторитетен: POST /api/presence — хартбит (локация + статус), в ответ — соседи и лента.
let MP = {players: [], online: 0, counts: {}, feed: []};
let mpBusy = false, mpLastAt = 0, mpFeedSeen = null;
const MP_STATUS_NAMES = {idle: 'Готовит снасти', wait: 'Ждёт поклёвку', fight: 'Вываживает рыбу'};
const MP_DRAW_LIMIT = 6;
const mpStatus = () => S === 'reel' ? 'fight' : (S === 'wait' || S === 'bite') ? 'wait' : 'idle';

async function mpPoll() {
  if (mpBusy || !sl.value || ($('auth') && !$('auth').hidden)) return;
  mpBusy = true; mpLastAt = Date.now();
  try {
    const r = await post('/api/presence', {location: sl.value, status: mpStatus()});
    if (r && r.ok) { MP = r; mpRender(); }
  } catch (e) { /* нет связи — панель и сцена остаются с прошлыми данными */ }
  finally { mpBusy = false; }
}
// Немедленный хартбит при смене статуса/локации, но не чаще раза в секунду.
function mpNotify() { if (Date.now() - mpLastAt > 1000) mpPoll(); }

function mpRender() {
  $('mp-online').textContent = `Рыбаков онлайн: ${MP.online}`;
  $('mp-here-place').textContent = L[sl.value] ? L[sl.value].name : '';
  $('mp-here').innerHTML = MP.players.length
    ? MP.players.map(p => `<li><b>${escapeLocationText(p.username)}</b><span class="mp-status mp-${p.status}">${MP_STATUS_NAMES[p.status] || escapeLocationText(p.status)}</span></li>`).join('')
    : '<li class="mp-empty">Пока вы один на этом берегу. Позовите друга — и рыбачьте вместе.</li>';
  const seen = mpFeedSeen || new Set();
  MP.feed.forEach(r => {
    if (!seen.has(r.id) && mpFeedSeen && r.trophy && r.location_code === sl.value)
      toast('Трофей рядом!', `${escapeLocationText(r.username)} — ${escapeLocationText(r.fish)}, ${r.weight.toFixed(2)} кг`);
    seen.add(r.id);
  });
  mpFeedSeen = seen;
  $('mp-feed').innerHTML = MP.feed.length
    ? MP.feed.map(r => `<li><b>${escapeLocationText(r.username)}</b>${r.trophy ? ' <span class="trophy-tag">трофей</span>' : ''}<span>${escapeLocationText(r.fish)} · ${r.weight.toFixed(2)} кг</span><span class="mp-meta">${escapeLocationText(r.location)} · ${r.kept ? 'в садке' : 'отпущена'}</span><span class="mp-feed-time">${escapeLocationText(r.caught_at.slice(11, 16))}</span></li>`).join('')
    : '<li class="mp-empty">Здесь появятся уловы других рыбаков за последние 10 минут.</li>';
  const chip = $('mp-chip');
  chip.hidden = !MP.players.length;
  chip.textContent = `Рыбаков рядом: ${MP.players.length}`;
}

// ---- силуэты рыбаков на сцене ----
const mpHash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
function drawNearbyAnglers(time) {
  const players = MP.players.slice(0, MP_DRAW_LIMIT);
  if (!players.length) return;
  const P = getPalette(), sea = sl.value === 'sea';
  const body = mix(mix('#2c3a33', P.haze, .2), '#141c26', P.environmentDim);
  const label = rgba(mix('#f2f4ec', P.haze, .2), .9);
  // На реке дальний берег справа занимает мыс — оставляем слоты только слева от него.
  const slots = sl.value === 'river' ? 6 : 8;
  const used = new Set();
  players.forEach(p => {
    const h = mpHash(p.username);
    let slot = h % slots;
    while (used.has(slot)) slot = (slot + 1) % slots;
    used.add(slot);
    const x = 62 + slot * 96 + (h % 23), sway = Math.sin(time * 1.2 + h) * .6, s = .8;
    // Ноги — на кромке дальнего берега (полоса песка над водой), поплавок — у того берега.
    let fy = 187, fx = x + 10, wty = 194;
    g.save();
    g.strokeStyle = body; g.fillStyle = body; g.lineWidth = 1.2; g.lineCap = 'round';
    if (sea) {
      const bob = Math.sin(time * 1.1 + h) * 1.2;
      fy = 195 + (h % 3) * 8 + bob;
      fx = x + 12; wty = fy + 6;
      g.beginPath(); g.ellipse(x, fy + 2, 11, 3.2, 0, 0, 7); g.fill();
    }
    // ноги, корпус, голова
    g.beginPath(); g.moveTo(x - 2 * s, fy); g.lineTo(x, fy - 4 * s); g.lineTo(x + 2 * s, fy); g.stroke();
    g.beginPath(); g.moveTo(x, fy - 4 * s); g.lineTo(x + sway * .4, fy - 10 * s); g.stroke();
    g.beginPath(); g.arc(x + sway * .4, fy - 12 * s, 2 * s, 0, 7); g.fill();
    // удочка и леска: поза зависит от статуса соседа
    const hx = x + sway * .4, hy = fy - 8 * s;
    g.lineWidth = 1;
    if (p.status === 'fight') {
      const jerk = Math.sin(time * 9 + h) * 2;
      g.beginPath(); g.moveTo(hx, hy); g.quadraticCurveTo(hx + 7 * s, hy - 8 * s + jerk, hx + 10 * s, hy - 5 * s + jerk); g.stroke();
      g.strokeStyle = rgba('#f6f4da', .55);
      g.beginPath(); g.moveTo(hx + 10 * s, hy - 5 * s + jerk); g.lineTo(fx, wty); g.stroke();
      g.strokeStyle = rgba(P.waveLight, .6);
      const r = (3 + ((time * 8 + h) % 6)) * s;
      g.beginPath(); g.ellipse(fx, wty, r, r * .3, 0, 0, 7); g.stroke();
    } else if (p.status === 'wait') {
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + 10 * s, hy - 7 * s); g.stroke();
      g.strokeStyle = rgba('#f6f4da', .45);
      g.beginPath(); g.moveTo(hx + 10 * s, hy - 7 * s); g.lineTo(fx, wty); g.stroke();
      g.fillStyle = '#ef613f'; g.beginPath(); g.ellipse(fx, wty, 1.3 * s, 2 * s, 0, 0, 7); g.fill();
    } else {
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + 8 * s, hy - 11 * s + sway); g.stroke();
    }
    g.font = '600 8px sans-serif'; g.textAlign = 'center';
    g.fillStyle = 'rgba(10,20,16,.55)'; g.fillText(p.username, x + .5, fy - 15.5);
    g.fillStyle = label; g.fillText(p.username, x, fy - 16);
    g.textAlign = 'left';
    g.restore();
  });
}

function initMultiplayer() {
  setInterval(() => { if (!document.hidden) mpPoll(); }, 4000);
  sl.addEventListener('change', () => mpPoll());
  mpPoll();
}