// Реалистичный полупрозрачный HUD поверх сцены для заброса, поклёвки и вываживания.
function _hudRoundRect(gc, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  if (typeof gc.roundRect === 'function') {
    gc.roundRect(x, y, w, h, rad);
    return;
  }
  gc.moveTo(x + rad, y);
  gc.lineTo(x + w - rad, y);
  gc.quadraticCurveTo(x + w, y, x + w, y + rad);
  gc.lineTo(x + w, y + h - rad);
  gc.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  gc.lineTo(x + rad, y + h);
  gc.quadraticCurveTo(x, y + h, x, y + h - rad);
  gc.lineTo(x, y + rad);
  gc.quadraticCurveTo(x, y, x + rad, y);
  gc.closePath();
}

function _hudPanel(gc, x, y, w, h, r = 10, opts = {}) {
  gc.save();
  // Мягкая тень под карточкой.
  gc.fillStyle = 'rgba(8,18,15,.34)';
  gc.beginPath(); _hudRoundRect(gc, x, y + 2.5, w, h, r); gc.fill();

  // Полупрозрачная тёмно-хвойная стеклянная подложка.
  const bg = gc.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, 'rgba(26,48,41,.86)');
  bg.addColorStop(1, 'rgba(13,27,23,.90)');
  gc.fillStyle = bg;
  gc.beginPath(); _hudRoundRect(gc, x, y, w, h, r); gc.fill();

  // Тонкий верхний блик внутри рамки.
  gc.strokeStyle = 'rgba(255,252,238,.20)';
  gc.lineWidth = .9;
  gc.beginPath();
  gc.moveTo(x + r, y + .8);
  gc.lineTo(x + w - r, y + .8);
  gc.stroke();

  // Окантовка панели (обычная, золотистая для поклёвки или тревожная при перегрузке).
  if (opts.alert > 0) {
    gc.strokeStyle = `rgba(255,96,78,${.35 + .55 * opts.alert})`;
    gc.lineWidth = 1.5;
  } else if (opts.gold > 0) {
    gc.strokeStyle = `rgba(245,206,108,${.55 + .3 * opts.gold})`;
    gc.lineWidth = 1.4;
  } else {
    gc.strokeStyle = 'rgba(255,252,238,.16)';
    gc.lineWidth = 1;
  }
  gc.beginPath(); _hudRoundRect(gc, x, y, w, h, r); gc.stroke();
  gc.restore();
}

function _hudTrack(gc, x, y, w, h, fillRatio, fillStyle, opts = {}) {
  const r = h / 2;
  const clamped = Math.max(0, Math.min(1, fillRatio));
  gc.save();
  gc.fillStyle = 'rgba(6,13,11,.68)';
  gc.beginPath(); _hudRoundRect(gc, x, y, w, h, r); gc.fill();

  // Клип по форме закруглённого трека, чтобы заливка, зоны и опасная зона лежали внутри без острых углов.
  gc.save();
  gc.beginPath(); _hudRoundRect(gc, x, y, w, h, r); gc.clip();
  const zoneRects = Array.isArray(opts.zones) && opts.zones.length
    ? [...opts.zones]
        .sort((a, b) => (a.kind === 'baited' ? 1 : 0) - (b.kind === 'baited' ? 1 : 0))
        .map(z => {
          const lo = Math.max(0, z.u - z.halfW);
          const hi = Math.min(1, z.u + z.halfW);
          return hi > lo ? {
            zx: x + w * lo,
            zw: Math.max(4, w * (hi - lo)),
            inZone: Math.abs(clamped - z.u) <= z.halfW,
            baited: z.kind === 'baited'
          } : null;
        })
        .filter(Boolean)
    : [];
  for (const zr of zoneRects) {
    gc.fillStyle = zr.baited
      ? (zr.inZone ? 'rgba(255,214,96,.42)' : 'rgba(240,190,74,.24)')
      : (zr.inZone ? 'rgba(130,238,208,.36)' : 'rgba(116,214,192,.20)');
    gc.fillRect(zr.zx, y, zr.zw, h);
    gc.fillStyle = zr.baited ? 'rgba(255,226,132,.65)' : 'rgba(168,244,224,.55)';
    gc.fillRect(zr.zx, y, 1, h);
    gc.fillRect(zr.zx + zr.zw - 1, y, 1, h);
  }
  if (opts.dangerZone > 0) {
    const dzW = w * Math.min(1, opts.dangerZone);
    gc.fillStyle = 'rgba(226,64,52,.36)';
    gc.fillRect(x + w - dzW, y, dzW, h);
    gc.fillStyle = 'rgba(255,140,124,.55)';
    gc.fillRect(x + w - dzW, y, 1.2, h);
  }
  if (clamped > 0.005) {
    const fw = w * clamped;
    gc.fillStyle = fillStyle;
    gc.fillRect(x, y, fw, h);
    gc.fillStyle = 'rgba(255,255,255,.26)';
    gc.fillRect(x, y + 1, fw, Math.max(1.5, h * .28));
  }
  for (const zr of zoneRects) {
    gc.fillStyle = zr.baited ? 'rgba(255,232,148,.82)' : 'rgba(176,248,230,.75)';
    gc.fillRect(zr.zx, y, zr.zw, 2);
  }
  if (opts.ticks) {
    gc.fillStyle = 'rgba(255,255,255,.22)';
    for (const u of opts.ticks) gc.fillRect(x + w * u - .5, y + 1, 1, h - 2);
  }
  gc.restore();

  gc.strokeStyle = 'rgba(255,252,238,.18)';
  gc.lineWidth = .8;
  gc.beginPath(); _hudRoundRect(gc, x, y, w, h, r); gc.stroke();

  if (clamped > 0.01 && opts.knobColor) {
    const kx = Math.max(x + r, Math.min(x + w - r, x + w * clamped));
    gc.fillStyle = opts.knobColor;
    gc.beginPath(); gc.arc(kx, y + h / 2, h * .42, 0, 7); gc.fill();
  }
  gc.restore();
}

function drawChargeHud(gc, pw, time, reduce, targets) {
  const x = 275, y = 14, w = 250, h = 46;
  const hitTarget = Array.isArray(targets)
    ? targets.find(z => Math.abs(pw - z.u) <= z.halfW)
    : null;
  _hudPanel(gc, x, y, w, h, 10, hitTarget ? { gold: hitTarget.kind === 'baited' ? .85 : .45 } : {});
  gc.save();
  gc.fillStyle = hitTarget
    ? (hitTarget.kind === 'baited' ? '#ffe48f' : '#b8f5e6')
    : 'rgba(224,234,226,.82)';
  gc.font = '600 10px system-ui,-apple-system,"Segoe UI",sans-serif';
  gc.textAlign = 'left';
  gc.fillText(hitTarget ? (hitTarget.kind === 'baited' ? 'В ПРИКОРМКЕ' : 'ТОЧКА КЛЁВА') : 'СИЛА ЗАБРОСА', x + 14, y + 18);

  gc.fillStyle = hitTarget ? '#ffe89a' : '#f8e6b4';
  gc.font = '700 12px system-ui,-apple-system,"Segoe UI",sans-serif';
  gc.textAlign = 'right';
  gc.fillText(Math.round(pw * 100) + '%', x + w - 14, y + 18);

  const tx = x + 14, ty = y + 26, tw = w - 28;
  const grad = gc.createLinearGradient(tx, ty, tx + tw, ty);
  grad.addColorStop(0, '#8cb85a');
  grad.addColorStop(.55, '#e8b93c');
  grad.addColorStop(1, '#ee7f38');
  _hudTrack(gc, tx, ty, tw, 10, pw, grad, {
    ticks: [.25, .5, .75],
    zones: targets,
    knobColor: hitTarget ? '#fff9d6' : '#fff7dc'
  });
  gc.restore();
}

function drawBiteHud(gc, tm, time, reduce) {
  const x = 284, y = 14, w = 232, h = 54;
  const wave = reduce ? 0 : Math.sin(time * 14);
  const scale = 1 + wave * .018;
  const rem = Math.max(0, Math.min(1, (tm === undefined ? 1 : tm) / 2));

  gc.save();
  gc.translate(x + w / 2, y + h / 2);
  gc.scale(scale, scale);
  gc.translate(-(x + w / 2), -(y + h / 2));

  _hudPanel(gc, x, y, w, h, 12, { gold: .7 + wave * .3 });
  gc.textAlign = 'center';
  gc.fillStyle = 'rgba(8,18,15,.65)';
  gc.font = '700 19px system-ui,-apple-system,"Segoe UI",sans-serif';
  gc.fillText('ПОДСЕКАЙ!', x + w / 2, y + 27);
  gc.fillStyle = '#fff5d6';
  gc.fillText('ПОДСЕКАЙ!', x + w / 2, y + 26);

  gc.fillStyle = 'rgba(232,236,225,.80)';
  gc.font = '500 10px system-ui,-apple-system,"Segoe UI",sans-serif';
  gc.fillText('Нажмите кнопку или Пробел', x + w / 2, y + 41);

  const barGrad = gc.createLinearGradient(x + 16, 0, x + w - 16, 0);
  barGrad.addColorStop(0, '#f25749');
  barGrad.addColorStop(1, '#f5ce6c');
  _hudTrack(gc, x + 16, y + 46, w - 32, 4, rem, barGrad);
  gc.restore();
}

function drawReelHud(gc, tension, breakThreshold, dangerZone, dist, castDist, surge, time, reduce) {
  const x = 180, y = 14, w = 440, h = 50;
  const bt = breakThreshold || .8;
  const dz = dangerZone !== undefined ? dangerZone : (1 - bt);
  const warnStart = Math.max(.35, bt - .15);
  const nearBreak = tension > warnStart;
  const alertAmt = nearBreak ? Math.min(1, (tension - warnStart) / Math.max(.08, bt - warnStart)) : 0;

  _hudPanel(gc, x, y, w, h, 10, { alert: alertAmt });
  gc.save();

  // Вертикальный разделитель в центре карточки.
  gc.strokeStyle = 'rgba(255,252,238,.14)';
  gc.lineWidth = 1;
  gc.beginPath(); gc.moveTo(x + w / 2, y + 9); gc.lineTo(x + w / 2, y + h - 9); gc.stroke();

  // Левая секция: натяжение лески.
  const lx = x + 14, lw = 194;
  gc.font = '600 10px system-ui,-apple-system,"Segoe UI",sans-serif';
  gc.textAlign = 'left';
  gc.fillStyle = 'rgba(224,234,226,.82)';
  gc.fillText('НАТЯЖЕНИЕ', lx, y + 18);

  gc.font = '700 11px system-ui,-apple-system,"Segoe UI",sans-serif';
  gc.textAlign = 'right';
  if (nearBreak) {
    gc.fillStyle = '#ff7b6b';
    gc.fillText('ОСЛАБЬТЕ!', lx + lw, y + 18);
  } else if (surge > 0) {
    gc.fillStyle = '#f7c552';
    gc.fillText('РЫВОК!', lx + lw, y + 18);
  } else {
    gc.fillStyle = '#e8efe9';
    gc.fillText(Math.round(tension * 100) + '%', lx + lw, y + 18);
  }

  const tGrad = gc.createLinearGradient(lx, 0, lx + lw, 0);
  tGrad.addColorStop(0, '#54c47f');
  tGrad.addColorStop(Math.max(.35, Math.min(.75, warnStart)), '#e8b23c');
  tGrad.addColorStop(1, '#f25749');
  _hudTrack(gc, lx, y + 27, lw, 10, tension, tGrad, {
    dangerZone: dz,
    knobColor: nearBreak ? '#ffd2cc' : '#fff8e4'
  });

  // Правая секция: приближение рыбы к берегу.
  const rx = x + w / 2 + 12, rw = 194;
  const distNorm = Math.min(1, Math.max(0, dist));
  const meters = Math.max(1, Math.round((castDist || 120) * distNorm * .08));
  const progress = 1 - distNorm;

  gc.font = '600 10px system-ui,-apple-system,"Segoe UI",sans-serif';
  gc.textAlign = 'left';
  gc.fillStyle = 'rgba(224,234,226,.82)';
  gc.fillText('ДО БЕРЕГА', rx, y + 18);

  gc.font = '700 11px system-ui,-apple-system,"Segoe UI",sans-serif';
  gc.textAlign = 'right';
  gc.fillStyle = '#d6eff7';
  gc.fillText(meters + ' м', rx + rw, y + 18);

  const dGrad = gc.createLinearGradient(rx, 0, rx + rw, 0);
  dGrad.addColorStop(0, '#3886a8');
  dGrad.addColorStop(1, '#6ecae0');
  _hudTrack(gc, rx, y + 27, rw, 10, progress, dGrad);

  // Миниатюрный силуэт рыбки на текущем прогрессе полосы.
  const fx = Math.max(rx + 6, Math.min(rx + rw - 6, rx + rw * progress));
  const fy = y + 32;
  gc.fillStyle = '#f2fbff';
  gc.beginPath(); gc.ellipse(fx, fy, 4.2, 2.2, 0, 0, 7); gc.fill();
  gc.beginPath(); gc.moveTo(fx - 3.5, fy); gc.lineTo(fx - 6.5, fy - 2.4); gc.lineTo(fx - 6.5, fy + 2.4); gc.closePath(); gc.fill();

  gc.restore();
}

function drawHud(gc, state, info = {}) {
  const time = info.time || 0;
  const reduce = Boolean(info.reduce);
  if (state === 'charge') {
    drawChargeHud(gc, info.pw || 0, time, reduce, info.targets);
  } else if (state === 'bite') {
    drawBiteHud(gc, info.tm, time, reduce);
  } else if (state === 'reel') {
    drawReelHud(
      gc,
      info.t || 0,
      info.breakThreshold,
      info.dangerZone,
      info.d !== undefined ? info.d : 1,
      info.bx,
      info.sd || 0,
      time,
      reduce
    );
  }
}
