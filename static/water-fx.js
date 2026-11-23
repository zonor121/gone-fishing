// Реалистичные эффекты воды, объёмный поплавок, леска и визуализация вываживания.
const WATER_FX_LIMITS = { ripples: 48, droplets: 70, foam: 36 };
const waterFX = {
  ripples: [],
  droplets: [],
  foam: [],
  rainCooldown: 0,
  ambientCooldown: 1.6,
  biteRippleCooldown: 0,
  reelFxCooldown: 0,
  outSplashDone: false,
  keepDripCooldown: 0,
  prevS: 'idle'
};

const _wfReduce = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const _wfMix = (a, b, t) => typeof mix === 'function' ? mix(a, b, t) : a;
const _wfRgba = (c, a) => typeof rgba === 'function' ? rgba(c, a) : c;
const _wfPalette = () => typeof getPalette === 'function'
  ? getPalette()
  : {
    part: 'day', night: 0, wx: 'clear', environmentDim: 0, foregroundDim: 0,
    haze: '#dfe3d2', waveLight: '#caddd3', waveDark: '#112822',
    water: ['#a2b5af', '#77958b', '#3b625b', '#233f39'], sparkle: '255,237,188'
  };

function resetWaterFX() {
  waterFX.ripples.length = 0;
  waterFX.droplets.length = 0;
  waterFX.foam.length = 0;
  waterFX.rainCooldown = 0;
  waterFX.ambientCooldown = 1.6;
  waterFX.biteRippleCooldown = 0;
  waterFX.reelFxCooldown = 0;
  waterFX.outSplashDone = false;
  waterFX.keepDripCooldown = 0;
  waterFX.prevS = 'idle';
}

function _pushCapped(arr, item, limit) {
  if (arr.length >= limit) arr.shift();
  arr.push(item);
}

function spawnWaterRipple(x, y, scale = 1, strength = 1, opts = {}) {
  const count = opts.count || (strength >= 2.2 ? 3 : strength >= 1.3 ? 2 : 1);
  const squash = opts.squash || 0.22;
  // Ограничение радиуса удерживает ближние всплески на море выше корпуса лодки.
  const maxAllowedR = Math.min(34 * scale, (13 + strength * 9) * scale);
  for (let i = 0; i < count; i++) {
    _pushCapped(waterFX.ripples, {
      x,
      y,
      r: Math.max(1.2, (1.6 + i * 2.2) * scale),
      maxR: Math.max(4 * scale, maxAllowedR - i * 3 * scale),
      alpha: Math.min(0.75, 0.34 + strength * 0.16 - i * 0.08),
      width: (0.55 + Math.min(1.1, strength * 0.3)) * Math.max(0.55, scale * 0.85),
      speed: Math.max(6, (11 + strength * 6.5 - i * 1.8) * scale),
      life: 0,
      maxLife: 0.7 + strength * 0.32 + i * 0.14,
      squash,
      highlight: opts.highlight !== undefined ? Boolean(opts.highlight) : strength >= 1
    }, WATER_FX_LIMITS.ripples);
  }
}

function spawnSplash(x, y, scale = 1, intensity = 1, P = null) {
  const pal = P || _wfPalette();
  spawnWaterRipple(x, y, scale, Math.max(1, intensity * 1.15), { highlight: true });
  const dropCount = Math.min(18, Math.round(5 + intensity * 5.5));
  const dropCol = _wfMix(pal.waveLight || '#d9ebd9', '#ffffff', 0.45);
  for (let i = 0; i < dropCount; i++) {
    const spread = (Math.random() - 0.5) * 1.5;
    const ang = -Math.PI / 2 + spread * 0.82;
    const spd = (26 + Math.random() * 44) * (0.65 + intensity * 0.45) * scale;
    _pushCapped(waterFX.droplets, {
      x: x + (Math.random() - 0.5) * 5 * scale,
      y: y - Math.random() * 2 * scale,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 12 * scale * Math.min(1.8, intensity),
      gravity: 250 * scale,
      waterY: y + (Math.random() - 0.25) * 3 * scale,
      size: (0.85 + Math.random() * 1.35) * Math.max(0.6, scale * 0.85),
      alpha: 0.55 + Math.random() * 0.35,
      life: 0,
      maxLife: 0.36 + Math.random() * 0.36,
      color: dropCol,
      bounce: Math.random() < 0.35
    }, WATER_FX_LIMITS.droplets);
  }
  const foamCount = Math.min(6, Math.max(2, Math.round(2 + intensity * 1.6)));
  for (let i = 0; i < foamCount; i++) {
    const rx = (3.5 + Math.random() * 4.5 * Math.min(1.6, intensity)) * scale;
    _pushCapped(waterFX.foam, {
      x: x + (Math.random() - 0.5) * 8 * scale,
      y: y + (Math.random() - 0.5) * 2.5 * scale,
      rx,
      ry: rx * 0.27,
      vx: (Math.random() - 0.5) * 9 * scale,
      vy: (Math.random() - 0.5) * 1.8 * scale,
      grow: (3.2 + Math.random() * 2.5) * scale,
      alpha: 0.24 + Math.min(0.26, intensity * 0.1),
      life: 0,
      maxLife: 0.55 + Math.random() * 0.5
    }, WATER_FX_LIMITS.foam);
  }
}

function spawnFoamWake(x, y, scale = 1, dx = 0, intensity = 1) {
  const dir = dx === 0 ? 0 : Math.sign(dx);
  const count = intensity >= 1.2 ? 3 : intensity >= 0.7 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const rx = (4 + Math.random() * 5 * Math.min(1.5, intensity)) * scale;
    _pushCapped(waterFX.foam, {
      x: x - dir * (2 + i * 4) * scale + (Math.random() - 0.5) * 6 * scale,
      y: y + (Math.random() - 0.5) * 3 * scale,
      rx,
      ry: rx * 0.26,
      vx: -dir * (4 + Math.random() * 6) * scale + (Math.random() - 0.5) * 4 * scale,
      vy: (Math.random() - 0.5) * 1.6 * scale,
      grow: (4 + Math.random() * 3) * scale,
      alpha: 0.22 + Math.min(0.28, intensity * 0.12),
      life: 0,
      maxLife: 0.65 + Math.random() * 0.45
    }, WATER_FX_LIMITS.foam);
  }
  if (intensity >= 0.75) {
    spawnWaterRipple(x, y, scale, Math.min(1.6, 0.7 + intensity * 0.45), { count: 1, highlight: true });
  }
}

function updateWaterFX(dt, state, info = {}) {
  if (!(dt > 0)) return;
  const reduce = _wfReduce();
  const sea = Boolean(info.sea);
  const wx = info.weather || (typeof currentWeather === 'function' ? currentWeather() : 'clear');

  for (let i = waterFX.ripples.length - 1; i >= 0; i--) {
    const r = waterFX.ripples[i];
    r.life += dt;
    r.r += r.speed * dt;
    if (r.life >= r.maxLife || r.r >= r.maxR) waterFX.ripples.splice(i, 1);
  }

  for (let i = waterFX.droplets.length - 1; i >= 0; i--) {
    const d = waterFX.droplets[i];
    d.life += dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vy += d.gravity * dt;
    if (d.life >= d.maxLife || (d.vy > 0 && d.y >= d.waterY)) {
      if (!reduce && d.vy > 0 && d.y >= d.waterY && d.bounce && waterFX.ripples.length < WATER_FX_LIMITS.ripples) {
        spawnWaterRipple(d.x, d.waterY, Math.max(0.45, d.size * 0.4), 0.35, { count: 1, highlight: false });
      }
      waterFX.droplets.splice(i, 1);
    }
  }

  for (let i = waterFX.foam.length - 1; i >= 0; i--) {
    const f = waterFX.foam[i];
    f.life += dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.rx += f.grow * dt;
    f.ry += f.grow * 0.26 * dt;
    if (f.life >= f.maxLife) waterFX.foam.splice(i, 1);
  }

  if (reduce) {
    waterFX.prevS = state;
    return;
  }

  // Фоновые круги на воде: в дождь частые, в тихую погоду редкие всплески малька.
  if (wx === 'rain') {
    waterFX.rainCooldown -= dt;
    if (waterFX.rainCooldown <= 0) {
      waterFX.rainCooldown = 0.08 + Math.random() * 0.1;
      const z = Math.random();
      const yMin = sea ? 190 : 196, yMax = sea ? 298 : 360;
      const y = yMin + z * z * (yMax - yMin);
      const x = 40 + Math.random() * 720;
      spawnWaterRipple(x, y, 0.35 + z * 0.5, 0.35, { count: 1, highlight: false });
    }
  } else if (wx === 'clear' || wx === 'fog') {
    waterFX.ambientCooldown -= dt;
    if (waterFX.ambientCooldown <= 0) {
      waterFX.ambientCooldown = 2.4 + Math.random() * 3.0;
      const z = 0.2 + Math.random() * 0.65;
      const yMin = sea ? 194 : 202, yMax = sea ? 286 : 335;
      const y = yMin + z * z * (yMax - yMin);
      const x = 80 + Math.random() * 640;
      spawnWaterRipple(x, y, 0.45 + z * 0.45, 0.65, { count: 2, highlight: true });
    }
  }

  const px = info.px, py = info.py, sc = info.scale || 1;
  if (px !== null && px !== undefined) {
    if (state === 'wait') {
      waterFX.biteRippleCooldown -= dt;
      if (waterFX.biteRippleCooldown <= 0) {
        waterFX.biteRippleCooldown = wx === 'wind' ? 0.55 + Math.random() * 0.45 : 1.1 + Math.random() * 0.9;
        spawnWaterRipple(px, py + 2 * sc, sc * 0.8, 0.45, { count: 1, highlight: false });
      }
    } else if (state === 'bite') {
      waterFX.biteRippleCooldown -= dt;
      if (waterFX.biteRippleCooldown <= 0) {
        waterFX.biteRippleCooldown = 0.18 + Math.random() * 0.14;
        spawnWaterRipple(px, py + 2 * sc, sc * 0.9, 0.95, { count: 1, highlight: true });
      }
    } else if (state === 'reel') {
      waterFX.reelFxCooldown -= dt;
      const surge = info.surge || 0;
      const hold = Boolean(info.hold);
      const weight = info.weight || 1;
      const style = info.style || 'calm';
      const dist = info.dist !== undefined ? info.dist : 1;
      if (waterFX.reelFxCooldown <= 0 && (surge > 0 || (hold && dist < 0.85))) {
        const rate = surge > 0 ? (style === 'dart' ? 0.11 : 0.16) : 0.26;
        waterFX.reelFxCooldown = rate;
        const intense = Math.min(1.8, (surge > 0 ? 0.85 : 0.45) + Math.cbrt(weight) * 0.28);
        const dx = info.dx || Math.cos((info.time || 0) * 6);
        spawnFoamWake(px, py + 2 * sc, sc, dx, intense);
        if (surge > 0 && (style === 'dart' || style === 'heavy' || Math.random() < 0.55)) {
          spawnSplash(px, py, sc * 0.85, intense * 0.85, info.palette);
        }
      }
    }
  }
  waterFX.prevS = state;
}

function drawWaterFX(gc, P) {
  const pal = P || _wfPalette();
  const foamCol = _wfMix(pal.waveLight || '#e8efe8', '#ffffff', 0.45);
  const rippleLight = pal.waveLight || '#caddd3';
  const rippleDark = pal.waveDark || '#112822';
  const dim = pal.environmentDim || 0;

  if (waterFX.foam.length) {
    gc.save();
    for (const f of waterFX.foam) {
      const k = 1 - f.life / f.maxLife;
      const a = f.alpha * k * k * (1 - dim * 0.45);
      if (a <= 0.005) continue;
      gc.fillStyle = _wfRgba(foamCol, a);
      gc.beginPath();
      gc.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, 7);
      gc.fill();
      gc.fillStyle = _wfRgba('#ffffff', a * 0.45);
      gc.beginPath();
      gc.ellipse(f.x - f.rx * 0.15, f.y - f.ry * 0.2, f.rx * 0.55, f.ry * 0.5, 0, 0, 7);
      gc.fill();
    }
    gc.restore();
  }

  if (waterFX.ripples.length) {
    gc.save();
    for (const r of waterFX.ripples) {
      const k = 1 - r.life / r.maxLife;
      const a = r.alpha * Math.pow(k, 1.35) * (1 - dim * 0.35);
      if (a <= 0.005) continue;
      const ry = r.r * r.squash;
      gc.lineWidth = r.width;
      gc.strokeStyle = _wfRgba(rippleDark, a * 0.45);
      gc.beginPath();
      gc.ellipse(r.x, r.y + 0.8, r.r, ry, 0, 0.1, Math.PI - 0.1);
      gc.stroke();
      gc.strokeStyle = _wfRgba(r.highlight ? _wfMix(rippleLight, '#ffffff', 0.35) : rippleLight, a);
      gc.beginPath();
      gc.ellipse(r.x, r.y, r.r, ry, 0, 0, 7);
      gc.stroke();
    }
    gc.restore();
  }

  if (waterFX.droplets.length) {
    gc.save();
    gc.lineCap = 'round';
    for (const d of waterFX.droplets) {
      const k = 1 - d.life / d.maxLife;
      const a = d.alpha * Math.min(1, k * 1.4) * (1 - dim * 0.35);
      if (a <= 0.01) continue;
      const spd = Math.hypot(d.vx, d.vy) || 1;
      const nx = d.vx / spd, ny = d.vy / spd;
      const tail = Math.min(5, spd * 0.045) * d.size;
      gc.strokeStyle = _wfRgba(d.color, a);
      gc.lineWidth = d.size;
      gc.beginPath();
      gc.moveTo(d.x - nx * tail, d.y - ny * tail);
      gc.lineTo(d.x, d.y);
      gc.stroke();
      gc.fillStyle = _wfRgba('#ffffff', a * 0.75);
      gc.beginPath();
      gc.arc(d.x, d.y, d.size * 0.42, 0, 7);
      gc.fill();
    }
    gc.restore();
  }
}

function drawRealisticFloat(gc, px, py, scale, state, time, P, opts = {}) {
  const pal = P || _wfPalette();
  const dim = pal.foregroundDim || 0;
  const night = pal.night || 0;
  const D = c => _wfMix(c, '#141c26', dim);
  const sc = scale || 1;

  if (state === 'fly') {
    const waterY = opts.waterY;
    if (waterY && waterY > py) {
      const alt = Math.min(1, (waterY - py) / 110);
      gc.save();
      gc.fillStyle = _wfRgba(pal.waveDark || '#112822', 0.32 * (1 - alt * 0.65));
      gc.beginPath();
      gc.ellipse(px + 2 * alt, waterY + 2, (4 + alt * 7) * sc, (1.4 + alt * 2) * sc, 0, 0, 7);
      gc.fill();
      gc.restore();
    }
    const tilt = opts.castProgress !== undefined ? (0.55 - opts.castProgress * 0.45) : 0.3;
    gc.save();
    gc.translate(px, py);
    gc.scale(sc, sc);
    gc.rotate(tilt);
    _paintFloatBody(gc, D, 1);
    gc.restore();
    return;
  }

  // На воде: wait / bite
  const isBite = state === 'bite';
  const bitePhase = opts.bitePhase !== undefined ? opts.bitePhase : 0;
  const dip = isBite ? (3.5 + Math.sin(bitePhase) * 2.2) * sc : 0;
  const tilt = isBite ? Math.sin(time * 18) * 0.24 + 0.14 : Math.sin(time * 1.8) * 0.045;
  const waterLineY = py + 1.5 * sc;
  const bodyY = py + dip;

  // Отражение в воде (разбитое горизонтальными полосками ряби, строго компактное для моря).
  const maxReflDepth = opts.sea && py > 282 ? Math.max(6, 305 - waterLineY) : 16 * sc;
  if (maxReflDepth > 4) {
    gc.save();
    const strips = 5;
    for (let i = 0; i < strips; i++) {
      const sy = waterLineY + 1 + (i / strips) * maxReflDepth;
      const sh = maxReflDepth / strips;
      const sway = Math.sin(time * 4.2 + i * 1.3) * (0.9 + i * 0.35) * sc;
      const w = (2.6 - i * 0.38) * sc;
      const col = i < 2 ? D('#d84d30') : D('#e8dfc4');
      gc.fillStyle = _wfRgba(col, (0.28 - i * 0.048) * (1 - dim * 0.4));
      gc.beginPath();
      gc.ellipse(px + sway, sy, Math.max(0.7, w), Math.max(0.6, sh * 0.45), 0, 0, 7);
      gc.fill();
    }
    if (night > 0.05) {
      const glowY = Math.min(waterLineY + maxReflDepth * 0.7, waterLineY + 8 * sc);
      const rg = gc.createRadialGradient(px, glowY, 0.5, px, glowY, 10 * sc);
      rg.addColorStop(0, `rgba(255,214,120,${0.32 * night})`);
      rg.addColorStop(1, 'rgba(255,214,120,0)');
      gc.fillStyle = rg;
      gc.beginPath();
      gc.ellipse(px, glowY, 10 * sc, Math.min(5 * sc, maxReflDepth * 0.45), 0, 0, 7);
      gc.fill();
    }
    gc.restore();
  }

  // Погружённый киль под ватерлинией (полупрозрачный эффект преломления).
  gc.save();
  gc.translate(px, bodyY);
  gc.scale(sc, sc);
  gc.rotate(tilt);
  gc.globalAlpha = 0.5;
  gc.strokeStyle = D(_wfMix('#4d5e4c', pal.water[3] || '#233f39', 0.55));
  gc.lineWidth = 1.1;
  gc.beginPath();
  gc.moveTo(0, 1);
  gc.lineTo(0, 6.5);
  gc.stroke();
  gc.restore();

  // Мениск воды в точке входа поплавка.
  gc.save();
  gc.strokeStyle = _wfRgba(pal.waveDark || '#112822', 0.28);
  gc.lineWidth = Math.max(0.6, 0.9 * sc);
  gc.beginPath();
  gc.ellipse(px, waterLineY + 0.5 * sc, 4.4 * sc, 1.3 * sc, 0, 0.1, Math.PI - 0.1);
  gc.stroke();
  gc.strokeStyle = _wfRgba(pal.waveLight || '#e8f0ec', 0.6);
  gc.lineWidth = Math.max(0.5, 0.75 * sc);
  gc.beginPath();
  gc.ellipse(px, waterLineY, 4.2 * sc, 1.2 * sc, 0, 0, 7);
  gc.stroke();
  gc.restore();

  // Надводная часть поплавка: объёмное тело и полосатая антенна.
  gc.save();
  gc.translate(px, bodyY);
  gc.scale(sc, sc);
  gc.rotate(tilt);
  _paintFloatBody(gc, D, 0);
  if (night > 0.05) {
    const tipGlow = gc.createRadialGradient(0, -14.5, 0.5, 0, -14.5, 7);
    tipGlow.addColorStop(0, `rgba(255,230,150,${0.85 * night})`);
    tipGlow.addColorStop(1, 'rgba(255,200,95,0)');
    gc.fillStyle = tipGlow;
    gc.beginPath();
    gc.arc(0, -14.5, 7, 0, 7);
    gc.fill();
  }
  gc.restore();
}

function _paintFloatBody(gc, D, showFullKeel) {
  if (showFullKeel) {
    gc.strokeStyle = D('#3e473f');
    gc.lineWidth = 0.9;
    gc.beginPath();
    gc.moveTo(0, 1);
    gc.lineTo(0, 8);
    gc.stroke();
  }
  // Нижний тёмный конус тела (над ватерлинией или целиком в полёте).
  const bodyGrad = gc.createLinearGradient(-3.6, -7, 3.6, 1);
  bodyGrad.addColorStop(0, D('#f58b62'));
  bodyGrad.addColorStop(0.35, D('#e04d2f'));
  bodyGrad.addColorStop(0.8, D('#9e2918'));
  bodyGrad.addColorStop(1, D('#5e1910'));
  gc.fillStyle = bodyGrad;
  gc.beginPath();
  gc.moveTo(0, -7.8);
  gc.bezierCurveTo(2.8, -7.2, 3.5, -3.5, 2.5, 0.2);
  gc.lineTo(-2.5, 0.2);
  gc.bezierCurveTo(-3.5, -3.5, -2.8, -7.2, 0, -7.8);
  gc.closePath();
  gc.fill();

  // Кремовый разделительный поясок у ватерлинии.
  const collarGrad = gc.createLinearGradient(-2.8, -1, 2.8, 1);
  collarGrad.addColorStop(0, D('#fbf6e4'));
  collarGrad.addColorStop(0.6, D('#e0d5b5'));
  collarGrad.addColorStop(1, D('#9c9072'));
  gc.fillStyle = collarGrad;
  gc.fillRect(-2.4, -1.5, 4.8, 2.1);

  // Глянцевый боковой блик на теле поплавка.
  gc.strokeStyle = 'rgba(255,250,235,0.55)';
  gc.lineWidth = 0.7;
  gc.beginPath();
  gc.moveTo(-1.3, -6.2);
  gc.quadraticCurveTo(-2.1, -3.6, -1.5, -1.2);
  gc.stroke();

  // Полосатая антенна.
  gc.strokeStyle = D('#f4efe0');
  gc.lineWidth = 1.25;
  gc.beginPath();
  gc.moveTo(0, -7.5);
  gc.lineTo(0, -14.8);
  gc.stroke();

  gc.strokeStyle = D('#ef5635');
  gc.lineWidth = 1.35;
  gc.beginPath();
  gc.moveTo(0, -9.8);
  gc.lineTo(0, -11.5);
  gc.moveTo(0, -13.0);
  gc.lineTo(0, -15.2);
  gc.stroke();

  // Яркий вершинный маячок.
  gc.fillStyle = D('#ff7b47');
  gc.beginPath();
  gc.arc(0, -15.2, 1.05, 0, 7);
  gc.fill();
}

function drawFishingLine(gc, tx, ty, px, py, state, tension, breakThreshold, surge, time, P) {
  const pal = P || _wfPalette();
  const dim = pal.foregroundDim || 0;
  const baseLine = _wfMix('#f6f4da', pal.haze || '#dfe3d2', 0.25);

  gc.save();
  gc.lineCap = 'round';
  if (px === null || px === undefined) {
    if (state !== 'out') {
      const sway = Math.sin(time * 1.4) * 1.4;
      const ex = tx + 3 + sway, ey = ty + 38;
      gc.strokeStyle = _wfRgba(baseLine, 0.75 * (1 - dim * 0.45));
      gc.lineWidth = 0.85;
      gc.beginPath();
      gc.moveTo(tx, ty);
      gc.quadraticCurveTo(tx + 1 + sway * 0.4, ty + 20, ex, ey);
      gc.stroke();
      // Блестящее грузило/крючок на конце свисающей лески.
      gc.fillStyle = _wfRgba(_wfMix('#cfd7cf', '#141c26', dim), 0.9);
      gc.beginPath();
      gc.arc(ex, ey + 1.2, 1.4, 0, 7);
      gc.fill();
    }
    gc.restore();
    return;
  }

  const isReel = state === 'reel' || state === 'res';
  const warnStart = Math.max(0.4, (breakThreshold || 0.7) - 0.16);
  const heat = isReel ? Math.max(0, Math.min(1, (tension - warnStart) / Math.max(0.08, (breakThreshold || 0.85) - warnStart))) : 0;
  const lineCol = heat > 0
    ? _wfMix(baseLine, '#ff5d47', heat)
    : baseLine;
  const alpha = isReel ? (0.82 + heat * 0.18) : 0.74;
  const sag = isReel
    ? Math.max(0.5, (1 - Math.min(1, tension)) * 22)
    : state === 'fly' ? 12 : (18 + Math.sin(time * 1.7) * 1.6);
  const vib = isReel && surge > 0 ? Math.sin(time * 52) * 1.7 * Math.min(1, surge) : 0;
  const mx = (tx + px) * 0.5 + (state === 'wait' ? Math.sin(time * 1.2) * 2.5 : 0) + vib * 0.6;
  const my = (ty + py) * 0.5 + sag + vib;

  if (heat > 0.15) {
    gc.strokeStyle = _wfRgba('#ff5a43', 0.22 * heat);
    gc.lineWidth = 2.6;
    gc.beginPath();
    gc.moveTo(tx, ty);
    gc.quadraticCurveTo(mx, my, px, py);
    gc.stroke();
  }

  gc.strokeStyle = _wfRgba(lineCol, alpha * (1 - dim * 0.35));
  gc.lineWidth = isReel ? 0.95 + heat * 0.35 : 0.82;
  gc.beginPath();
  gc.moveTo(tx, ty);
  gc.quadraticCurveTo(mx, my, px, py);
  gc.stroke();
  gc.restore();
}

function drawFightWaterFX(gc, px, py, scale, fishObj, weight, dist, surge, fatigue, time, P, opts = {}) {
  const pal = P || _wfPalette();
  const sc = scale || 1;
  const style = (fishObj && fishObj.style) || 'calm';
  const dim = pal.environmentDim || 0;

  // Характерные поверхностные буруны по стилю сопротивления.
  if (surge > 0) {
    gc.save();
    const sprayCol = _wfRgba(_wfMix(pal.waveLight || '#e9f4e2', '#ffffff', 0.4), (0.45 + Math.min(0.35, surge * 0.3)) * (1 - dim * 0.4));
    if (style === 'dart') {
      // Резкий V-образный проход и высокий веер брызг.
      gc.strokeStyle = sprayCol;
      gc.lineWidth = 1.15;
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + (i - 1.5) * 0.42;
        const r = (9 + Math.min(1.2, surge) * 12) * sc;
        gc.beginPath();
        gc.moveTo(px + Math.cos(a) * r * 0.3, py + Math.sin(a) * r * 0.3);
        gc.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
        gc.stroke();
      }
    } else if (style === 'heavy') {
      // Тяжёлый широкий бурун.
      gc.strokeStyle = sprayCol;
      gc.lineWidth = 1.4;
      const r = (8 + Math.sin(time * 10) * 2) * sc;
      gc.beginPath();
      gc.ellipse(px, py + 2 * sc, r * 1.45, r * 0.35, 0, Math.PI * 0.9, Math.PI * 2.1);
      gc.stroke();
    } else if (style === 'diver') {
      // Водоворот с пузырьками при уходе в глубину.
      gc.strokeStyle = _wfRgba(pal.waveDark || '#0f2420', 0.45);
      gc.lineWidth = 1.2;
      const spin = time * 8;
      gc.beginPath();
      gc.ellipse(px, py + 2 * sc, 9 * sc, 2.8 * sc, 0, spin, spin + Math.PI * 1.4);
      gc.stroke();
      gc.fillStyle = sprayCol;
      for (let i = 0; i < 3; i++) {
        const bx = px + Math.cos(spin + i * 2.1) * 6 * sc;
        const by = py + Math.sin(spin + i * 2.1) * 1.8 * sc;
        gc.beginPath();
        gc.arc(bx, by, 1.1 * sc, 0, 7);
        gc.fill();
      }
    } else {
      gc.strokeStyle = sprayCol;
      gc.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 0.5;
        const r = (7 + Math.min(1, surge) * 9) * sc;
        gc.beginPath();
        gc.moveTo(px + Math.cos(a) * r * 0.35, py + Math.sin(a) * r * 0.35);
        gc.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
        gc.stroke();
      }
    }
    gc.restore();
  }
}
