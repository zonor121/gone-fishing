// Детали снасти от первого лица: колокольчики на вершинке, свисающий монтаж с наживками и блесна.
const _tfReduce = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const _tfMix = (a, b, t) => typeof mix === 'function' ? mix(a, b, t) : a;
const _tfRgba = (c, a) => typeof rgba === 'function' ? rgba(c, a) : c;
const _tfPalette = () => typeof getPalette === 'function'
  ? getPalette()
  : {
    part: 'day', night: 0, wx: 'clear', environmentDim: 0, foregroundDim: 0,
    haze: '#dfe3d2', waveLight: '#caddd3', waveDark: '#112822',
    water: ['#a2b5af', '#77958b', '#3b625b', '#233f39']
  };

function drawRodBells(gc, rig, state, time, P) {
  if (!rig || !rig.tip) return;
  const pal = P || _tfPalette();
  const dim = pal.foregroundDim || 0;
  const D = c => _tfMix(c, '#141c26', dim);
  const reduce = _tfReduce();

  let mountPos, mountTan, upDir, blankW;
  if (rig.bellMount) {
    mountPos = rig.bellMount.pos;
    mountTan = rig.bellMount.tan;
    upDir = rig.bellMount.up;
    blankW = rig.bellMount.width || 2.2;
  } else {
    const base = rig.blankBase || [rig.tip[0] + 90, rig.tip[1] + 150];
    const dx = rig.tip[0] - base[0], dy = rig.tip[1] - base[1];
    const len = Math.hypot(dx, dy) || 1;
    mountPos = [base[0] + dx * 0.90, base[1] + dy * 0.90];
    mountTan = [dx / len, dy / len];
    upDir = [-mountTan[1], mountTan[0]];
    if (upDir[1] > 0) upDir = [-upDir[0], -upDir[1]];
    blankW = 2.2;
  }

  // Наружная нормаль перпендикулярно бланку в сторону неба (вдали от колец и лески).
  let nx = -mountTan[1], ny = mountTan[0];
  if (nx * upDir[0] + ny * upDir[1] < 0) { nx = -nx; ny = -ny; }
  const outAngle = Math.atan2(ny, nx);

  let osc = 0;
  if (!reduce) {
    if (state === 'bite') osc = Math.sin(time * 52) * 0.34 + Math.cos(time * 37) * 0.14;
    else if (state === 'reel') osc = Math.sin(time * 28) * 0.08;
    else if (state === 'charge') osc = -0.12;
    else if (state === 'fly') osc = Math.sin(time * 22) * 0.15;
    else osc = Math.sin(time * 1.6) * 0.03;
  }

  const clipX = mountPos[0] + nx * (blankW * 0.46);
  const clipY = mountPos[1] + ny * (blankW * 0.46);
  const tAng = Math.atan2(mountTan[1], mountTan[0]);

  gc.save();
  // Тёмно-зелёная пластиковая прищепка-клипса, обхватывающая вершинку бланка.
  gc.save();
  gc.translate(mountPos[0], mountPos[1]);
  gc.rotate(tAng);
  gc.fillStyle = D('#294538');
  gc.strokeStyle = D('#13211a');
  gc.lineWidth = 0.7;
  gc.beginPath();
  gc.roundRect ? gc.roundRect(-2.8, -blankW * 0.52, 5.6, blankW * 1.15, 1.4)
    : gc.rect(-2.8, -blankW * 0.52, 5.6, blankW * 1.15);
  gc.fill();
  gc.stroke();
  gc.restore();

  // Металлическая ось пружины прищепки у основания усиков.
  gc.fillStyle = D('#aeb8b2');
  gc.beginPath();
  gc.arc(clipX, clipY, 1.35, 0, Math.PI * 2);
  gc.fill();

  const bellCenters = [];
  for (const side of [-1, 1]) {
    const a = outAngle + osc + side * 0.34;
    const stemLen = 10.2;
    const midX = clipX + Math.cos(a + osc * 0.25) * (stemLen * 0.52);
    const midY = clipY + Math.sin(a + osc * 0.25) * (stemLen * 0.52);
    const bx = clipX + Math.cos(a) * stemLen;
    const by = clipY + Math.sin(a) * stemLen;
    bellCenters.push([bx, by]);

    // Витая стальная ножка-пружинка.
    gc.strokeStyle = D('#9aa59f');
    gc.lineWidth = 1.05;
    gc.beginPath();
    gc.moveTo(clipX, clipY);
    gc.quadraticCurveTo(midX - side * 1.1, midY + 0.8, bx, by);
    gc.stroke();

    // Объёмный латунный бубенчик.
    const r = 3.05;
    const grad = gc.createRadialGradient(bx - 1.0, by - 1.0, 0.35, bx, by, r * 1.05);
    grad.addColorStop(0, D('#fff6c4'));
    grad.addColorStop(0.45, D('#e0b044'));
    grad.addColorStop(1, D('#855712'));
    gc.fillStyle = grad;
    gc.beginPath();
    gc.arc(bx, by, r, 0, Math.PI * 2);
    gc.fill();

    gc.strokeStyle = D('#5c3b0a');
    gc.lineWidth = 0.55;
    gc.stroke();

    // Крестообразная прорезь резонатора.
    gc.strokeStyle = D('#2d1c05');
    gc.lineWidth = 0.75;
    gc.beginPath();
    gc.moveTo(bx - 1.1, by + 1.0);
    gc.lineTo(bx + 1.1, by + 1.0);
    gc.moveTo(bx, by + 0.2);
    gc.lineTo(bx, by + 1.8);
    gc.stroke();

    // Блик на латуни.
    gc.fillStyle = 'rgba(255,252,235,0.72)';
    gc.beginPath();
    gc.arc(bx - 0.95, by - 1.05, 0.75, 0, Math.PI * 2);
    gc.fill();
  }

  // Звуковые волны вокруг колокольчиков в момент поклёвки.
  if (state === 'bite' && !reduce) {
    const midBellX = (bellCenters[0][0] + bellCenters[1][0]) * 0.5;
    const midBellY = (bellCenters[0][1] + bellCenters[1][1]) * 0.5;
    const pulse = (time * 5.2) % 1;
    for (let i = 0; i < 2; i++) {
      const p = (pulse + i * 0.5) % 1;
      const rad = 5.5 + p * 8.5;
      const alpha = (1 - p) * 0.65 * (1 - dim * 0.35);
      gc.strokeStyle = `rgba(255,226,120,${alpha.toFixed(3)})`;
      gc.lineWidth = 1.05;
      gc.beginPath();
      gc.arc(midBellX, midBellY, rad, outAngle - 1.1, outAngle - 0.35);
      gc.stroke();
      gc.beginPath();
      gc.arc(midBellX, midBellY, rad, outAngle + 0.35, outAngle + 1.1);
      gc.stroke();
    }
  }
  gc.restore();
}

function _paintFallbackFloat(gc, D) {
  gc.strokeStyle = D('#3e473f');
  gc.lineWidth = 0.9;
  gc.beginPath();
  gc.moveTo(0, 1);
  gc.lineTo(0, 8);
  gc.stroke();
  gc.fillStyle = D('#e04d2f');
  gc.beginPath();
  gc.ellipse(0, -4, 3, 5, 0, 0, Math.PI * 2);
  gc.fill();
  gc.fillStyle = D('#f0e8cd');
  gc.fillRect(-2.2, -1.5, 4.4, 2);
  gc.strokeStyle = D('#f4efe0');
  gc.lineWidth = 1.1;
  gc.beginPath();
  gc.moveTo(0, -7);
  gc.lineTo(0, -14.5);
  gc.stroke();
}

function _paintSpoonBlade(gc, D, roll = 0.25, isAir = false) {
  const wScale = 0.38 + 0.62 * Math.abs(Math.cos(roll));
  const bladeGrad = gc.createLinearGradient(-2.8 * wScale, -6, 2.8 * wScale, 6);
  bladeGrad.addColorStop(0, D('#f8fafc'));
  bladeGrad.addColorStop(0.42, D('#cbd5db'));
  bladeGrad.addColorStop(0.8, D('#7e8b93'));
  bladeGrad.addColorStop(1, D('#d8b85c'));

  gc.save();
  // Заводное кольцо сверху.
  gc.strokeStyle = D('#aeb8bf');
  gc.lineWidth = 0.7;
  gc.beginPath();
  gc.arc(0, -6.2, 1.15, 0, Math.PI * 2);
  gc.stroke();

  // Вогнутый металлический лепесток колеблющейся блесны.
  gc.fillStyle = bladeGrad;
  gc.beginPath();
  gc.moveTo(0, -5.4);
  gc.bezierCurveTo(3.4 * wScale, -2.8, 3.6 * wScale, 3.0, 0, 6.2);
  gc.bezierCurveTo(-3.6 * wScale, 3.0, -3.4 * wScale, -2.8, 0, -5.4);
  gc.closePath();
  gc.fill();
  gc.strokeStyle = D('#48535a');
  gc.lineWidth = 0.55;
  gc.stroke();

  // Яркий блик и алый акцент-мушка у тройника.
  gc.strokeStyle = 'rgba(255,255,248,0.68)';
  gc.lineWidth = 0.65;
  gc.beginPath();
  gc.moveTo(-0.9 * wScale, -3.4);
  gc.quadraticCurveTo(-1.3 * wScale, 0.4, -0.4 * wScale, 3.8);
  gc.stroke();

  gc.fillStyle = D('#d9462f');
  gc.beginPath();
  gc.ellipse(0, 4.6, 1.35 * wScale, 1.9, 0, 0, Math.PI * 2);
  gc.fill();

  if (!isAir) {
    // Тройник под блесной.
    gc.strokeStyle = D('#2f393e');
    gc.lineWidth = 0.8;
    gc.beginPath();
    gc.moveTo(0, 6.2);
    gc.lineTo(0, 9.2);
    gc.moveTo(-1.8, 8.2);
    gc.quadraticCurveTo(-0.9, 10.0, 0, 9.2);
    gc.quadraticCurveTo(0.9, 10.0, 1.8, 8.2);
    gc.stroke();
  }
  gc.restore();
}

function _paintHookBait(gc, D, baitCode, time, reduce) {
  gc.save();
  // Изогнутый стальной крючок.
  gc.strokeStyle = D('#354046');
  gc.lineWidth = 0.9;
  gc.beginPath();
  gc.moveTo(0, 0);
  gc.lineTo(0, 5.2);
  gc.quadraticCurveTo(0, 8.2, 2.5, 7.8);
  gc.quadraticCurveTo(4.0, 7.2, 3.2, 5.1);
  gc.stroke();

  const wiggle = reduce ? 0 : Math.sin(time * 4.2);
  if (baitCode === 'worm') {
    // Извивающийся дождевой червь.
    gc.strokeStyle = D('#6e251d');
    gc.lineWidth = 2.6;
    gc.lineCap = 'round';
    gc.beginPath();
    gc.moveTo(-0.8, 3.2);
    gc.bezierCurveTo(2.4 + wiggle * 0.8, 5.0, -1.8, 8.2, 2.2 - wiggle * 0.9, 10.5);
    gc.stroke();
    gc.strokeStyle = D('#c45848');
    gc.lineWidth = 1.65;
    gc.beginPath();
    gc.moveTo(-0.8, 3.2);
    gc.bezierCurveTo(2.4 + wiggle * 0.8, 5.0, -1.8, 8.2, 2.2 - wiggle * 0.9, 10.5);
    gc.stroke();
  } else if (baitCode === 'maggot') {
    // Пучок светлых личинок опарыша.
    for (const [ox, oy, rot] of [[-0.5, 5.5, -0.35], [1.4, 6.2, 0.3], [0.5, 7.5, 0.85]]) {
      gc.save();
      gc.translate(ox, oy);
      gc.rotate(rot + wiggle * 0.08);
      gc.fillStyle = D('#efe9d1');
      gc.strokeStyle = D('#9a9276');
      gc.lineWidth = 0.45;
      gc.beginPath();
      gc.ellipse(0, 0, 1.15, 2.1, 0, 0, Math.PI * 2);
      gc.fill();
      gc.stroke();
      gc.restore();
    }
  } else if (baitCode === 'corn') {
    // Два золотистых зерна кукурузы.
    for (const [ox, oy, rot] of [[0.6, 5.3, 0.25], [1.8, 6.9, -0.2]]) {
      gc.save();
      gc.translate(ox, oy);
      gc.rotate(rot);
      const cg = gc.createRadialGradient(-0.5, -0.5, 0.3, 0, 0, 2.2);
      cg.addColorStop(0, D('#fff28c'));
      cg.addColorStop(0.6, D('#f2be35'));
      cg.addColorStop(1, D('#b57d14'));
      gc.fillStyle = cg;
      gc.beginPath();
      gc.ellipse(0, 0, 1.85, 1.55, 0, 0, Math.PI * 2);
      gc.fill();
      gc.restore();
    }
  } else if (baitCode === 'shrimp') {
    // Розовая полупрозрачная креветка на крючке.
    gc.save();
    gc.translate(1.2, 6.4);
    gc.rotate(0.25 + wiggle * 0.06);
    gc.fillStyle = D('#ef9a82');
    gc.strokeStyle = D('#a85742');
    gc.lineWidth = 0.5;
    gc.beginPath();
    gc.moveTo(-2.5, -1.6);
    gc.quadraticCurveTo(2.4, -2.5, 3.0, 1.8);
    gc.quadraticCurveTo(0.8, 3.6, -1.6, 2.2);
    gc.quadraticCurveTo(0.5, 0.8, -2.5, -1.6);
    gc.closePath();
    gc.fill();
    gc.stroke();
    gc.fillStyle = D('#1d1b18');
    gc.beginPath();
    gc.arc(-1.4, -0.9, 0.55, 0, Math.PI * 2);
    gc.fill();
    gc.restore();
  }
  gc.restore();
}

function drawHangingRig(gc, tx, ty, state, baitCode, pw, time, P) {
  if (state === 'out') return;
  const pal = P || _tfPalette();
  const dim = pal.foregroundDim || 0;
  const D = c => _tfMix(c, '#141c26', dim);
  const reduce = _tfReduce();
  const baseLine = _tfMix('#f6f4da', pal.haze || '#dfe3d2', 0.25);

  const sway = reduce ? 0 : Math.sin(time * 1.45) * 0.045;
  const pullBack = state === 'charge' ? -0.32 * Math.max(0, Math.min(1, pw || 0)) : 0;
  const ang = sway + pullBack;
  const dx = Math.sin(ang), dy = Math.cos(ang);

  gc.save();
  gc.lineCap = 'round';
  const lineCol = _tfRgba(baseLine, 0.78 * (1 - dim * 0.42));

  if (baitCode === 'spin') {
    const len = 34;
    const sx = tx + dx * len, sy = ty + dy * len;
    gc.strokeStyle = lineCol;
    gc.lineWidth = 0.85;
    gc.beginPath();
    gc.moveTo(tx, ty);
    gc.quadraticCurveTo(tx + dx * len * 0.45 - 1.5, ty + dy * len * 0.5, sx, sy);
    gc.stroke();

    // Миниатюрный вертлюжок.
    gc.fillStyle = D('#535f66');
    gc.beginPath();
    gc.arc(sx, sy, 1.25, 0, Math.PI * 2);
    gc.fill();

    // Колеблющаяся блесна.
    gc.save();
    gc.translate(sx + dx * 6.5, sy + dy * 6.5);
    gc.rotate(-ang * 0.65);
    _paintSpoonBlade(gc, D, reduce ? 0.3 : time * 1.8, false);
    gc.restore();
    gc.restore();
    return;
  }

  // Поплавочная оснастка: верхняя леска -> поплавок -> поводок с дробинками -> крючок с наживкой.
  const floatDist = 24;
  const fx = tx + dx * floatDist, fy = ty + dy * floatDist;
  const hookDist = 47;
  const hx = tx + dx * hookDist, hy = ty + dy * hookDist;

  gc.strokeStyle = lineCol;
  gc.lineWidth = 0.82;
  gc.beginPath();
  gc.moveTo(tx, ty);
  gc.lineTo(fx, fy);
  gc.moveTo(fx, fy);
  gc.lineTo(hx, hy);
  gc.stroke();

  gc.save();
  gc.translate(fx, fy);
  gc.rotate(-ang * 0.85);
  gc.scale(0.76, 0.76);
  if (typeof _paintFloatBody === 'function') _paintFloatBody(gc, D, 1);
  else _paintFallbackFloat(gc, D);
  gc.restore();

  // Две свинцовые дробинки огрузки на поводке.
  for (const [u, r] of [[0.58, 1.35], [0.76, 1.05]]) {
    const wx = fx + (hx - fx) * u, wy = fy + (hy - fy) * u;
    gc.fillStyle = D('#697378');
    gc.beginPath();
    gc.arc(wx, wy, r, 0, Math.PI * 2);
    gc.fill();
    gc.fillStyle = 'rgba(255,255,255,0.45)';
    gc.beginPath();
    gc.arc(wx - r * 0.3, wy - r * 0.3, r * 0.32, 0, Math.PI * 2);
    gc.fill();
  }

  gc.save();
  gc.translate(hx, hy);
  gc.rotate(-ang * 0.5);
  _paintHookBait(gc, D, baitCode || 'worm', time, reduce);
  gc.restore();
  gc.restore();
}

function drawSpinLure(gc, px, py, scale, state, time, P, opts = {}) {
  const pal = P || _tfPalette();
  const dim = pal.foregroundDim || 0;
  const night = pal.night || 0;
  const D = c => _tfMix(c, '#141c26', dim);
  const sc = scale || 1;
  const reduce = _tfReduce();

  if (state === 'fly') {
    const waterY = opts.waterY;
    if (waterY && waterY > py) {
      const alt = Math.min(1, (waterY - py) / 110);
      gc.save();
      gc.fillStyle = _tfRgba(pal.waveDark || '#112822', 0.30 * (1 - alt * 0.65));
      gc.beginPath();
      gc.ellipse(px + 2 * alt, waterY + 2, (3.5 + alt * 6) * sc, (1.2 + alt * 1.8) * sc, 0, 0, Math.PI * 2);
      gc.fill();
      gc.restore();
    }
    const tilt = opts.castProgress !== undefined ? (0.8 - opts.castProgress * 0.5) : 0.45;
    gc.save();
    gc.translate(px, py);
    gc.scale(sc * 0.9, sc * 0.9);
    gc.rotate(tilt);
    _paintSpoonBlade(gc, D, reduce ? 0.25 : time * 14, true);
    gc.restore();
    return;
  }

  const isBite = state === 'bite';
  const flutterSpeed = isBite ? 18 : 5.5;
  const roll = reduce ? 0.25 : time * flutterSpeed;
  const shimmer = Math.pow(Math.abs(Math.cos(roll)), 4);
  const subY = py + (isBite ? 2.5 : 4.0) * sc;
  const clampedSubY = opts.sea && subY > 301 ? 301 : subY;

  gc.save();
  // Подводный блик блесны чуть ниже поверхности.
  gc.save();
  gc.translate(px, clampedSubY);
  gc.scale(sc * 0.95, sc * 0.95);
  gc.rotate(isBite ? Math.sin(time * 22) * 0.45 + 0.55 : 0.85);
  gc.globalAlpha = (0.42 + shimmer * 0.24) * (1 - dim * 0.35);
  _paintSpoonBlade(gc, D, roll, true);
  gc.restore();

  // Поверхностный мениск и мелкая рябь от игры блесны.
  gc.strokeStyle = _tfRgba(pal.waveLight || '#e8f0ec', (isBite ? 0.72 : 0.48) * (1 - dim * 0.35));
  gc.lineWidth = Math.max(0.55, 0.8 * sc);
  gc.beginPath();
  gc.ellipse(px, py, (isBite ? 6.2 : 4.2) * sc, (isBite ? 1.8 : 1.15) * sc, 0, 0, Math.PI * 2);
  gc.stroke();

  // Металлическая вспышка блика на грани блесны.
  if (shimmer > 0.45 || isBite) {
    const glowR = (5 + shimmer * 5) * sc;
    const rg = gc.createRadialGradient(px, py + 1 * sc, 0.4, px, py + 1 * sc, glowR);
    rg.addColorStop(0, `rgba(255,250,218,${(0.45 * shimmer + (isBite ? 0.2 : 0)) * (1 - dim * 0.4)})`);
    rg.addColorStop(1, 'rgba(255,250,218,0)');
    gc.fillStyle = rg;
    gc.beginPath();
    gc.ellipse(px, py + 1 * sc, glowR, glowR * 0.42, 0, 0, Math.PI * 2);
    gc.fill();
  }

  if (night > 0.05) {
    const ng = gc.createRadialGradient(px, py, 0.5, px, py, 10 * sc);
    ng.addColorStop(0, `rgba(255,222,145,${0.28 * night})`);
    ng.addColorStop(1, 'rgba(255,222,145,0)');
    gc.fillStyle = ng;
    gc.beginPath();
    gc.ellipse(px, py, 10 * sc, 4 * sc, 0, 0, Math.PI * 2);
    gc.fill();
  }
  gc.restore();
}
