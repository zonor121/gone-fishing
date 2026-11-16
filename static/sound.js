// Звон колокольчиков при поклёвке: файл sounds/collar-bell.mp3, фолбэк — синтез WebAudio.
let audioCtx = null;
let bellBuf = null, bellLoading = false;
// Общий выход всех звуков: мут гасит сразу и эмбиент, и разовые звуки, и катушку.
let masterGain = null;
let muted = localStorage.getItem('sb-muted') === '1';
function master() {
  if (!masterGain) {
    masterGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(audioCtx.destination);
  }
  return masterGain;
}
function setMuted(m) {
  muted = m;
  localStorage.setItem('sb-muted', m ? '1' : '0');
  if (!masterGain || !audioCtx) return;
  const t = audioCtx.currentTime;
  masterGain.gain.cancelScheduledValues(t);
  masterGain.gain.setValueAtTime(masterGain.gain.value, t);
  masterGain.gain.linearRampToValueAtTime(m ? 0 : 1, t + .15);
}
function unlockAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  loadBell();
  loadSfx();
}
function loadBell() {
  if (bellBuf || bellLoading || !audioCtx) return;
  bellLoading = true;
  fetch('sounds/collar-bell.mp3')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(b => audioCtx.decodeAudioData(b))
    .then(buf => { bellBuf = buf; })
    .catch(() => {})
    .finally(() => { bellLoading = false; });
}
// Браузеры разрешают звук только после жеста пользователя.
['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, unlockAudio, {passive: true}));

// Разовые звуки снастей: файл sounds/<имя>.mp3, при его отсутствии — синтез.
const SFX_FILES = {cast: 'sounds/cast-whoosh.mp3', dip: 'sounds/float-dip.mp3', reel: 'sounds/reel-ratchet.mp3'};
const sfxBufs = {}, sfxLoading = {};
function loadSfx() {
  Object.entries(SFX_FILES).forEach(([key, url]) => {
    if (key in sfxBufs || sfxLoading[key] || !audioCtx) return;
    sfxLoading[key] = true;
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(b => audioCtx.decodeAudioData(b))
      .then(buf => { sfxBufs[key] = buf; })
      .catch(() => { sfxBufs[key] = null; })
      .finally(() => { sfxLoading[key] = false; });
  });
}
let noiseBuf = null;
function getNoise() {
  if (noiseBuf) return noiseBuf;
  noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
function sfxPlay(key, vol) {
  const src = audioCtx.createBufferSource(), gain = audioCtx.createGain();
  src.buffer = sfxBufs[key];
  gain.gain.value = vol;
  src.connect(gain).connect(master());
  src.start();
}
// Свист заброса: шум через полосовой фильтр с пролётом по частоте.
function castWhoosh() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  if (sfxBufs.cast) { sfxPlay('cast', .5); return; }
  const t = audioCtx.currentTime;
  const src = audioCtx.createBufferSource(), bp = audioCtx.createBiquadFilter(), gain = audioCtx.createGain();
  src.buffer = getNoise(); src.loop = true;
  bp.type = 'bandpass'; bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.linearRampToValueAtTime(2200, t + .35);
  bp.frequency.linearRampToValueAtTime(500, t + .8);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(.3, t + .06);
  gain.gain.linearRampToValueAtTime(0, t + .8);
  src.connect(bp).connect(gain).connect(master());
  src.start(t); src.stop(t + .85);
}
// «Бульк» погружения поплавка: падающий тон + короткий всплеск.
function floatDip() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  if (sfxBufs.dip) { sfxPlay('dip', .6); return; }
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator(), og = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.exponentialRampToValueAtTime(150, t + .22);
  og.gain.setValueAtTime(0, t);
  og.gain.linearRampToValueAtTime(.4, t + .008);
  og.gain.exponentialRampToValueAtTime(.0001, t + .3);
  osc.connect(og).connect(master());
  osc.start(t); osc.stop(t + .32);
  const src = audioCtx.createBufferSource(), hp = audioCtx.createBiquadFilter(), ng = audioCtx.createGain();
  src.buffer = getNoise();
  hp.type = 'highpass'; hp.frequency.value = 1200;
  ng.gain.setValueAtTime(.12, t);
  ng.gain.exponentialRampToValueAtTime(.0001, t + .12);
  src.connect(hp).connect(ng).connect(master());
  src.start(t); src.stop(t + .13);
}
// Трещотка катушки: луп, пока идёт подмотка. Файл или процедурный буфер щелчков.
let reelSrc = null, reelGain = null, reelClickBuf = null;
function getReelClicks() {
  if (reelClickBuf) return reelClickBuf;
  const sr = audioCtx.sampleRate, period = Math.round(sr / 12), len = period * 6;
  reelClickBuf = audioCtx.createBuffer(1, len, sr);
  const d = reelClickBuf.getChannelData(0), clickLen = Math.round(sr * .006);
  for (let k = 0; k < 6; k++) {
    const off = k * period, amp = k % 2 ? .7 : 1;
    for (let i = 0; i < clickLen; i++)
      d[off + i] = (Math.random() * 2 - 1) * Math.exp(-i / (clickLen * .25)) * amp;
  }
  return reelClickBuf;
}
function reelSound(on) {
  if (!audioCtx || audioCtx.state !== 'running') return;
  if (on && !reelSrc) {
    reelSrc = audioCtx.createBufferSource();
    reelGain = audioCtx.createGain();
    reelSrc.buffer = sfxBufs.reel || getReelClicks();
    reelSrc.loop = true;
    reelGain.gain.setValueAtTime(0, audioCtx.currentTime);
    reelGain.gain.linearRampToValueAtTime(.45, audioCtx.currentTime + .06);
    reelSrc.connect(reelGain).connect(master());
    reelSrc.start();
  } else if (!on && reelSrc) {
    const t = audioCtx.currentTime, src = reelSrc, gain = reelGain;
    reelSrc = null; reelGain = null;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + .06);
    src.stop(t + .08);
  }
}

// Фоновый эмбиент: базовый слой по времени суток + слой погоды, кроссфейды при смене.
// В туман база приглушается lowpass-фильтром, в дождь — тише. Нет файла — слой молчит.
const AMB_BASE_FILES = {morning: 'sounds/amb-morning.mp3', day: 'sounds/amb-day.mp3', evening: 'sounds/amb-evening.mp3', night: 'sounds/amb-night.mp3'};
const AMB_WX_FILES = {rain: 'sounds/wx-rain.mp3', wind: 'sounds/wx-wind.mp3'};
const AMB_XFADE = 1.5;
let ambMaster = null, ambOn = false, ambLastWx = null;
let ambBase = null, ambWx = null;
const ambBufs = {}, ambLoading = {};

function ambLoad(key, url) {
  if (key in ambBufs || ambLoading[key] || !audioCtx) return;
  ambLoading[key] = true;
  fetch(url)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(b => audioCtx.decodeAudioData(b))
    .then(buf => { ambBufs[key] = buf; ambSync(); })
    .catch(() => { ambBufs[key] = null; })
    .finally(() => { ambLoading[key] = false; });
}
function ambBaseTarget() {
  const wx = currentWeather();
  return .7 * (wx === 'fog' ? .6 : 1) * (wx === 'rain' ? .65 : 1);
}
function ambStart(key, withFilter) {
  const buf = ambBufs[key];
  if (!buf) return null;
  const src = audioCtx.createBufferSource(), gain = audioCtx.createGain();
  src.buffer = buf; src.loop = true;
  gain.gain.value = 0;
  let tail = src.connect(gain), filter = null;
  if (withFilter) {
    filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = currentWeather() === 'fog' ? 600 : 18000;
    tail = gain.connect(filter);
  }
  tail.connect(ambMaster);
  src.start();
  return {key, src, gain, filter};
}
function ambFade(layer, target) {
  const t = audioCtx.currentTime;
  layer.gain.gain.setValueAtTime(0, t);
  layer.gain.gain.linearRampToValueAtTime(target, t + AMB_XFADE);
}
function ambStop(layer) {
  if (!layer) return;
  const t = audioCtx.currentTime;
  layer.gain.gain.cancelScheduledValues(t);
  layer.gain.gain.setValueAtTime(layer.gain.gain.value, t);
  layer.gain.gain.linearRampToValueAtTime(0, t + AMB_XFADE);
  layer.src.stop(t + AMB_XFADE + .1);
}
function ambTuneBase() {
  if (!ambBase) return;
  const t = audioCtx.currentTime;
  ambBase.gain.gain.cancelScheduledValues(t);
  ambBase.gain.gain.setValueAtTime(ambBase.gain.gain.value, t);
  ambBase.gain.gain.linearRampToValueAtTime(ambBaseTarget(), t + 1);
  if (ambBase.filter) {
    ambBase.filter.frequency.cancelScheduledValues(t);
    ambBase.filter.frequency.setValueAtTime(ambBase.filter.frequency.value, t);
    ambBase.filter.frequency.linearRampToValueAtTime(currentWeather() === 'fog' ? 600 : 18000, t + 1);
  }
}
function ambSync() {
  if (!audioCtx || audioCtx.state !== 'running' || !ambMaster) return;
  const part = currentDayPart(), wx = currentWeather();
  const wxKey = AMB_WX_FILES[wx] ? wx : null;
  if (!ambBase || ambBase.key !== part) {
    ambStop(ambBase); ambBase = null;
    ambLoad(part, AMB_BASE_FILES[part]);
    if (ambBufs[part]) { ambBase = ambStart(part, true); ambFade(ambBase, ambBaseTarget()); }
  } else if (wx !== ambLastWx) {
    ambTuneBase();
  }
  if (!ambWx || ambWx.key !== wxKey) {
    ambStop(ambWx); ambWx = null;
    if (wxKey) {
      ambLoad(wxKey, AMB_WX_FILES[wxKey]);
      if (ambBufs[wxKey]) { ambWx = ambStart(wxKey, false); ambFade(ambWx, .8); }
    }
  }
  ambLastWx = wx;
}
// Вызывается каждый кадр из game.js: active = вкладка «Рыбалка» видна и окно не скрыто.
function updateAmbience(active) {
  if (!audioCtx || audioCtx.state !== 'running') return;
  if (!ambMaster) {
    ambMaster = audioCtx.createGain();
    ambMaster.gain.value = 0;
    ambMaster.connect(master());
  }
  if (active !== ambOn) {
    ambOn = active;
    const t = audioCtx.currentTime;
    ambMaster.gain.cancelScheduledValues(t);
    ambMaster.gain.setValueAtTime(ambMaster.gain.value, t);
    ambMaster.gain.linearRampToValueAtTime(active ? 1 : 0, t + .4);
  }
  ambSync();
}
// При скрытии окна rAF замирает — гасим эмбиент и катушку сразу, не дожидаясь кадра.
document.addEventListener('visibilitychange', () => { if (document.hidden) { updateAmbience(false); reelSound(false); } });

function bellChime() {
  // Заглушка, если WebAudio недоступен или заблокирован: остаётся текст «Поклёвка!» и «ПОДСЕКАЙ!».
  if (!audioCtx || audioCtx.state !== 'running') return;
  if (bellBuf) {
    const src = audioCtx.createBufferSource(), gain = audioCtx.createGain();
    src.buffer = bellBuf;
    gain.gain.value = .9;
    src.connect(gain).connect(master());
    src.start();
    return;
  }
  const now = audioCtx.currentTime;
  [0, .17, .4].forEach((offset, strike) => {
    const t0 = now + offset, base = strike === 1 ? 1560 : 1320;
    [[1, 1], [2.76, .45], [5.4, .2]].forEach(([ratio, amp]) => {
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(.16 * amp, t0 + .004);
      gain.gain.exponentialRampToValueAtTime(.0001, t0 + .7 / ratio);
      osc.connect(gain).connect(master());
      osc.start(t0); osc.stop(t0 + .8);
    });
  });
}