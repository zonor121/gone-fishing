// Горячие точки на воде и прикормка: круги кормящейся рыбы, бонус точного заброса и облако прикормки.
const HOTSPOT_CFG = {
  naturalCount: 2,
  minDist: 55,
  maxDist: 250,
  minSeparation: 70,
  naturalRadius: 34,
  baitedRadius: 44,
  baitedDefaultDist: 132,
  naturalTtl: [52, 82],
  particleLimit: 48
};

const hotspotState = {
  loc: null,
  spots: [],
  baited: null,
  particles: [],
  nextId: 1
};

const _hsRnd = (a, b) => a + Math.random() * (b - a);
const _hsClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function _pickSpotDist(existing) {
  let best = _hsRnd(HOTSPOT_CFG.minDist, HOTSPOT_CFG.maxDist);
  let bestGap = -1;
  for (let i = 0; i < 16; i++) {
    const candidate = _hsRnd(HOTSPOT_CFG.minDist, HOTSPOT_CFG.maxDist);
    const gap = existing.length
      ? Math.min(...existing.map(s => Math.abs(candidate - s.dist)))
      : 999;
    if (gap >= HOTSPOT_CFG.minSeparation) return Math.round(candidate);
    if (gap > bestGap) { bestGap = gap; best = candidate; }
  }
  return Math.round(best);
}

function _makeNaturalSpot(existing, initialAge = 0) {
  const ttl = _hsRnd(HOTSPOT_CFG.naturalTtl[0], HOTSPOT_CFG.naturalTtl[1]);
  return {
    id: hotspotState.nextId++,
    dist: _pickSpotDist(existing),
    radius: HOTSPOT_CFG.naturalRadius,
    age: Math.min(initialAge, ttl * 0.5),
    ttl,
    phase: Math.random() * Math.PI * 2,
    nextRing: _hsRnd(0.4, 1.8),
    kind: 'natural'
  };
}

function _spawnHotspotParticle(x, y, scale, kind) {
  if (hotspotState.particles.length >= HOTSPOT_CFG.particleLimit) {
    hotspotState.particles.shift();
  }
  const s = Math.max(0.55, scale || 1);
  if (kind === 'crumb') {
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.random() * 20 * s;
    hotspotState.particles.push({
      kind: 'crumb',
      x: x + Math.cos(ang) * rad,
      y: y + Math.sin(ang) * rad * 0.25,
      vx: _hsRnd(-4, 4) * s,
      vy: _hsRnd(2, 6) * s,
      r: _hsRnd(0.9, 1.8) * s,
      life: 0,
      maxLife: _hsRnd(1.4, 2.8),
      alpha: _hsRnd(0.35, 0.65)
    });
  } else {
    hotspotState.particles.push({
      kind: 'bubble',
      x: x + _hsRnd(-16, 16) * s,
      y: y + _hsRnd(-3, 3) * s,
      vx: _hsRnd(-2, 2) * s,
      vy: _hsRnd(-7, -3.5) * s,
      r: _hsRnd(0.8, 1.6) * s,
      life: 0,
      maxLife: _hsRnd(0.7, 1.4),
      alpha: _hsRnd(0.38, 0.68)
    });
  }
}

function resetHotspots(locCode) {
  hotspotState.loc = locCode || null;
  hotspotState.spots = [];
  hotspotState.particles = [];
  if (hotspotState.baited && hotspotState.baited.loc !== locCode) {
    hotspotState.baited = null;
  }
  for (let i = 0; i < HOTSPOT_CFG.naturalCount; i++) {
    hotspotState.spots.push(_makeNaturalSpot(hotspotState.spots, i * 18));
  }
}

function activateGroundbait(locCode, duration = 180, dist = HOTSPOT_CFG.baitedDefaultDist) {
  if (hotspotState.loc !== locCode) resetHotspots(locCode);
  const d = _hsClamp(Math.round(dist), 60, 220);
  const dur = Math.max(10, Number(duration) || 180);
  hotspotState.baited = {
    id: hotspotState.nextId++,
    loc: locCode,
    dist: d,
    radius: HOTSPOT_CFG.baitedRadius,
    ttl: dur,
    maxTtl: dur,
    age: 0,
    phase: Math.random() * Math.PI * 2,
    nextRing: 0.25,
    kind: 'baited'
  };
  if (typeof waterPoint === 'function') {
    const pt = waterPoint(d);
    if (typeof spawnSplash === 'function') spawnSplash(pt[0], pt[1], pt[2], 1.35);
    for (let i = 0; i < 18; i++) _spawnHotspotParticle(pt[0], pt[1], pt[2], 'crumb');
  }
}

function updateHotspots(dt, locCode, time) {
  if (!locCode) return;
  if (hotspotState.loc !== locCode || hotspotState.spots.length === 0) {
    resetHotspots(locCode);
  }
  if (!(dt > 0)) return;

  const hasWP = typeof waterPoint === 'function';
  for (let i = 0; i < hotspotState.spots.length; i++) {
    const s = hotspotState.spots[i];
    s.age += dt;
    s.nextRing -= dt;
    if (s.age >= s.ttl) {
      const others = hotspotState.spots.filter((_, idx) => idx !== i);
      hotspotState.spots[i] = _makeNaturalSpot(others, 0);
      continue;
    }
    if (s.nextRing <= 0) {
      s.nextRing = _hsRnd(1.5, 3.1);
      if (hasWP && s.ttl - s.age > 2) {
        const pt = waterPoint(s.dist);
        _spawnHotspotParticle(pt[0], pt[1], pt[2], 'bubble');
      }
    }
  }

  const b = hotspotState.baited;
  if (b) {
    b.age += dt;
    b.ttl -= dt;
    b.nextRing -= dt;
    if (b.ttl <= 0) {
      hotspotState.baited = null;
    } else if (b.nextRing <= 0) {
      b.nextRing = _hsRnd(0.85, 1.7);
      if (hasWP) {
        const pt = waterPoint(b.dist);
        _spawnHotspotParticle(pt[0], pt[1], pt[2], Math.random() < 0.55 ? 'bubble' : 'crumb');
      }
    }
  }

  for (let i = hotspotState.particles.length - 1; i >= 0; i--) {
    const p = hotspotState.particles[i];
    p.life += dt;
    if (p.life >= p.maxLife) {
      hotspotState.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

function checkHotspotHit(castDist) {
  const b = hotspotState.baited;
  if (b && b.ttl > 0 && Math.abs(castDist - b.dist) <= b.radius) {
    return {
      kind: 'baited',
      dist: b.dist,
      waitMult: 0.55,
      weightBias: 0.50,
      trophyMult: 2.5,
      label: 'Прикормленное место'
    };
  }
  for (const s of hotspotState.spots) {
    if (s.ttl - s.age >= 1.0 && Math.abs(castDist - s.dist) <= s.radius) {
      return {
        kind: 'natural',
        dist: s.dist,
        waitMult: 0.68,
        weightBias: 0.35,
        trophyMult: 2.0,
        label: 'Горячая точка'
      };
    }
  }
  return null;
}

function getHotspotTargets(maxRange) {
  if (!(maxRange > 0)) return [];
  const targets = [];
  const pushTarget = spot => {
    const u = spot.dist / maxRange;
    if (u < 0.06 || u > 0.98) return;
    targets.push({ u, halfW: spot.radius / maxRange, kind: spot.kind });
  };
  if (hotspotState.baited && hotspotState.baited.ttl > 0) {
    pushTarget(hotspotState.baited);
  }
  for (const s of hotspotState.spots) {
    if (s.ttl - s.age >= 1.5) pushTarget(s);
  }
  return targets;
}

function _spotFadeAlpha(spot) {
  if (spot.kind === 'baited') {
    return _hsClamp(spot.age / 1.2, 0.25, 1) * _hsClamp(spot.ttl / 4.0, 0, 1);
  }
  return _hsClamp(spot.age / 2.0, 0.15, 1) * _hsClamp((spot.ttl - spot.age) / 3.0, 0, 1);
}

function _drawSingleHotspot(gc, spot, time, pal, isActive) {
  const [x, y, sc] = waterPoint(spot.dist);
  const fade = _spotFadeAlpha(spot);
  if (fade <= 0.02) return;

  const isBaited = spot.kind === 'baited';
  const rxBase = (isBaited ? 28 : 22) * sc;
  const ryBase = rxBase * 0.24;

  gc.save();
  // Мягкое подводное пятно: тёплое янтарное для прикормки или серебристая рябь для кормящейся рыбы.
  gc.fillStyle = isBaited
    ? `rgba(222,182,92,${(0.18 * fade).toFixed(3)})`
    : `rgba(218,242,232,${(0.11 * fade).toFixed(3)})`;
  gc.beginPath();
  gc.ellipse(x, y, rxBase, ryBase, 0, 0, Math.PI * 2);
  gc.fill();

  if (isBaited) {
    gc.fillStyle = `rgba(164,118,52,${(0.16 * fade).toFixed(3)})`;
    gc.beginPath();
    gc.ellipse(x, y + 1.2 * sc, rxBase * 0.56, ryBase * 0.56, 0, 0, Math.PI * 2);
    gc.fill();
  }

  // Три концентрических расходящихся круга.
  const ringCount = isBaited ? 3 : 2;
  const speed = isBaited ? 0.42 : 0.34;
  for (let i = 0; i < ringCount; i++) {
    const prog = (time * speed + spot.phase * 0.15 + i / ringCount) % 1;
    const rr = (6 + prog * (isBaited ? 28 : 22)) * sc;
    const ringAlpha = (1 - prog) * (isBaited ? 0.55 : 0.44) * fade;
    gc.strokeStyle = isBaited
      ? `rgba(252,226,154,${ringAlpha.toFixed(3)})`
      : `rgba(228,246,238,${ringAlpha.toFixed(3)})`;
    gc.lineWidth = (isBaited ? 1.25 : 0.95) * Math.max(0.65, sc * 0.85);
    gc.beginPath();
    gc.ellipse(x, y, rr, rr * 0.23, 0, 0, Math.PI * 2);
    gc.stroke();
  }

  // Едва заметные всплывающие точки-пузырьки у центра кормовой зоны.
  const dimpleCount = isBaited ? 4 : 3;
  for (let i = 0; i < dimpleCount; i++) {
    const a = spot.phase + i * 2.1 + time * (i % 2 ? 0.6 : -0.45);
    const rad = (isBaited ? 12 : 8) * sc * (0.4 + 0.6 * ((i * 0.37) % 1));
    const dx = Math.cos(a) * rad;
    const dy = Math.sin(a) * rad * 0.25;
    const pulse = 0.45 + 0.55 * Math.sin(time * 3.2 + i * 1.7 + spot.phase);
    gc.fillStyle = isBaited
      ? `rgba(255,238,186,${(0.35 * pulse * fade).toFixed(3)})`
      : `rgba(240,252,248,${(0.32 * pulse * fade).toFixed(3)})`;
    gc.beginPath();
    gc.arc(x + dx, y + dy, (isBaited ? 1.4 : 1.05) * sc, 0, Math.PI * 2);
    gc.fill();
  }

  if (isActive) {
    const pulse = 0.6 + 0.4 * Math.sin(time * 4);
    gc.strokeStyle = isBaited
      ? `rgba(255,222,126,${(0.62 * pulse * fade).toFixed(3)})`
      : `rgba(186,248,220,${(0.55 * pulse * fade).toFixed(3)})`;
    gc.lineWidth = 1.3 * Math.max(0.7, sc);
    gc.beginPath();
    gc.ellipse(x, y, rxBase * 0.86, ryBase * 0.86, 0, 0, Math.PI * 2);
    gc.stroke();
  }
  gc.restore();
}

function drawHotspots(gc, time, P, opts = {}) {
  if (typeof waterPoint !== 'function') return;
  const pal = P || (typeof getPalette === 'function' ? getPalette() : null);
  const active = opts && opts.activeHit ? opts.activeHit : null;

  for (const s of hotspotState.spots) {
    const isActive = Boolean(active && active.kind === 'natural' && Math.abs(active.dist - s.dist) < 1);
    _drawSingleHotspot(gc, s, time, pal, isActive);
  }
  if (hotspotState.baited && hotspotState.baited.ttl > 0) {
    const b = hotspotState.baited;
    const isActive = Boolean(active && active.kind === 'baited' && Math.abs(active.dist - b.dist) < 1);
    _drawSingleHotspot(gc, b, time, pal, isActive);
  }

  if (hotspotState.particles.length) {
    gc.save();
    for (const p of hotspotState.particles) {
      const a = p.alpha * (1 - p.life / p.maxLife);
      if (a <= 0.01) continue;
      gc.fillStyle = p.kind === 'crumb'
        ? `rgba(222,174,92,${a.toFixed(3)})`
        : `rgba(235,250,245,${a.toFixed(3)})`;
      gc.beginPath();
      gc.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      gc.fill();
    }
    gc.restore();
  }
}
