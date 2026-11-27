// Детерминированные детали окружения: пейзаж кэшируется, рябь рисуется отдельно.
const landscape = document.createElement('canvas');
landscape.width = 1600; landscape.height = 840;
const scenery = landscape.getContext('2d');
let landscapeKey = '', landscapeWeather = '';
const landscapeFrames = new Map();
const noise = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
function rgbOf(c) {
  if (c[0] === '#') { const x = parseInt(c.slice(1), 16); return [(x >> 16) & 255, (x >> 8) & 255, x & 255]; }
  return c.match(/\d+/g).map(Number);
}
const mix = (a, b, t) => { const A = rgbOf(a), B = rgbOf(b); return `rgb(${A.map((v, i) => Math.round(v * (1 - t) + B[i] * t)).join(',')})`; };
const rgba = (c, a) => `rgba(${rgbOf(c).join(',')},${a})`;
function shape(c, points, color) {
  c.fillStyle = color; c.beginPath(); points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath(); c.fill();
}

// Палитры освещения: пейзаж запекается под время суток, а не тонируется сверху.
const PALETTES = {
  dawn: {
    sky: ['#2b3d68', '#836f91', '#e8a888'], sun: [445, 178, 13, '#ffb38a'], halo: '255,178,136',
    ridges: ['#5f697d', '#4c5769', '#38464c', '#293836'], trees: ['#586476', '#465460', '#334444', '#243532'],
    bank: '#444c3d', water: ['#8f858d', '#5c6670', '#344c4a', '#1b2d2b'],
    seaWater: ['#8d848d', '#576473', '#2e4a59', '#142a37'],
    cloud: ['#d9b2a4', '#655c72'], haze: '#cfa396',
    sparkle: '255,196,154', waveLight: '#c9b2ae', waveDark: '#172226', mist: .22
  },
  morning: {
    sky: ['#7f97b0', '#c8b39e', '#efd7a6'], sun: [505, 148, 13, '#ffe9b0'], halo: '255,225,160',
    ridges: ['#b0b6ab', '#909d89', '#6a7f64', '#495f45'], trees: ['#a3b09e', '#879882', '#61795d', '#445b43'],
    bank: '#6e7255', water: ['#b3b3a2', '#84917a', '#4d6e58', '#2a4237'],
    seaWater: ['#b0aca0', '#7d8f8a', '#4a6a70', '#20404c'],
    cloud: ['#f6e8d2', '#bfa88e'], haze: '#e8d9b8',
    sparkle: '255,228,160', waveLight: '#e8dcc0', waveDark: '#2c3a2e', mist: .13
  },
  forenoon: {
    sky: ['#769ab5', '#bdd1ce', '#ebe5c6'], sun: [540, 96, 11, '#fff2cb'], halo: '255,238,188',
    ridges: ['#acb9b2', '#8c9e90', '#687f69', '#485f48'], trees: ['#9fad9f', '#849883', '#60795f', '#435b43'],
    bank: '#6e7255', water: ['#a9b6ab', '#7d9486', '#42685a', '#264138'],
    seaWater: ['#9ea9a6', '#6f8c8f', '#3f6973', '#1c404f'],
    cloud: ['#f3f0e0', '#bcc1af'], haze: '#e4e1c9',
    sparkle: '255,234,176', waveLight: '#d5e0d0', waveDark: '#1c3027', mist: .04
  },
  day: {
    sky: ['#7196ad', '#b4c8ca', '#e3e2ce'], sun: [572, 57, 9, '#fff6da'], halo: '255,246,213',
    ridges: ['#a8b8b4', '#899e92', '#667e6c', '#465e49'], trees: ['#9bac9f', '#829883', '#5f795f', '#425b43'],
    bank: '#6e7255', water: ['#a2b5af', '#77958b', '#3b625b', '#233f39'],
    seaWater: ['#91a6ab', '#648992', '#376775', '#183f52'],
    cloud: ['#eef0e2', '#b9c0ae'], haze: '#dfe3d2',
    sparkle: '255,237,188', waveLight: '#caddd3', waveDark: '#112822', mist: 0
  },
  golden: {
    sky: ['#65829e', '#cbb292', '#f2cf92'], sun: [592, 118, 12, '#ffe5a3'], halo: '255,214,136',
    ridges: ['#9c9d96', '#7d8378', '#5a6a58', '#3c4f3e'], trees: ['#919787', '#767f6c', '#53644e', '#384b3a'],
    bank: '#65644b', water: ['#b8ab92', '#7e8673', '#3e5d52', '#213a34'],
    seaWater: ['#b2a592', '#6c8287', '#355c6d', '#163448'],
    cloud: ['#f5debc', '#a69484'], haze: '#e6ca9c',
    sparkle: '255,218,148', waveLight: '#dfd1b2', waveDark: '#172822', mist: .03
  },
  evening: {
    sky: ['#565a80', '#c07a5c', '#f2b263'], sun: [600, 163, 14, '#ffd28a'], halo: '255,190,110',
    ridges: ['#8d8078', '#6f6a60', '#4d5648', '#33443a'], trees: ['#84796e', '#665f55', '#454f42', '#2e3d34'],
    bank: '#5c5a44', water: ['#c9a27a', '#7d7a64', '#3f5a50', '#1f3630'],
    seaWater: ['#c9a27a', '#6f7d80', '#33556a', '#142c40'],
    cloud: ['#f2c9a0', '#8a6a68'], haze: '#e8b888',
    sparkle: '255,200,130', waveLight: '#e8c9a0', waveDark: '#1c2822', mist: .06
  },
  dusk: {
    sky: ['#1e2a54', '#5e466e', '#cf6e58'], sun: [604, 184, 13, '#ffb078'], halo: '235,126,102',
    ridges: ['#4f4c64', '#3f4052', '#2d3540', '#1f2830'], trees: ['#47465c', '#383b4c', '#28303b', '#1b242a'],
    bank: '#363834', water: ['#7e646e', '#4c4e5c', '#293a42', '#132127'],
    seaWater: ['#7a626e', '#454f61', '#22384a', '#0e1d2a'],
    cloud: ['#ba7f82', '#47425c'], haze: '#9e6e78',
    sparkle: '238,176,148', waveLight: '#a69ab0', waveDark: '#0d171c', mist: .06
  },
  night: {
    sky: ['#0d1626', '#1a2740', '#2c3a52'], sun: [600, 58, 8, '#e9edf4'], halo: '200,220,245',
    ridges: ['#2a3440', '#232d36', '#1b252c', '#141d22'], trees: ['#26303a', '#202a32', '#18222a', '#121a20'],
    bank: '#232a26', water: ['#31404e', '#253540', '#1a2830', '#0d1720'],
    seaWater: ['#2e3d4e', '#22333f', '#16242e', '#0a141c'],
    cloud: ['#3a4a62', '#232f42'], haze: '#33415a',
    sparkle: '205,225,245', waveLight: '#7f95ad', waveDark: '#050d14', mist: .05
  }
};
const PHASE_CYCLE = { dawn: 675, morning: 45, forenoon: 135, day: 225, golden: 315, evening: 405, dusk: 495, night: 585 };
const SUN_ARC = [
  [645, 425, 198, 13, '#ff9d78', '255,152,116', 0],
  [675, 445, 178, 13, '#ffb38a', '255,178,136', .85],
  [720, 505, 148, 13, '#ffe9b0', '255,225,160', 1],
  [810, 505, 148, 13, '#ffe9b0', '255,225,160', 1],
  [855, 540, 96, 11, '#fff2cb', '255,238,188', 1],
  [900, 572, 57, 9, '#fff6da', '255,246,213', 1],
  [990, 572, 57, 9, '#fff6da', '255,246,213', 1],
  [1035, 592, 118, 12, '#ffe5a3', '255,214,136', 1],
  [1080, 600, 163, 14, '#ffd28a', '255,190,110', 1],
  [1170, 600, 163, 14, '#ffd28a', '255,190,110', 1],
  [1215, 604, 184, 13, '#ffb078', '235,126,102', .72],
  [1245, 608, 200, 13, '#e88266', '220,105,90', 0]
];
const MOON_ARC = [
  [470, 645, 165, 8, '#dce5f2', '190,212,240', 0],
  [495, 628, 122, 8, '#e3ebf6', '198,218,244', .55],
  [540, 600, 58, 8, '#e9edf4', '200,220,245', 1],
  [630, 600, 58, 8, '#e9edf4', '200,220,245', 1],
  [675, 570, 116, 8, '#dce5f2', '195,216,242', .45],
  [705, 552, 165, 8, '#d4deec', '185,205,235', 0]
];
function _sampleArc(keys, t) {
  if (t <= keys[0][0] || t >= keys[keys.length - 1][0]) return null;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t >= a[0] && t <= b[0]) {
      const p = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
      const u = p * p * (3 - 2 * p);
      return {
        x: a[1] + (b[1] - a[1]) * u,
        y: a[2] + (b[2] - a[2]) * u,
        r: a[3] + (b[3] - a[3]) * u,
        col: mix(a[4], b[4], u),
        halo: rgbOf(mix(`rgb(${a[5]})`, `rgb(${b[5]})`, u)).join(','),
        alpha: a[6] + (b[6] - a[6]) * u
      };
    }
  }
  return null;
}
function computeCelestial(cycle, tint) {
  const c = ((cycle % 720) + 720) % 720;
  const sunRaw = _sampleArc(SUN_ARC, c < 630 ? c + 720 : c);
  const moonRaw = _sampleArc(MOON_ARC, c);
  return {
    sun: sunRaw ? { ...sunRaw, col: tint(sunRaw.col) } : null,
    moon: moonRaw ? { ...moonRaw, col: tint(moonRaw.col) } : null
  };
}
function getPalette(phase) {
  const blend = phase ? {part: phase, next: phase, amount: 0, cycle: PHASE_CYCLE[phase] || 225}
    : typeof currentDayBlend === 'function' ? currentDayBlend()
    : {part: typeof currentDayPart === 'function' ? currentDayPart() : 'day', amount: 0, cycle: 225};
  const {part, amount} = blend, next = blend.next || part;
  const cycle = blend.cycle !== undefined ? blend.cycle : (PHASE_CYCLE[part] || 225);
  const wx = typeof currentWeather === 'function' ? currentWeather() : 'clear';
  const p = PALETTES[part], q = PALETTES[next];
  const wash = wx === 'rain' ? ['#5c6a70', .38] : wx === 'fog' ? ['#b7c0ba', .34] : wx === 'wind' ? ['#8a9590', .08] : null;
  const tint = c => wash ? mix(c, wash[0], wash[1]) : c;
  const color = (a, b) => amount ? mix(tint(a), tint(b), amount) : tint(a);
  const colors = key => p[key].map((c, i) => color(c, q[key][i]));
  const scalar = (a, b) => a * (1 - amount) + b * amount;
  const nightMap = { dawn: .45, morning: 0, forenoon: 0, day: 0, golden: 0, evening: 0, dusk: .5, night: 1 };
  const envMap = { dawn: .25, morning: 0, forenoon: 0, day: 0, golden: .06, evening: .15, dusk: .325, night: .5 };
  const fgMap = { dawn: .225, morning: 0, forenoon: 0, day: 0, golden: .05, evening: .12, dusk: .285, night: .45 };
  const starMap = { dawn: .28, dusk: .42, night: 1 };
  const glowMap = { dawn: .9, morning: 1, golden: .65, evening: 1, dusk: .85 };
  const night = scalar(nightMap[part] || 0, nightMap[next] || 0);
  const starAlpha = scalar(starMap[part] || 0, starMap[next] || 0);
  const horizonGlow = scalar(glowMap[part] || 0, glowMap[next] || 0);
  const celestial = computeCelestial(cycle, tint);
  const dominant = celestial.sun && (!celestial.moon || celestial.sun.alpha >= celestial.moon.alpha)
    ? celestial.sun : (celestial.moon || celestial.sun);
  const sunTuple = dominant
    ? [dominant.x, dominant.y, dominant.r, dominant.col]
    : [...p.sun.slice(0, 3).map((v, i) => scalar(v, q.sun[i])), mix(p.sun[3], q.sun[3], amount)];
  return {part, next, amount, cycle, wx, night, starAlpha, horizonGlow, celestial,
    sky: colors('sky'), ridges: colors('ridges'), trees: colors('trees'), bank: color(p.bank, q.bank),
    water: colors('water'), seaWater: colors('seaWater'), cloud: colors('cloud'), haze: color(p.haze, q.haze),
    sun: sunTuple,
    halo: rgbOf(mix(p.halo, q.halo, amount)).join(','),
    sparkle: rgbOf(mix(p.sparkle, q.sparkle, amount)).join(','),
    waveLight: color(p.waveLight, q.waveLight), waveDark: color(p.waveDark, q.waveDark),
    environmentDim: scalar(envMap[part] || 0, envMap[next] || 0),
    foregroundDim: scalar(fgMap[part] || 0, fgMap[next] || 0),
    celestialAlpha: wx === 'rain' || wx === 'fog' ? .12 : 1,
    stars: starAlpha > .05 && (wx === 'clear' || wx === 'wind'),
    lit: wx !== 'rain' && wx !== 'fog',
    mist: wx === 'fog' ? .3 : scalar(p.mist, q.mist)};
}

function tree(c, x, y, h, color, pine, sunX = 550) {
  const litDir = sunX >= x ? 1 : -1;
  const shade = mix(color, '#0e1812', .36);
  const lit = mix(color, pine ? '#c8d4a4' : '#d2d8a2', .24);
  const bark = mix(color, '#28241d', .58);
  c.fillStyle = bark;
  const trunkW = Math.max(.6, h / 26);
  c.beginPath();
  c.moveTo(x - trunkW, y);
  c.lineTo(x - trunkW * .25, y - h * (pine ? .9 : .55));
  c.lineTo(x + trunkW * .25, y - h * (pine ? .9 : .55));
  c.lineTo(x + trunkW, y);
  c.closePath();
  c.fill();
  if (pine) {
    // Неровные ярусы пушистых лап хвои со светотенью, вместо плоских треугольников.
    for (let j = 0; j < 12; j++) {
      const v = j / 12, cy = y - h + v * h * .86;
      const r = h * (.03 + Math.pow(v, .9) * .24);
      const lx = r * (.75 + noise(x + j * 3) * .45), rx = r * (.75 + noise(x + j * 7 + 1) * .45);
      const drop = h * (.06 + v * .07);
      const pts = [
        [x, cy - h * .05],
        [x + litDir * rx * .45, cy + drop * .2],
        [x + litDir * rx, cy + drop * .95],
        [x + litDir * rx * .4, cy + drop * .78],
        [x, cy + drop * 1.05],
        [x - litDir * lx * .42, cy + drop * .82],
        [x - litDir * lx, cy + drop * .98],
        [x - litDir * lx * .45, cy + drop * .22]
      ];
      shape(c, pts.map(([px, py]) => [px - litDir * r * .08, py + 1.1]), shade);
      shape(c, pts, color);
      shape(c, [
        [x, cy - h * .05],
        [x + litDir * rx * .55, cy + drop * .18],
        [x + litDir * rx * .92, cy + drop * .82],
        [x + litDir * rx * .32, cy + drop * .46]
      ], lit);
    }
  } else {
    if (h > 18) {
      c.strokeStyle = bark; c.lineWidth = Math.max(.6, h / 38);
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(x, y - h * .42);
        c.quadraticCurveTo(x + side * h * .1, y - h * .58, x + side * h * .18, y - h * .7);
        c.stroke();
      }
    }
    // Три слоя объёмной листвы: глубокая тень, основная масса, освещённый верх.
    const clusters = 18;
    for (let j = 0; j < clusters; j++) {
      const r = h * (.065 + noise(j + x) * .09);
      const dx = (noise(x + j + 9) * 2 - 1) * h * .24;
      const dy = y - h * (.56 + noise(j + x + 8) * .36);
      c.fillStyle = shade;
      c.beginPath(); c.ellipse(x + dx - litDir * r * .18, dy + r * .22, r * 1.02, r * .86, 0, 0, 7); c.fill();
    }
    for (let j = 0; j < clusters; j++) {
      const r = h * (.06 + noise(j + x) * .085);
      const dx = (noise(x + j + 9) * 2 - 1) * h * .24;
      const dy = y - h * (.58 + noise(j + x + 8) * .36);
      c.fillStyle = color;
      c.beginPath(); c.ellipse(x + dx, dy, r, r * .82, 0, 0, 7); c.fill();
      if (dx * litDir >= -h * .04 || dy < y - h * .75) {
        c.fillStyle = lit;
        c.beginPath(); c.ellipse(x + dx + litDir * r * .18, dy - r * .24, r * .68, r * .46, 0, 0, 7); c.fill();
      }
    }
  }
}
function paintSky(c, horizon, treeLine, P = getPalette()) {
  const sky = c.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, P.sky[0]);
  sky.addColorStop(.28, mix(P.sky[0], P.sky[1], .45));
  sky.addColorStop(.58, P.sky[1]);
  sky.addColorStop(.82, mix(P.sky[1], P.sky[2], .55));
  sky.addColorStop(1, P.sky[2]);
  c.fillStyle = sky; c.fillRect(0, 0, 800, horizon + 1);
  // Атмосферная заревая подсветка у горизонта для рассвета, утра, предзаката, заката и сумерек.
  const sx = P.sun[0], hg = P.horizonGlow !== undefined ? P.horizonGlow : (P.part === 'morning' || P.part === 'evening' ? 1 : 0);
  if (hg > .02) {
    const glowA = (P.wx === 'clear' || P.wx === 'wind' ? .28 : .10) * hg;
    const hGlow = c.createRadialGradient(sx, horizon, 6, sx, horizon, 260);
    hGlow.addColorStop(0, `rgba(${P.halo},${glowA})`);
    hGlow.addColorStop(.5, `rgba(${P.halo},${glowA * .35})`);
    hGlow.addColorStop(1, `rgba(${P.halo},0)`);
    c.fillStyle = hGlow; c.fillRect(0, Math.max(0, horizon - 180), 800, 180);
  }
  if (P.stars) {
    const sa = P.starAlpha !== undefined ? P.starAlpha : 1;
    // Мягкая диагональная полоса Млечного Пути.
    for (let i = 0; i < 20; i++) {
      const u = i / 19, mx = 110 + u * 440, my = horizon * .76 - u * horizon * .68;
      const mr = 24 + noise(i + 470) * 26;
      const mg = c.createRadialGradient(mx, my, 1, mx, my, mr);
      mg.addColorStop(0, `rgba(186,204,236,${(.038 * sa).toFixed(4)})`); mg.addColorStop(1, 'rgba(186,204,236,0)');
      c.fillStyle = mg; c.beginPath(); c.arc(mx, my, mr, 0, 7); c.fill();
    }
    const starTints = ['235,241,252', '255,238,210', '202,222,255'];
    for (let i = 0; i < 165; i++) {
      const onBand = i < 55;
      const u = noise(i + 440);
      const x = onBand ? 110 + u * 440 + (noise(i + 441) - .5) * 75 : noise(i + 400) * 800;
      const y = onBand ? horizon * .76 - u * horizon * .68 + (noise(i + 442) - .5) * 42 : noise(i + 410) * horizon * .84;
      const big = noise(i + 420) > .92;
      const a = (.18 + noise(i + 430) * (onBand ? .45 : .65)) * sa;
      const tint = starTints[i % 3];
      c.fillStyle = `rgba(${tint},${a})`;
      c.beginPath(); c.arc(x, y, big ? 1.1 : .55 + noise(i + 435) * .35, 0, 7); c.fill();
      if (big && i % 2 === 0) {
        c.strokeStyle = `rgba(${tint},${a * .42})`; c.lineWidth = .5;
        c.beginPath(); c.moveTo(x - 3.2, y); c.lineTo(x + 3.2, y); c.moveTo(x, y - 3.2); c.lineTo(x, y + 3.2); c.stroke();
      }
    }
  }
  // Тонкие высотные перистые облака в кэше (объёмные кучевые плывут отдельно в drawDynamicSky).
  const ca = P.part === 'night' ? .38 : .85;
  c.save(); c.lineCap = 'round';
  for (let band = 0; band < 5; band++) {
    const x = 60 + noise(band + 55) * 680, y = 18 + noise(band + 21) * horizon * .46;
    for (let j = 0; j < 4; j++) {
      const px = x + (j - 1.5) * 28, py = y + Math.sin(j * .9 + band) * 5;
      const span = 34 + noise(j + band * 17) * 42;
      c.strokeStyle = rgba(P.cloud[0], (.06 + noise(j + band * 9) * .06) * ca);
      c.lineWidth = 1.2 + noise(j + band * 5) * 1.6;
      c.beginPath();
      c.moveTo(px - span, py);
      c.quadraticCurveTo(px, py - 4 - noise(j + band) * 4, px + span, py + 2);
      c.stroke();
    }
  }
  c.restore();
  // Дымка у горизонта скрывает стык неба и дальних гряд.
  const hz = c.createLinearGradient(0, horizon - 55, 0, horizon);
  hz.addColorStop(0, rgba(P.haze, 0)); hz.addColorStop(1, rgba(P.haze, .44));
  c.fillStyle = hz; c.fillRect(0, horizon - 55, 800, 55);
}
const reflectedBank = document.createElement('canvas');
reflectedBank.width=1600;reflectedBank.height=840;
function paintLandscape(l, P = getPalette()) {
  const c=scenery;c.setTransform(2,0,0,2,0,0);
  c.clearRect(0,0,800,420);
  if(l.code==='sea'){paintSea(c,P);return;}
  paintSky(c,190,true,P);
  const sunX = P.sun[0];
  if(l.code==='pond') {
    // Пруд замкнут: естественный разновысокий хвойный бор в 3 плана.
    for(let layer=0;layer<3;layer++) {
      const base=116+layer*26;
      const ridgeY=x=>base+11*Math.sin(x*.011+layer*1.9)+6*Math.cos(x*.027+layer)+26;
      const pts=[[0,200]];
      for(let x=0;x<=820;x+=12)pts.push([x,ridgeY(x)-10]);
      pts.push([800,200]);
      shape(c,pts,mix(P.trees[layer+1],P.haze,.22-layer*.08));
      let x=4;
      for(let i=0;i<68&&x<805;i++) {
        const step=8+noise(i+layer*13)*9;
        const tall=noise(i+layer*37)>.72;
        const h=(tall?56:28)+noise(i+layer*99)*(34+layer*22);
        tree(c,x,ridgeY(x)+8,h,P.trees[layer+1],true,sunX);
        if(layer===2&&noise(i+301)>.55){
          tree(c,x+step*.5,186+noise(i+305)*3,8+noise(i+307)*9,mix(P.trees[3],'#4a6241',.25),false,sunX);
        }
        x+=step;
      }
      if(layer<2){const hz=c.createLinearGradient(0,base,0,200);hz.addColorStop(0,rgba(P.haze,0));hz.addColorStop(1,rgba(P.haze,.15-layer*.05));c.fillStyle=hz;c.fillRect(0,base,800,200-base);}
    }
  } else {
    const layers=l.code==='lake'?2:4, low=l.code==='lake';
    for(let layer=0;layer<layers;layer++) {
      const base=low?158+layer*12:150+layer*10, amp=low?5:9;
      const pts=[[0,200],[0,base]];
      const ridge=x=>base-amp*Math.sin(x*.009+layer)-amp*.8*Math.sin(x*.019+layer*2)-amp*.35*Math.cos(x*.041+layer*3);
      for(let x=0;x<=820;x+=8)pts.push([x,ridge(x)]);
      pts.push([800,200]);shape(c,pts,P.ridges[layer]);
      for(let i=0;i<115;i++) {
        if(low && Math.sin(i*.28+layer*2)+noise(i+layer*19)<.15) continue;
        const x=i*7.1+noise(i)*5,h=(low?7:10)+noise(i+layer*99)*(layer*7+(low?11:18));
        tree(c,x,ridge(x)+4,h,P.trees[layer],l.forest || noise(i+6)>.68,sunX);
      }
      // Воздушная перспектива: дальние гряды сильнее укрыты дымкой (мягкий градиент без кромки).
      if(layer<layers-1){const hz=c.createLinearGradient(0,110,0,200);hz.addColorStop(0,rgba(P.haze,0));hz.addColorStop(1,rgba(P.haze,[.16,.09,.04][layer]));c.fillStyle=hz;c.fillRect(0,110,800,90);}
    }
    if(low) {
      // Дальний берег озера: естественные рощицы и открытые луговые прогалины вместо частокола.
      for(let i=0;i<115;i++){
        const x=i*7.1+noise(i+501)*5;
        const clump=Math.sin(x*.019)+Math.cos(x*.047)*.55+(noise(i+505)-.5)*.9;
        if(clump<-.25)continue;
        const bush=clump<.25;
        const h=bush?(4+noise(i+502)*5):(8+noise(i+502)*16);
        tree(c,x,181+noise(i+503)*2.5,h,mix(P.trees[2],P.haze,.28),!bush&&noise(i+504)>.58,sunX);
      }
    }
  }
  // Береговая кромка, тень-контакт у уреза воды и отражение берега используют одну геометрию.
  const bankCol=l.code==='lake'?mix(P.bank,'#9a8f6a',.45):P.bank;
  shape(c,[[0,182],[130,180],[310,184],[470,181],[640,179],[800,184],[800,191],[0,191]],bankCol);
  c.strokeStyle='rgba(12,22,18,.34)';c.lineWidth=1.6;c.beginPath();c.moveTo(0,189);c.bezierCurveTo(240,183,550,191,800,187);c.stroke();
  c.strokeStyle=rgba(P.haze,.55);c.lineWidth=.7;c.beginPath();c.moveTo(0,187);c.bezierCurveTo(240,181,550,190,800,185);c.stroke();
  const r=reflectedBank.getContext('2d');r.clearRect(0,0,1600,840);r.drawImage(landscape,0,0);
  const water=c.createLinearGradient(0,185,0,420);
  water.addColorStop(0,P.water[0]);
  water.addColorStop(.25,l.code==='pond'?mix(P.water[1],'#375a44',.45):l.code==='lake'?mix(P.water[1],'#6d94a8',.3):l.forest?mix(P.water[1],'#5d7a62',.35):P.water[1]);
  water.addColorStop(.65,l.code==='pond'?mix(P.water[2],'#22402f',.4):l.current?mix(P.water[2],'#3a6b5e',.35):l.code==='lake'?mix(P.water[2],'#3f6f80',.25):P.water[2]);
  water.addColorStop(1,P.water[3]);
  c.fillStyle=water;c.fillRect(0,188,800,232);
  for(let y=188;y<420;y+=2) {
    const depth=(y-188)/232, source=188-(y-188)*.72;
    c.globalAlpha=.42*(1-depth*.8);
    c.drawImage(reflectedBank,0,Math.max(0,source*2),1600,4,Math.sin(y*.61)*depth*5,y,800,2);
  }
  c.globalAlpha=1;
  for(let i=0;i<1400;i++) {
    const z=noise(i+88),y=189+z*z*231,x=noise(i+990)*800;
    c.fillStyle=i%3?'rgba(197,215,200,.055)':'rgba(17,43,36,.1)';
    c.fillRect(x,y,1+z*noise(i+12)*34,.3+z*.6);
  }
  const mistAmt=P.mist+(l.code==='pond'?.08:0);
  if(mistAmt>0) {
    const m=c.createLinearGradient(0,188,0,252);
    m.addColorStop(0,rgba(P.haze,mistAmt));m.addColorStop(1,rgba(P.haze,0));
    c.fillStyle=m;c.fillRect(0,188,800,64);
  }
  if(l.current) {
    // Речной мыс сужает дальний плёс, но не перекрывает зону заброса.
    shape(c,[[800,184],[699,191],[633,204],[681,210],[749,224],[800,241]],mix(P.ridges[3],'#555d43',.5));
    c.strokeStyle=rgba(P.haze,.5);c.lineWidth=1;c.beginPath();c.moveTo(800,242);c.quadraticCurveTo(706,210,633,204);c.stroke();
    for(let i=0;i<170;i++){const x=689+noise(i+36)*111,y=192+noise(i+77)*13;c.strokeStyle=i%2?'#727b50':'#3f563b';c.beginPath();c.moveTo(x,y);c.lineTo(x-2,y-3-noise(i)*8);c.stroke();}
  }
  if(l.code==='river') {
    // Галечная коса слева от струи и два камня с барашками.
    shape(c,[[120,232],[200,227],[280,230],[330,236],[260,242],[160,240]],mix(bankCol,'#8f8a70',.5));
    c.strokeStyle=rgba(P.haze,.4);c.lineWidth=.7;c.beginPath();c.moveTo(120,232);c.quadraticCurveTo(220,225,330,236);c.stroke();
    for(let i=0;i<60;i++){const x=140+noise(i+310)*175,y=230+noise(i+311)*8;c.strokeStyle=i%2?'#6d7a4e':'#47593c';c.lineWidth=.7;c.beginPath();c.moveTo(x,y);c.lineTo(x-1.5,y-3-noise(i+312)*6);c.stroke();}
    for(const [sx,sy,sr2] of [[560,262,7],[210,285,9]]) {
      c.fillStyle=mix('#7d7f66',P.water[3],.3);c.beginPath();c.ellipse(sx,sy,sr2,sr2*.5,0,0,7);c.fill();
      c.strokeStyle=rgba(P.waveLight,.5);c.lineWidth=.8;
      c.beginPath();c.moveTo(sx-sr2-6,sy+2);c.quadraticCurveTo(sx,sy-sr2*.6,sx+sr2+6,sy+2);c.stroke();
    }
  }
  if(l.code==='pond') {
    const dim=P.part==='night'?.55:P.part==='evening'?.2:0;
    for(let i=0;i<40;i++) {
      const x=40+noise(i+63)*200,y=250+noise(i+43)*110,r=3+(y-245)*.06;
      c.fillStyle='rgba(17,38,30,.3)';c.beginPath();c.ellipse(x+2,y+2,r*1.3,r*.35,0,0,7);c.fill();
      c.fillStyle=mix(i%2?'#5e7248':'#788257',P.water[3],dim);c.beginPath();c.ellipse(x,y,r,r*.4,-.12,.2,6);c.lineTo(x,y);c.fill();
      c.strokeStyle=`rgba(188,192,131,${.4*(1-dim)})`;c.lineWidth=.5;c.beginPath();c.moveTo(x,y);c.lineTo(x-r*.7,y);c.stroke();
      if(i%9===0){
        c.fillStyle=mix('#f2f4e8','#8fa088',dim);
        for(let p2=0;p2<5;p2++){const a=p2*1.256+i;c.beginPath();c.ellipse(x+Math.cos(a)*2.4,y+Math.sin(a)*1.2,2,1,a,0,7);c.fill();}
        c.fillStyle=mix('#e8d982','#7a7448',dim);c.beginPath();c.arc(x,y,1.1,0,7);c.fill();
      }
    }
    // Затопленное бревно, уходящее от левого берега в воду.
    shape(c,[[0,303],[148,283],[160,291],[10,315]],mix('#5d4a33',P.water[3],.35));
    c.strokeStyle=mix('#8a7154',P.water[3],.3);c.lineWidth=1;
    c.beginPath();c.moveTo(2,304);c.lineTo(148,284);c.stroke();
    c.strokeStyle=mix('#3f3222',P.water[3],.3);c.lineWidth=.7;
    for(let i=0;i<4;i++){const o=i*2.2;c.beginPath();c.moveTo(4,306+o);c.lineTo(150,287+o*.8);c.stroke();}
    c.strokeStyle=mix('#4a3a28',P.water[3],.3);c.lineWidth=3;
    c.beginPath();c.moveTo(70,296);c.lineTo(76,288);c.stroke();
    c.beginPath();c.moveTo(112,291);c.lineTo(117,284);c.stroke();
    c.fillStyle=mix('#4a3a28',P.water[3],.3);c.beginPath();c.ellipse(154,287,6,3.4,-.13,0,7);c.fill();
    c.fillStyle='rgba(10,25,18,.25)';c.beginPath();c.ellipse(80,318,80,5,0,0,7);c.fill();
  }
  // Ближний берег остаётся по краям, оставляя центр открытым для ловли.
  shape(c,[[0,290],[24,308],[49,349],[82,420],[0,420]],'#303f2d');
  if(l.code==='pond') shape(c,[[800,300],[770,320],[748,360],[726,420],[800,420]],'#2c3a29');
  const stones=l.code==='lake'?45:90;
  for(let i=0;i<stones;i++) {
    const x=noise(i+71)*42,y=335+noise(i+81)*85,r=2+noise(i+91)*7;
    c.fillStyle='rgba(10,16,12,.35)';c.beginPath();c.ellipse(x+1.2,y+1.4,r*1.08,r*.55,-.4,0,7);c.fill();
    const stone=c.createLinearGradient(x,y-r,x,y+r);
    stone.addColorStop(0,l.code==='lake'?'#a3987a':'#8a8b71');stone.addColorStop(1,l.code==='lake'?'#5d5a44':'#3d493c');
    c.fillStyle=stone;c.beginPath();c.ellipse(x,y,r,r*.55,-.4,0,7);c.fill();
    c.fillStyle='rgba(240,238,218,.18)';c.beginPath();c.ellipse(x-r*.25,y-r*.2,r*.4,r*.18,-.4,0,7);c.fill();
  }
  if(l.code==='river') {
    // Живая плакучая ива над водой: фактурный ствол, объёмная крона и эллиптические листочки на прядях.
    const trunk=mix('#5a4a33',P.water[3],.2);
    const trunkLit=mix('#857253',P.water[3],.2);
    const trunkDark=mix('#342a1c',P.water[3],.2);
    c.strokeStyle=trunkDark;c.lineWidth=9.5;
    c.beginPath();c.moveTo(22,370);c.quadraticCurveTo(51,308,104,276);c.stroke();
    c.strokeStyle=trunk;c.lineWidth=7.5;
    c.beginPath();c.moveTo(23,368);c.quadraticCurveTo(52,306,104,276);c.stroke();
    c.strokeStyle=trunkLit;c.lineWidth=2.2;
    c.beginPath();c.moveTo(22,366);c.quadraticCurveTo(51,304,102,275);c.stroke();
    c.strokeStyle=trunk;c.lineWidth=4.2;c.beginPath();c.moveTo(64,322);c.quadraticCurveTo(98,298,142,292);c.stroke();
    c.lineWidth=2.6;c.beginPath();c.moveTo(96,282);c.quadraticCurveTo(120,266,150,262);c.stroke();
    const leafDark=mix('#445330',P.water[3],P.part==='night'?.55:.15);
    const leaf=mix('#75854c',P.water[3],P.part==='night'?.55:.12);
    const leafLit=mix('#97a461',P.water[3],P.part==='night'?.55:.1);
    for(let i=0;i<26;i++){
      const bx2=86+noise(i+420)*74,by=257+noise(i+421)*30,r=6+noise(i+422)*9;
      c.fillStyle=leafDark;c.beginPath();c.ellipse(bx2-1,by+2,r,r*.62,(noise(i+423)-.5)*.6,0,7);c.fill();
      c.fillStyle=i%3?leaf:leafLit;c.beginPath();c.ellipse(bx2,by,r,r*.62,(noise(i+423)-.5)*.6,0,7);c.fill();
    }
    c.lineWidth=.8;
    for(let i=0;i<68;i++){
      const bx2=84+noise(i+410)*82,by=265+noise(i+411)*30,len=34+noise(i+412)*60,tipX=bx2+3+noise(i+413)*5;
      c.strokeStyle=i%4?leaf:leafLit;
      c.beginPath();c.moveTo(bx2,by);c.quadraticCurveTo(bx2+5,by+len*.6,tipX,by+len);c.stroke();
      for(let k2=1;k2<6;k2++){
        const u=k2/6, lx2=bx2*(1-u)*(1-u)+2*(bx2+5)*u*(1-u)+tipX*u*u, ly2=by+len*u;
        c.fillStyle=k2%2?leafLit:leaf;
        c.beginPath();c.ellipse(lx2,ly2,2.2,.85,1.25+(k2%2?-.2:.2),0,7);c.fill();
      }
    }
  }
  if(l.code==='pond') {
    // Крупные вековые ели по краям кадрируют замкнутую воду.
    const frame=mix(P.trees[3],'#141f18',.45);
    tree(c,64,420,220,mix(frame,P.trees[2],.3),true,sunX);
    tree(c,742,420,240,mix(frame,P.trees[2],.3),true,sunX);
    tree(c,26,420,300,frame,true,sunX);
    tree(c,778,420,320,frame,true,sunX);
  }
}
function drawWaterSurface(time, sea=false, current=false) {
  const P=getPalette();
  const rough=P.wx==='wind'?1.8:P.wx==='rain'?1.3:1;
  const topY=sea?184:189, spanY=420-topY;
  g.save();
  // Живые горизонтальные полосы преломления отражения на водной глади.
  const bandCol=mix(P.water[1],P.haze,.35);
  for(let i=0;i<14;i++) {
    const z=(i+.5)/14, y=topY+z*z*spanY*.72;
    const bx=(Math.sin(time*(.55+z*.4)+i*1.3)*.5+.5)*260+i*42;
    const bw=90+z*220, bh=.8+z*2.4;
    g.fillStyle=rgba(i%2?bandCol:P.waveDark,(.022+z*.028)*(1-P.night*.35));
    g.beginPath();g.ellipse((bx%760)+20,y,bw*.5,bh,0,0,7);g.fill();
  }
  for(let i=0;i<190;i++) {
    const z=noise(i+300),y=topY+z*z*spanY,span=2+z*z*(sea?95:47);
    const speed=(current?10:sea?5:2)*(1+z)*rough;
    const x=(noise(i+800)*940+time*speed)%940-70;
    const wave=Math.sin(time*(1+z)+i)*z*rough;
    g.strokeStyle=rgba(P.waveLight,(.025+z*.11)*(P.night>.5?.75:1));g.lineWidth=.35+z*.7;
    g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x+span*.3,y-wave,x+span*.65,y+wave,x+span,y);g.stroke();
    if(i%2===0){
      g.strokeStyle=rgba(P.waveDark,.04+z*.11);g.lineWidth=.3+z*.55;
      g.beginPath();g.moveTo(x+span*.08,y+1.2+z*.6);g.quadraticCurveTo(x+span*.45,y+1.4+wave*.5,x+span*.82,y+1.2+z*.6);g.stroke();
    }
    if((sea&&rough>1.4&&i%6===0)||(P.wx==='wind'&&i%11===0)){
      g.strokeStyle=rgba(mix(P.waveLight,'#ffffff',.45),.28+z*.14);g.lineWidth=.7+z*.5;
      g.beginPath();g.moveTo(x+span*.38,y-wave-.8);g.quadraticCurveTo(x+span*.48,y-wave-1.4,x+span*.58,y-wave-.7);g.stroke();
    }
  }
  if(current) {
    // Струи течения: длинные штрихи сносятся быстрее обычной ряби.
    for(let i=0;i<28;i++){
      const z=noise(i+2100),y=196+z*z*205,len=26+z*64;
      const x=((noise(i+2200)*940-time*(16+z*26))%940+940)%940-70;
      g.strokeStyle=rgba(P.waveLight,.04+z*.09);g.lineWidth=.4+z*.55;
      g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+len*.5,y-1.5-z*2,x+len,y);g.stroke();
    }
  }
  if(sea) {
    // Медленная океанская зыбь поверх ряби с лёгкой теневой полосой.
    for(let i=0;i<3;i++){
      const y=214+i*58+Math.sin(time*.35+i*1.7)*3;
      g.strokeStyle=rgba(P.waveDark,.06+i*.015);g.lineWidth=1.4;
      g.beginPath();g.moveTo(0,y+1.5);
      for(let x=0;x<=800;x+=40)g.lineTo(x,y+1.5+Math.sin(x*.012+time*.5+i)*2.5);
      g.stroke();
      g.strokeStyle=rgba(P.waveLight,.06+i*.015);g.lineWidth=1.1;
      g.beginPath();g.moveTo(0,y);
      for(let x=0;x<=800;x+=40)g.lineTo(x,y+Math.sin(x*.012+time*.5+i)*2.5);
      g.stroke();
    }
  }
  if(P.wx==='wind') {
    // Тёмные пятна-порывы скользят по воде.
    for(let i=0;i<6;i++) {
      const z=noise(i+1700),y=200+z*z*200,x=(noise(i+1710)*960+time*(30+z*40))%960-80;
      g.fillStyle=rgba(P.waveDark,.05+z*.04);
      g.beginPath();g.ellipse(x,y,60+z*90,4+z*7,0,0,7);g.fill();
    }
  }
  // Естественные круги на воде вдали: частые при дожде и редкие всплески в тихую погоду.
  if(P.wx==='rain'||P.wx==='clear'||P.wx==='fog') {
    const isRain=P.wx==='rain', cnt=isRain?16:4, cycle=isRain?1.1:4.2;
    for(let i=0;i<cnt;i++) {
      const ph=(((time/cycle)+noise(i+1910))%1+1)%1;
      if(!isRain&&ph>.38)continue;
      const u=isRain?ph:ph/.38;
      const z=noise(i+1920), y=topY+8+z*z*(sea?102:168);
      const x=50+noise(i+1930)*700;
      const r=(1.5+u*(isRain?7:13))*(.35+z*.7), a=(1-u)*(isRain?.26:.22);
      g.strokeStyle=rgba(P.waveLight,a);g.lineWidth=.45+z*.4;
      g.beginPath();g.ellipse(x,y,r,r*.23,0,0,7);g.stroke();
    }
  }
  // Дрожащая дорожка света следует за солнцем/луной; мягкие блики вместо прямоугольников.
  const sx=P.sun[0], count=P.lit?95:0;
  if(count>0) {
    const glow=g.createRadialGradient(sx,topY+70,8,sx,topY+110,145);
    glow.addColorStop(0,`rgba(${P.sparkle},${P.night>.5?.08:.09})`);
    glow.addColorStop(1,`rgba(${P.sparkle},0)`);
    g.fillStyle=glow;g.fillRect(sx-150,topY,300,230);
    for(let i=0;i<count;i++) {
      const z=noise(i+1400),y=topY+1+z*z*(419-topY);
      const spread=(noise(i+1500)-.5)*(18+z*z*185);
      const x=sx+spread+Math.sin(time*1.2+i)*z*5;
      const visibility=(i<60?1:1-P.night)*Math.max(.25,1-Math.abs(spread)/120);
      const a=(.05+noise(i+42)*.24)*(.65+Math.sin(time*2+i)*.35)*visibility;
      const rx=.6+z*z*11, ry=.35+z*.45;
      g.fillStyle=`rgba(${P.sparkle},${a})`;
      g.beginPath();g.ellipse(x,y,rx,ry,0,0,7);g.fill();
      if(i%5===0&&a>.1){
        g.fillStyle=`rgba(${P.sparkle},${a*.32})`;
        g.beginPath();g.ellipse(x,y,rx*1.6,ry*1.8,0,0,7);g.fill();
      }
    }
  }
  g.restore();
}
function drawLandscape(l, P) {
  if (landscapeKey !== l.code || landscapeWeather !== P.wx) {
    landscapeFrames.clear(); landscapeKey = l.code; landscapeWeather = P.wx;
  }
  const phases = P.amount > 0 ? [P.part, P.next] : [P.part];
  for (const phase of landscapeFrames.keys()) {
    if (!phases.includes(phase)) landscapeFrames.delete(phase);
  }
  for (const phase of phases) {
    if (!landscapeFrames.has(phase)) {
      paintLandscape(l, getPalette(phase));
      const frame = document.createElement('canvas'); frame.width = 1600; frame.height = 840;
      frame.getContext('2d').drawImage(landscape, 0, 0);
      landscapeFrames.set(phase, frame);
    }
  }
  g.drawImage(landscapeFrames.get(P.part), 0, 0, 800, 420);
  if (P.amount > 0) {
    g.save(); g.globalAlpha = P.amount;
    g.drawImage(landscapeFrames.get(P.next), 0, 0, 800, 420); g.restore();
  }
}
function drawCelestial(horizon, treeLine, P) {
  if (!P || !P.celestial) return;
  const bodyY = b => Math.max(20, b.y - (treeLine ? 42 : 0));
  g.save();
  g.beginPath(); g.rect(0, 0, 800, horizon); g.clip();
  const { sun, moon } = P.celestial;
  if (sun && sun.alpha > .01) {
    const sy = bodyY(sun);
    g.save();
    g.globalAlpha = P.celestialAlpha * sun.alpha;
    const halo = g.createRadialGradient(sun.x, sy, 2, sun.x, sy, 145);
    halo.addColorStop(0, `rgba(${sun.halo},.82)`);
    halo.addColorStop(.22, `rgba(${sun.halo},.28)`);
    halo.addColorStop(1, `rgba(${sun.halo},0)`);
    g.fillStyle = halo; g.fillRect(sun.x - 150, sy - 150, 300, 300);
    g.fillStyle = sun.col; g.beginPath(); g.arc(sun.x, sy, sun.r, 0, 7); g.fill();
    g.restore();
  }
  if (moon && moon.alpha > .01) {
    const my = bodyY(moon);
    g.save();
    g.globalAlpha = P.celestialAlpha * moon.alpha;
    const halo = g.createRadialGradient(moon.x, my, 2, moon.x, my, 105);
    halo.addColorStop(0, `rgba(${moon.halo},.78)`);
    halo.addColorStop(.22, `rgba(${moon.halo},.24)`);
    halo.addColorStop(1, `rgba(${moon.halo},0)`);
    g.fillStyle = halo; g.fillRect(moon.x - 115, my - 115, 230, 230);
    g.fillStyle = moon.col; g.beginPath(); g.arc(moon.x, my, moon.r, 0, 7); g.fill();
    g.fillStyle = 'rgba(155,174,198,.42)';
    g.beginPath(); g.arc(moon.x - 2.8, my - 1.8, 1.7, 0, 7); g.fill();
    g.beginPath(); g.arc(moon.x + 2.1, my + 2.5, 1.3, 0, 7); g.fill();
    g.beginPath(); g.arc(moon.x + 2.8, my - 2.7, .9, 0, 7); g.fill();
    g.beginPath(); g.arc(moon.x - 1.2, my + 3.1, 1.0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(245,248,255,.45)'; g.lineWidth = .6;
    g.beginPath(); g.arc(moon.x, my, moon.r, -.9, 1.1); g.stroke();
    g.restore();
  }
  g.restore();
}
function drawDynamicSky(time, horizon, P, sea = false) {
  const speed = P.wx === 'wind' ? 8.5 : P.wx === 'rain' ? 5.0 : 2.2;
  const cloudA = (1 - P.night * .64) * (P.wx === 'fog' ? .22 : P.wx === 'rain' ? .75 : 1);
  const darkCol = P.wx === 'rain' ? mix(P.cloud[1], '#424c50', .45) : P.cloud[1];
  const litCol = P.wx === 'rain' ? mix(P.cloud[0], '#647074', .4) : P.cloud[0];
  const sunX = P.sun[0];
  const hg = P.horizonGlow !== undefined ? P.horizonGlow : (P.part === 'morning' || P.part === 'evening' ? 1 : 0);
  const warmEdge = hg > .05 && P.lit ? `rgba(${P.halo},${.26 * cloudA * hg})` : null;
  const puffOffsets = [[-.52, .05, .52], [-.24, -.24, .68], [.08, -.32, .74], [.36, -.16, .60], [.58, .06, .46]];

  g.save();
  for (let i = 0; i < 6; i++) {
    const cx = (((noise(i + 610) * 1020 + time * speed) % 1020) + 1020) % 1020 - 110;
    const cy = 24 + noise(i + 620) * (horizon * .44) + (P.wx === 'rain' ? 14 : 0);
    const cw = 48 + noise(i + 630) * 56 + (P.wx === 'rain' ? 28 : 0);
    const ch = 12 + noise(i + 640) * 11 + (P.wx === 'rain' ? 6 : 0);

    // Плоское затенённое основание облака.
    g.fillStyle = rgba(darkCol, .24 * cloudA);
    g.beginPath(); g.ellipse(cx, cy + ch * .24, cw * .68, ch * .4, 0, 0, 7); g.fill();

    // Пышные объёмные клубы верхней кромки.
    for (let j = 0; j < puffOffsets.length; j++) {
      const [ox, oy, sr] = puffOffsets[j];
      const px = cx + ox * cw * .56, py = cy + oy * ch * .75;
      const rx = cw * .30 * sr, ry = ch * .56 * sr;
      if (warmEdge && ((sunX >= cx && ox >= 0) || (sunX < cx && ox <= 0))) {
        g.fillStyle = warmEdge;
        g.beginPath(); g.ellipse(px + (sunX >= cx ? 1.5 : -1.5), py - .8, rx * 1.04, ry * 1.04, 0, 0, 7); g.fill();
      }
      g.fillStyle = rgba(litCol, .27 * cloudA);
      g.beginPath(); g.ellipse(px, py, rx, ry, 0, 0, 7); g.fill();
    }

    // Мягкое перевёрнутое отражение облака в верхней полосе воды.
    const ryWater = horizon + 6 + (cy / horizon) * 26;
    const wShift = Math.sin(time * 1.1 + i * 1.7) * 3;
    g.fillStyle = rgba(litCol, .045 * cloudA * (sea ? .85 : 1));
    g.beginPath(); g.ellipse(cx + wShift, ryWater, cw * .58, ch * .2, 0, 0, 7); g.fill();
  }
  g.restore();
}

function drawAtmosphere(l, time, P) {
  const sea = l && l.code === 'sea';
  const horizon = sea ? 183 : 190;
  g.save();
  if (P.stars) {
    const sa = P.starAlpha !== undefined ? P.starAlpha : 1;
    for (let i = 0; i < 14; i++) {
      const x = noise(i + 480) * 780 + 10, y = noise(i + 485) * horizon * .78;
      const pulse = (.25 + .65 * (.5 + .5 * Math.sin(time * 2.3 + i * 1.7))) * sa;
      g.fillStyle = `rgba(240,246,255,${pulse})`;
      g.beginPath(); g.arc(x, y, .9 + (i % 2) * .3, 0, 7); g.fill();
      if (pulse > .75) {
        g.strokeStyle = `rgba(220,235,255,${(pulse - .75) * 1.4})`; g.lineWidth = .5;
        g.beginPath(); g.moveTo(x - 2.6, y); g.lineTo(x + 2.6, y); g.moveTo(x, y - 2.6); g.lineTo(x, y + 2.6); g.stroke();
      }
    }
  }
  if (!sea && P.night < .85 && P.wx !== 'rain') {
    g.strokeStyle = rgba('#2d3e3b', .62 * (1 - P.night)); g.lineWidth = .85;
    for (let i = 0; i < 5; i++) {
      const x = (((210 + i * 24 + time * 4.5 + Math.sin(time * .4 + i) * 10) % 860) + 860) % 860 - 30;
      const y = 52 + (i % 3) * 11 + Math.sin(time * .8 + i) * 2.5;
      const flap = Math.sin(time * 4.5 + i * 1.3) * 2.4;
      g.beginPath();
      g.moveTo(x - 4.5, y - flap); g.quadraticCurveTo(x - 2, y - 2.2, x, y);
      g.quadraticCurveTo(x + 2, y - 2.2, x + 4.5, y - flap);
      g.stroke();
    }
  }
  if (!sea && !P.stars && P.wx === 'clear') {
    for (let i = 0; i < 10; i++) {
      const x = 14 + noise(i + 710) * 76 + Math.sin(time * .9 + i * 1.9) * 6;
      const y = 305 + noise(i + 720) * 85 + Math.cos(time * 1.1 + i * 1.4) * 5;
      const a = (.22 + .2 * Math.sin(time * 2.2 + i)) * (1 - P.night * .6);
      g.fillStyle = `rgba(255,244,205,${Math.max(0, a)})`;
      g.beginPath(); g.arc(x, y, .85, 0, 7); g.fill();
    }
  }
  if (!sea && (P.night > .2 || P.part === 'evening' || P.part === 'dusk' || P.part === 'dawn') && P.wx !== 'rain' && P.wx !== 'wind') {
    const ffBase = P.night > .2 ? Math.min(1, P.night * 1.3) : .45;
    for (let i = 0; i < 8; i++) {
      const rightSide = l && l.code === 'pond' && i >= 5;
      const baseX = rightSide ? 745 + noise(i + 750) * 45 : 18 + noise(i + 750) * 74;
      const baseY = 310 + noise(i + 760) * 84;
      const x = baseX + Math.sin(time * (.7 + i * .09) + i * 2.1) * 9;
      const y = baseY + Math.cos(time * (.9 + i * .11) + i * 1.7) * 6;
      const glow = (.35 + .65 * (.5 + .5 * Math.sin(time * 2.8 + i * 2.3))) * ffBase;
      const halo = g.createRadialGradient(x, y, .4, x, y, 6);
      halo.addColorStop(0, `rgba(255,238,145,${.55 * glow})`);
      halo.addColorStop(1, 'rgba(255,220,100,0)');
      g.fillStyle = halo; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
      g.fillStyle = `rgba(255,246,185,${.9 * glow})`;
      g.beginPath(); g.arc(x, y, 1.1, 0, 7); g.fill();
    }
  }
  g.restore();
}

function drawEnvironment(l, time) {
  const P=getPalette();
  drawLandscape(l,P);
  drawCelestial(190,true,P);
  drawDynamicSky(time,190,P,false);
  drawWaterSurface(time,false,l.current);
  const wind=typeof currentWeather==='function'&&currentWeather()==='wind'?2.5:1;
  const dim=P.environmentDim;
  const reedDark=P.water[3];
  const reedCount=l.code==='lake'?28:l.code==='pond'?50:45;
  for(let i=0;i<reedCount;i++) {
    const x=noise(i+100)*73,y=372+noise(i+45)*50,h=25+noise(i+65)*80,sway=Math.sin(time*1.2+i*.7)*2*wind;
    const col=mix(['#334b31','#657249','#889065'][i%3],reedDark,dim);
    g.strokeStyle=col;g.lineWidth=.8+noise(i)*1.2;
    g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x-5,y-h*.5,x+sway,y-h);g.stroke();
    // Широкие изогнутые листья осоки со световым краем.
    g.strokeStyle=col;g.lineWidth=1.1+noise(i+3)*.8;
    g.beginPath();g.moveTo(x,y-8);g.quadraticCurveTo(x+18,y-h*.6,x+14+sway*.5,y-h*.72);g.stroke();
    if(i%3===0){
      g.strokeStyle=mix('#a6b07c',reedDark,dim);g.lineWidth=.55;
      g.beginPath();g.moveTo(x-.5,y-9);g.quadraticCurveTo(x+16,y-h*.62,x+13+sway*.5,y-h*.72);g.stroke();
    }
    if(i%4===0){
      g.strokeStyle=mix('#5b4934',reedDark,dim);g.lineWidth=3;
      g.beginPath();g.moveTo(x+sway,y-h+2);g.lineTo(x+sway*.95,y-h+13);g.stroke();
      g.strokeStyle=mix('#856d50',reedDark,dim);g.lineWidth=.7;
      g.beginPath();g.moveTo(x+sway-.8,y-h+3);g.lineTo(x+sway*.95-.8,y-h+12);g.stroke();
      g.strokeStyle=mix('#3b3022',reedDark,dim);g.lineWidth=.6;
      g.beginPath();g.moveTo(x+sway,y-h+2);g.lineTo(x+sway*1.05,y-h-4);g.stroke();
    }
  }
  if(l.code==='pond') {
    for(let i=0;i<24;i++) {
      const x=738+noise(i+150)*58,y=378+noise(i+145)*42,h=22+noise(i+165)*70,sway=Math.sin(time*1.1+i*.9)*2*wind;
      g.strokeStyle=mix(['#2e442c','#5a6a42','#7d875c'][i%3],reedDark,dim);g.lineWidth=.8+noise(i+5)*1.2;
      g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+4,y-h*.5,x+sway,y-h);g.stroke();
      if(i%4===0){
        g.strokeStyle=mix('#54432f',reedDark,dim);g.lineWidth=2.6;
        g.beginPath();g.moveTo(x+sway,y-h+2);g.lineTo(x+sway*.95,y-h+11);g.stroke();
        g.strokeStyle=mix('#3b3022',reedDark,dim);g.lineWidth=.5;
        g.beginPath();g.moveTo(x+sway,y-h+2);g.lineTo(x+sway*1.04,y-h-3);g.stroke();
      }
    }
  }
  drawAtmosphere(l,time,P);
}
const dockFrames = new Map();
const dockBlend = document.createElement('canvas'); dockBlend.width = 1600; dockBlend.height = 108;
function paintDock(frame, P) {
    const D=c=>mix(c,'#141c26',P.environmentDim);
    const c=frame.getContext('2d');c.setTransform(2,0,0,2,0,0);c.clearRect(0,0,800,420);
    // Контактная тень мостков на воде (строго в полосе y=366..420 для кроссфейда).
    shape(c,[[198,366],[602,366],[800,420],[0,420]],'rgba(10,20,18,.34)');
    shape(c,[[202,367],[598,367],[800,420],[0,420]],D('#26221a'));
    // Продольные лаги под досками (видны в щелях).
    for(const x of [260,400,540]){
      c.strokeStyle=D('#1c1912');c.lineWidth=3.5;
      c.beginPath();c.moveTo(x,367);c.lineTo(400+(x-400)*2.1,420);c.stroke();
    }
    const boardTones=[
      ['#8d7e60','#685c47'], ['#9b8b6b','#70634c'], ['#84775c','#615642'],
      ['#978768','#6d614a'], ['#7e7259','#5b513e'], ['#928365','#685b45'], ['#897a5e','#625742']
    ];
    for(let j=0;j<7;j++) {
      const a=j/7, b=(j+1)/7, y=367+53*a*a, bottom=367+53*b*b;
      const left=202*(1-a*a), right=800-left;
      const bLeft=202*(1-b*b), bRight=800-bLeft;
      const [topCol, botCol]=boardTones[j];
      const wood=c.createLinearGradient(0,y,0,bottom);
      wood.addColorStop(0,D(topCol));wood.addColorStop(1,D(botCol));
      c.save();
      c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.lineTo(bRight,bottom-1.1);c.lineTo(bLeft,bottom-1.1);c.closePath();c.clip();
      c.fillStyle=wood;c.fillRect(0,y,800,bottom-y);
      // Волокна древесины.
      for(let k=0;k<95;k++) {
        const x=noise(j*95+k)*800, yy=y+noise(k+j*81)*(bottom-y);
        c.strokeStyle=k%3?'rgba(34,29,20,.22)':'rgba(222,209,165,.19)';c.lineWidth=.35;
        c.beginPath();c.moveTo(x,yy);c.bezierCurveTo(x+16,yy-.7,x+36,yy+.7,x+64+noise(k)*95,yy);c.stroke();
      }
      // Сучки на досках.
      if(j===1||j===2||j===4||j===5) {
        const kx=240+noise(j+910)*320, ky=y+(bottom-y)*.52, kr=3.5+noise(j+920)*3.2;
        c.fillStyle=D('#4b3f2f');c.beginPath();c.ellipse(kx,ky,kr,kr*.32,0,0,7);c.fill();
        c.strokeStyle='rgba(36,28,18,.35)';c.lineWidth=.45;
        c.beginPath();c.ellipse(kx,ky,kr*1.5,kr*.48,0,0,7);c.stroke();
      }
      // Сырость и лёгкий мох у краёв мостков.
      for(const [mx0,mx1] of [[0,left+32],[right-32,800]]) {
        const moss=c.createLinearGradient(mx0,0,mx1,0);
        const isL=mx0===0;
        moss.addColorStop(isL?0:1,rgba(D('#3e4e31'),.42));
        moss.addColorStop(isL?1:0,rgba(D('#3e4e31'),0));
        c.fillStyle=moss;c.fillRect(mx0,y,mx1-mx0,bottom-y);
      }
      // Светлая верхняя фаска и мягкая нижняя тень доски.
      c.strokeStyle=rgba(D('#d8ccb0'),j===0?.45:.28);c.lineWidth=.8;
      c.beginPath();c.moveTo(left,y+.4);c.lineTo(right,y+.4);c.stroke();
      c.strokeStyle='rgba(16,14,10,.35)';c.lineWidth=.9;
      c.beginPath();c.moveTo(bLeft,bottom-1.4);c.lineTo(bRight,bottom-1.4);c.stroke();
      // Утопленные шляпки гвоздей.
      for(const x of [left+18,right-18,390]) {
        const gy=(y+bottom)/2;
        c.fillStyle='rgba(18,16,12,.45)';c.beginPath();c.ellipse(x,gy+.2,1.6,.85,0,0,7);c.fill();
        c.fillStyle=D('#4a463b');c.beginPath();c.ellipse(x,gy,1.2,.62,0,0,7);c.fill();
        c.fillStyle=D('#bcb59c');c.beginPath();c.ellipse(x-.3,gy-.2,.5,.25,0,0,7);c.fill();
      }
      c.restore();
    }
    // Вертикальные стыки лаг поверх щелей.
    for(const x of [260,400,540]){c.strokeStyle='rgba(38,31,22,.45)';c.lineWidth=.8;c.beginPath();c.moveTo(x,367);c.lineTo(400+(x-400)*2.1,420);c.stroke();}
    // Бухта свёрнутого каната у левого края мостков (строго внутри y=382..412).
    const rx=148, ry=398;
    c.fillStyle='rgba(12,16,14,.35)';c.beginPath();c.ellipse(rx+2,ry+3,24,9.5,-.08,0,7);c.fill();
    for(let i=4;i>=0;i--) {
      c.strokeStyle=D(i%2?'#9d8c69':'#7b6d50');c.lineWidth=2.3;
      c.beginPath();c.ellipse(rx,ry-i*.8,12+i*2.3,4.2+i*.9,-.08,0,7);c.stroke();
    }
    c.strokeStyle=D('#8f7f5f');c.lineWidth=2;
    c.beginPath();c.moveTo(rx-20,ry+2);c.quadraticCurveTo(rx-32,ry+6,rx-42,ry+12);c.stroke();
}
function drawFirstPersonDock() {
  const P = getPalette(), phases = P.amount > 0 ? [P.part, P.next] : [P.part];
  for (const phase of dockFrames.keys()) {
    if (!phases.includes(phase)) dockFrames.delete(phase);
  }
  for (const phase of phases) {
    if (!dockFrames.has(phase)) {
      const frame = document.createElement('canvas'); frame.width = 1600; frame.height = 840;
      paintDock(frame, getPalette(phase)); dockFrames.set(phase, frame);
    }
  }
  if (P.amount > 0) {
    const c = dockBlend.getContext('2d');
    // Сумма весов сохраняет прозрачность сглаженных краёв понтона.
    c.globalCompositeOperation = 'copy'; c.globalAlpha = 1 - P.amount;
    c.drawImage(dockFrames.get(P.part), 0, 732, 1600, 108, 0, 0, 1600, 108);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = P.amount;
    c.drawImage(dockFrames.get(P.next), 0, 732, 1600, 108, 0, 0, 1600, 108);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    g.drawImage(dockBlend, 0, 366, 800, 54);
  } else {
    g.drawImage(dockFrames.get(P.part), 0, 0, 800, 420);
  }
  drawDockWet();
}

// Намокание понтона: дешёвый оверлей поверх кэша (клип по трапеции), текстура не пересобирается.
function drawDockWet() {
  if (dockWet <= .001) return;
  const P = getPalette(), sky = mix(P.haze, '#e8f0f6', .55);
  g.save();
  g.beginPath(); g.moveTo(202,367); g.lineTo(598,367); g.lineTo(800,420); g.lineTo(0,420); g.closePath(); g.clip();
  g.fillStyle = rgba('#121a24', .30 * dockWet); g.fillRect(0,367,800,53);
  const sheen = g.createLinearGradient(0,367,0,420);
  sheen.addColorStop(0, rgba(sky, .16 * dockWet)); sheen.addColorStop(1, rgba(sky, .03 * dockWet));
  g.fillStyle = sheen; g.fillRect(0,367,800,53);
  // Лужи проступают по одной (пороги .18….83), ближе к ногам крупнее; сохнут в обратном порядке.
  for (let i = 0; i < 6; i++) {
    const a = Math.max(0, Math.min(1, (dockWet - (.18 + i * .13)) / .18));
    if (a <= 0) continue;
    const f = .12 + noise(i + 3100) * .82, y = 367 + 53 * f;
    const left = 202 * (1 - f), right = 800 - left;
    const cx = left + (right - left) * (.12 + noise(i + 3200) * .76);
    const sc = .5 + f * .85, rx = 13 * sc, ry = rx * .34;
    g.fillStyle = rgba(mix(sky, '#9fb4c4', .3), .5 * a);
    g.beginPath(); g.ellipse(cx, y, rx, ry, 0, 0, 7); g.fill();
    g.strokeStyle = rgba('#1a2430', .3 * a); g.lineWidth = .8;
    g.beginPath(); g.ellipse(cx, y, rx, ry, 0, 0, 7); g.stroke();
    g.strokeStyle = rgba('#ffffff', .22 * a); g.lineWidth = .7;
    g.beginPath(); g.ellipse(cx - rx * .25, y - ry * .3, rx * .45, ry * .3, 0, Math.PI * 1.05, Math.PI * 1.75); g.stroke();
  }
  g.restore();
}

// Облик шести ступеней удочек: бланк, обмотки колец, металл катушки, рукоять.
const ROD_LOOKS = {
  1: {blank: '#ab8750', wrap: '#7a4a28', metal: '#8f9a8a', grip: 'cork', nodes: true},
  2: {blank: '#6f7d52', wrap: '#3f5230', metal: '#9aa79a', grip: 'cork'},
  3: {blank: '#526b62', wrap: '#8a2f26', metal: '#a8b2a6', grip: 'cork'},
  4: {blank: '#4a5a6e', wrap: '#28374d', metal: '#b4bcb2', grip: 'cork'},
  5: {blank: '#384849', wrap: '#b3852e', metal: '#c1c8bd', grip: 'eva'},
  6: {blank: '#23282e', wrap: '#c0533f', metal: '#cdd4c9', grip: 'eva', weave: true}
};

// Геометрия текущей удочки: используется отрисовкой и тестами.
let ROD_RIG = null;
const _rodBaseX = 612, _rodBaseY = 319;
const _rodAxisLen = Math.hypot(470 - _rodBaseX, 118 - _rodBaseY);
const ROD_DIR = [(470 - _rodBaseX) / _rodAxisLen, (118 - _rodBaseY) / _rodAxisLen];
const ROD_NORM = [ROD_DIR[1], -ROD_DIR[0]]; // Влево-вниз от бланка: сторона воды, колец и катушки.
const SLEEVE_LIGHT = '#718064';

// Свободный мягкий отворот рукава поверх голого запястья/предплечья (без жёсткой резинки).
function _drawRolledCuffBand(g, x0, y0, cx, cy, x1, y1, thick, D) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
  const kx = dy / l, ky = -dx / l; // нормаль в сторону кожи
  const tx = dx / l, ty = dy / l;
  const h = thick * .5;

  // Мягкая падающая тень от свободного края отворота на кожу.
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(16,12,10,.22)';
  g.lineWidth = 4.5;
  g.beginPath();
  g.moveTo(x0 + kx * (h + 1.2) + tx * 2, y0 + ky * (h + 1.2) + ty * 2);
  g.quadraticCurveTo(cx + kx * (h + 1.2), cy + ky * (h + 1.2), x1 + kx * (h + 1.2) - tx * 2, y1 + ky * (h + 1.2) - ty * 2);
  g.stroke();

  // Замкнутый объёмный край подвёрнутой ткани со скруглёнными концами.
  const cuffGrad = g.createLinearGradient(x0, y0, x1, y1);
  cuffGrad.addColorStop(0, D('#86927a'));
  cuffGrad.addColorStop(.52, D('#62715c'));
  cuffGrad.addColorStop(1, D('#3b493c'));

  g.beginPath();
  g.moveTo(x0 + kx * h, y0 + ky * h);
  g.quadraticCurveTo(cx + kx * h, cy + ky * h, x1 + kx * h, y1 + ky * h);
  g.quadraticCurveTo(x1 + tx * h * .85, y1 + ty * h * .85, x1 - kx * h, y1 - ky * h);
  g.quadraticCurveTo(cx - kx * h, cy - ky * h, x0 - kx * h, y0 - ky * h);
  g.quadraticCurveTo(x0 - tx * h * .85, y0 - ty * h * .85, x0 + kx * h, y0 + ky * h);
  g.closePath();
  g.fillStyle = cuffGrad;
  g.fill();

  // Мягкий блик по верхнему сгибу ткани и деликатная складка-шов отворота.
  g.clip();
  g.strokeStyle = rgba(D('#b5c0a8'), .22);
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(x0 + kx * (h * .42), y0 + ky * (h * .42));
  g.quadraticCurveTo(cx + kx * (h * .42), cy + ky * (h * .42), x1 + kx * (h * .42), y1 + ky * (h * .42));
  g.stroke();

  g.strokeStyle = rgba(D('#253127'), .34);
  g.lineWidth = 1.1;
  g.beginPath();
  g.moveTo(x0 - kx * (h * .28), y0 - ky * (h * .28));
  g.quadraticCurveTo(cx - kx * (h * .28), cy - ky * (h * .28), x1 - kx * (h * .28), y1 - ky * (h * .28));
  g.stroke();
  g.restore();
}

// Только руки и снасть: положение камеры совпадает со взглядом рыбака.
function drawFirstPersonRod(tx, ty, time) {
  const lift = S === 'charge' ? pw * 30 : S === 'fly' ? Math.sin(Math.min(1, cast) * Math.PI) * 18 : 0;
  const brx = Math.sin(time * .62) * .8, bry = Math.sin(time * 1.25) * 1.4;
  const bx0 = _rodBaseX + brx, by0 = _rodBaseY - lift + bry;
  const [rx, ry] = ROD_DIR, [nx0, ny0] = ROD_NORM; // nx0<0, ny0>0: влево-вниз
  const ux = -nx0, uy = -ny0; // вправо-вверх (к тылу кисти)

  g.save(); g.lineCap = 'round';
  const P = getPalette(), dim = P.foregroundDim;
  const D = c => mix(c, '#141c26', dim);
  const look = ROD_LOOKS[+sr.value] || ROD_LOOKS[1];

  // 1. Первый градиент функции — цвет правого рукава (проверяется test_hands_and_boat_dim_gradually).
  const sleeve = g.createLinearGradient(640, 345 - lift, 800, 425);
  sleeve.addColorStop(0, D(SLEEVE_LIGHT));
  sleeve.addColorStop(.5, D('#495d46'));
  sleeve.addColorStop(1, D('#283f35'));

  const gx1 = bx0, gy1 = by0;
  const gx0 = bx0 - rx * 175, gy0 = by0 - ry * 175;
  const gdx = gx1 - gx0, gdy = gy1 - gy0, gl = Math.hypot(gdx, gdy) || 1;
  const gpx = -gdy / gl, gpy = gdx / gl; // перпендикуляр вправо-вверх (ux, uy)
  const gripAt = u => [gx0 + gdx * u, gy0 + gdy * u];

  // 2. Рукоять (комель 15 px толщиной, пробка / EVA, торцевая заглушка и катушкодержатель).
  const grip = g.createLinearGradient(gx0, gy0, gx1, gy1);
  if (look.grip === 'cork') {
    grip.addColorStop(0, D('#a9885c')); grip.addColorStop(.5, D('#c9a875')); grip.addColorStop(1, D('#b3925f'));
  } else {
    grip.addColorStop(0, D('#33383c')); grip.addColorStop(.5, D('#22262a')); grip.addColorStop(1, D('#2c3134'));
  }
  g.strokeStyle = grip; g.lineWidth = 15;
  g.beginPath(); g.moveTo(gx0, gy0); g.lineTo(gx1, gy1); g.stroke();
  // Объёмный блик по левой (верхней) кромке и тень по нижней.
  g.strokeStyle = look.grip === 'cork' ? rgba(D('#ebd6ab'), .45) : rgba(D('#6b7277'), .38);
  g.lineWidth = 3.2;
  g.beginPath();
  g.moveTo(gx0 + gpx * 3.8, gy0 + gpy * 3.8);
  g.lineTo(gx1 + gpx * 3.8, gy1 + gpy * 3.8);
  g.stroke();
  g.strokeStyle = 'rgba(10,12,14,.28)'; g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(gx0 - gpx * 5, gy0 - gpy * 5);
  g.lineTo(gx1 - gpx * 5, gy1 - gpy * 5);
  g.stroke();
  // Кольца стыков пробки или рифление EVA.
  const gripRings = look.grip === 'cork' ? 11 : 16;
  g.strokeStyle = look.grip === 'cork' ? 'rgba(70,52,30,.36)' : 'rgba(8,10,12,.52)';
  g.lineWidth = .8;
  for (let i = 1; i < gripRings; i++) {
    const [x, y] = gripAt(i / gripRings);
    g.beginPath(); g.moveTo(x - gpx * 7.2, y - gpy * 7.2); g.lineTo(x + gpx * 7.2, y + gpy * 7.2); g.stroke();
  }
  if (look.grip === 'cork') {
    g.fillStyle = 'rgba(88,66,40,.3)';
    for (let i = 0; i < 24; i++) {
      const u = noise(i + 7), [cx, cy] = gripAt(u);
      const off = (noise(i + 31) - .5) * 10;
      g.beginPath(); g.ellipse(cx + gpx * off, cy + gpy * off, 1.3, .7, .6, 0, 7); g.fill();
    }
  }
  // Втулки катушкодержателя у места посадки катушки (u≈0.62 и форгрип у u≈0.97).
  for (const u of [.56, .72, .96]) {
    const [x, y] = gripAt(u);
    g.strokeStyle = D('#48564d'); g.lineWidth = 16.5;
    g.beginPath(); g.moveTo(x - rx * 3.5, y - ry * 3.5); g.lineTo(x + rx * 3.5, y + ry * 3.5); g.stroke();
    g.strokeStyle = D('#9ca898'); g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(x - rx * 3.5 + gpx * 5, y - ry * 3.5 + gpy * 5); g.lineTo(x + rx * 3.5 + gpx * 5, y + ry * 3.5 + gpy * 5); g.stroke();
  }
  // Торцевая заглушка комля.
  g.fillStyle = D('#25221d');
  g.beginPath(); g.ellipse(gx0, gy0, 8.2, 5.5, Math.atan2(gpy, gpx), 0, 7); g.fill();

  // 4. Бланк: кубическая Безье с касательной по оси рукояти и прогибом по состоянию.
  const dx = tx - bx0, dy = ty - by0, len = Math.hypot(dx, dy) || 1;
  const bow = S === 'reel' ? t * 55 + (sd > 0 ? sd * 14 : 0)
    : S === 'bite' ? 5 + Math.sin(time * 38) * 2.5
    : S === 'charge' ? -pw * 22
    : S === 'fly' ? 26 * Math.sin(Math.min(1, cast) * Math.PI * 2.2) * (1 - Math.min(1, cast))
    : (S === 'res' || S === 'out') ? 8 : 5;
  const c1x = bx0 + rx * len * .42, c1y = by0 + ry * len * .42;
  const c2x = bx0 + dx * .74 + ux * bow, c2y = by0 + dy * .74 + uy * bow;
  const at = u => {
    const v = 1 - u;
    return [v * v * v * bx0 + 3 * v * v * u * c1x + 3 * v * u * u * c2x + u * u * u * tx,
            v * v * v * by0 + 3 * v * v * u * c1y + 3 * v * u * u * c2y + u * u * u * ty];
  };
  const tan = u => {
    const v = 1 - u;
    return [3 * v * v * (c1x - bx0) + 6 * v * u * (c2x - c1x) + 3 * u * u * (tx - c2x),
            3 * v * v * (c1y - by0) + 6 * v * u * (c2y - c1y) + 3 * u * u * (ty - c2y)];
  };
  const baseW = 9, tipW = 1.3;
  const width = u => tipW + (baseW - tipW) * Math.pow(1 - u, 1.6);
  const N = 28, left = [], right = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, [x, y] = at(u), [ax, ay] = tan(u), l = Math.hypot(ax, ay) || 1;
    // qx, qy — перпендикуляр к кривой вправо-вверх (светлая сторона), -qx,-qy — к воде.
    let qx = ay / l, qy = -ax / l;
    if (qx * ux + qy * uy < 0) { qx = -qx; qy = -qy; }
    const w = width(u) / 2;
    left.push([x + qx * w, y + qy * w]);
    right.push([x - qx * w, y - qy * w]);
  }
  const blank = g.createLinearGradient(bx0, by0, tx, ty);
  blank.addColorStop(0, D(mix(look.blank, '#f0e6c8', .22)));
  blank.addColorStop(.55, D(look.blank));
  blank.addColorStop(1, D(mix(look.blank, '#101816', .3)));
  g.fillStyle = blank;
  g.beginPath();
  g.moveTo(bx0, by0);
  for (const p of left) g.lineTo(p[0], p[1]);
  for (let i = N; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
  g.closePath();
  g.fill();

  // Плетение карбона / узлы бамбука.
  if (look.weave) {
    for (let i = 0; i < 14; i++) {
      const u = i / 14, v = u + 1 / 14;
      const [x1, y1] = at(u), [a1, b1] = tan(u), l1 = Math.hypot(a1, b1) || 1, w1 = width(u) * .48;
      const [x2, y2] = at(v), [a2, b2] = tan(v), l2 = Math.hypot(a2, b2) || 1, w2 = width(v) * .48;
      g.strokeStyle = 'rgba(235,240,245,.08)'; g.lineWidth = .9;
      g.beginPath(); g.moveTo(x1 - b1 / l1 * w1, y1 + a1 / l1 * w1); g.lineTo(x2 + b2 / l2 * w2, y2 - a2 / l2 * w2); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.16)';
      g.beginPath(); g.moveTo(x1 + b1 / l1 * w1, y1 - a1 / l1 * w1); g.lineTo(x2 - b2 / l2 * w2, y2 + a2 / l2 * w2); g.stroke();
    }
  }
  if (look.nodes) {
    for (const u of [.18, .4, .6, .8]) {
      const [x, y] = at(u), [ax, ay] = tan(u), l = Math.hypot(ax, ay) || 1;
      const px = -ay / l, py = ax / l, w = width(u) * .54;
      g.strokeStyle = D(mix(look.blank, '#6b4f28', .5)); g.lineWidth = 2;
      g.beginPath(); g.moveTo(x - px * w, y - py * w); g.lineTo(x + px * w, y + py * w); g.stroke();
      g.strokeStyle = 'rgba(240,230,200,.32)'; g.lineWidth = .7;
      g.beginPath(); g.moveTo(x - px * w + ax / l * 1.5, y - py * w + ay / l * 1.5); g.lineTo(x + px * w + ax / l * 1.5, y + py * w + ay / l * 1.5); g.stroke();
    }
  }

  // Цилиндрический объём бланка: тёмная тень по правой кромке, спекулярный блик по левой и лаковые блики.
  g.fillStyle = 'rgba(10,14,16,.35)';
  g.beginPath();
  for (let i = 0; i <= N; i++) {
    const u = i / N, [x, y] = at(u), w = width(u);
    const rx2 = right[i][0], ry2 = right[i][1];
    const ix = rx2 + (x - rx2) * .7, iy = ry2 + (y - ry2) * .7;
    i ? g.lineTo(ix, iy) : g.moveTo(ix, iy);
    if (w < 0) break;
  }
  for (let i = N; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
  g.closePath();
  g.fill();

  g.strokeStyle = 'rgba(255,251,232,.35)'; g.lineWidth = 1.25;
  g.beginPath();
  for (let i = 0; i <= N; i++) {
    const u = i / N, [x, y] = at(u);
    const sx = x + (left[i][0] - x) * .44, sy = y + (left[i][1] - y) * .44;
    i ? g.lineTo(sx, sy) : g.moveTo(sx, sy);
    if (u > .95) break;
  }
  g.stroke();

  // Рефлекс-кант и короткие лаковые штрихи.
  g.strokeStyle = 'rgba(220,232,226,.16)'; g.lineWidth = .7;
  g.beginPath();
  for (let i = 0; i <= N; i++) { i ? g.lineTo(right[i][0], right[i][1]) : g.moveTo(right[i][0], right[i][1]); }
  g.stroke();
  g.strokeStyle = 'rgba(255,252,240,.38)'; g.lineWidth = 1.1;
  for (const u of [.12, .32, .52, .74]) {
    const [x1, y1] = at(u), [x2, y2] = at(Math.min(1, u + .045));
    const [ax, ay] = tan(u), l = Math.hypot(ax, ay) || 1;
    let qx = ay / l, qy = -ax / l; if (qx * ux + qy * uy < 0) { qx = -qx; qy = -qy; }
    const off = width(u) * .22;
    g.beginPath(); g.moveTo(x1 + qx * off, y1 + qy * off); g.lineTo(x2 + qx * off * .85, y2 + qy * off * .85); g.stroke();
  }

  // Феррулы — стыки колен бланка.
  for (const u of [.36, .66]) {
    const [x, y] = at(u), [ax, ay] = tan(u), l = Math.hypot(ax, ay) || 1;
    const px = -ay / l, py = ax / l, w = width(u) * .58;
    g.strokeStyle = D('#1d2622'); g.lineWidth = 2.8;
    g.beginPath(); g.moveTo(x - px * w, y - py * w); g.lineTo(x + px * w, y + py * w); g.stroke();
    g.strokeStyle = 'rgba(226,220,196,.42)'; g.lineWidth = .7;
    g.beginPath(); g.moveTo(x - px * w + ax / l, y - py * w + ay / l); g.lineTo(x + px * w + ax / l, y + py * w + ay / l); g.stroke();
  }

  // 5. Кольца (ровно 5 на u = [.2, .4, .58, .76, 1]): ножки, обмотки, рамка, керамика, блик.
  const guides = [];
  for (const u of [.2, .4, .58, .76, 1]) {
    const [x, y] = at(u), [ax, ay] = tan(u), l = Math.hypot(ax, ay) || 1, a = Math.atan2(ay, ax);
    let px = -ay / l, py = ax / l;
    if (px * nx0 + py * ny0 < 0) { px = -px; py = -py; } // строго со стороны воды/катушки
    const w = width(u), r = 7 * (1 - u) + 1.4 * u;
    const gx = x + px * (w * .5 + r * .8), gy = y + py * (w * .5 + r * .8);
    guides.push([gx, gy]);

    // Ножки-стойки к бланку.
    g.strokeStyle = D('#2a2320'); g.lineWidth = Math.max(.9, 1.7 * (1 - u * .45));
    for (const o of [-2.4 * (1 - u * .4), 2.4 * (1 - u * .4)]) {
      g.beginPath();
      g.moveTo(x + ax / l * o + px * w * .45, y + ay / l * o + py * w * .45);
      g.lineTo(gx - px * r * .35, gy - py * r * .35);
      g.stroke();
    }
    // Цветные обмотки ножек по бланку.
    for (const o of [-3.6 * (1 - u * .4), 3.6 * (1 - u * .4)]) {
      const ox = x + ax / l * o, oy = y + ay / l * o;
      g.strokeStyle = D(look.wrap); g.lineWidth = 2.8 - u * 1.1;
      g.beginPath(); g.moveTo(ox - px * w * .52, oy - py * w * .52); g.lineTo(ox + px * w * .52, oy + py * w * .52); g.stroke();
      g.strokeStyle = 'rgba(240,234,210,.38)'; g.lineWidth = .6;
      g.beginPath(); g.moveTo(ox - px * w * .28, oy - py * w * .28); g.lineTo(ox + px * w * .28, oy + py * w * .28); g.stroke();
    }
    // Металлическая рамка кольца, тёмная керамическая вставка и блик.
    g.strokeStyle = D(look.metal); g.lineWidth = Math.max(.85, 1.5 - u * .5);
    g.beginPath(); g.ellipse(gx, gy, r * .55, r, a, 0, 7); g.stroke();
    g.strokeStyle = D('#232a27'); g.lineWidth = Math.max(.55, 1.0 - u * .35);
    g.beginPath(); g.ellipse(gx, gy, r * .35, r * .68, a, 0, 7); g.stroke();
    g.fillStyle = 'rgba(255,250,236,.55)';
    g.beginPath(); g.arc(gx - px * r * .35 - ax / l * r * .25, gy - py * r * .35 - ay / l * r * .25, Math.max(.45, r * .16), 0, 7); g.fill();
  }

  // 6. Безынерционная катушка (масштаб ×1.45 у точки посадки u=0.62, чтобы ручка и левая рука не уходили за край).
  const [seatX, seatY] = gripAt(.62);
  const oldAxis = Math.atan2(-78, -56), newAxis = Math.atan2(ry, rx);
  const delta = newAxis - oldAxis, cosD = Math.cos(delta), sinD = Math.sin(delta), scR = 1.45;
  const xf = (x, y) => {
    const vx = (x - 594) * scR, vy = (y - 375) * scR;
    return [seatX + vx * cosD - vy * sinD, seatY + vx * sinD + vy * cosD];
  };
  const crankAng = S === 'reel' && hold ? time * 13 : -2.2;
  const kx = 550 + Math.cos(crankAng) * 10, ky = 389 + Math.sin(crankAng) * 9;
  const spoolPt = xf(579, 372), crankPt = xf(kx, ky);

  g.save();
  g.translate(seatX, seatY); g.rotate(delta); g.scale(scR, scR); g.translate(-594, -375);
  g.strokeStyle = D('#4a5a52'); g.lineWidth = 3; g.beginPath(); g.moveTo(566, 345); g.lineTo(572, 372); g.stroke();
  const metal = g.createLinearGradient(554, 368, 587, 400);
  metal.addColorStop(0, D(mix(look.metal, '#ffffff', .25))); metal.addColorStop(.25, D(mix(look.metal, '#273d38', .55)));
  metal.addColorStop(.6, D(mix(look.metal, '#101a16', .75))); metal.addColorStop(.85, D(look.metal)); metal.addColorStop(1, D(mix(look.metal, '#101a16', .7)));
  g.fillStyle = metal; g.beginPath(); g.ellipse(572, 385, 13, 16, -.4, 0, 7); g.fill();
  g.strokeStyle = D(mix(look.metal, '#202b26', .3)); g.lineWidth = 1.5; g.beginPath(); g.ellipse(575, 378, 9, 11, -.4, 0, 7); g.stroke();
  g.fillStyle = D('#3a4a44'); g.beginPath(); g.ellipse(577, 374, 7, 8, -.4, 0, 7); g.fill();
  g.strokeStyle = D('#d8d2b0'); g.lineWidth = .5;
  for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(577, 371 + i * 1.4, 6, 3, -.4, 0, 7); g.stroke(); }
  g.strokeStyle = D('#d5dbca'); g.lineWidth = 1; g.beginPath(); g.ellipse(577, 374, 10, 11, -.4, -.6, 2.6); g.stroke();
  g.fillStyle = D(mix(look.metal, '#ffffff', .4)); g.beginPath(); g.ellipse(585, 381, 2.2, 3, -.4, 0, 7); g.fill();
  g.strokeStyle = D('#202b26'); g.lineWidth = .6; g.beginPath(); g.ellipse(585, 381, 2.2, 3, -.4, 0, 7); g.stroke();
  g.fillStyle = D('#202b26'); g.beginPath(); g.ellipse(580, 369, 3, 2.4, -.4, 0, 7); g.fill();
  g.strokeStyle = 'rgba(226,232,214,.5)'; g.lineWidth = .5; g.beginPath(); g.ellipse(580, 369, 3, 2.4, -.4, 3.4, 5.6); g.stroke();
  for (let i = 0; i < 5; i++) {
    const a = -.4 + i * 1.26;
    g.beginPath(); g.moveTo(580 + Math.cos(a) * 1.6, 369 + Math.sin(a) * 1.3); g.lineTo(580 + Math.cos(a) * 2.9, 369 + Math.sin(a) * 2.3); g.stroke();
  }
  g.strokeStyle = D(mix(look.metal, '#202b26', .35)); g.lineWidth = 3; g.beginPath(); g.moveTo(571, 389); g.lineTo(kx, ky); g.stroke();
  g.fillStyle = D('#252e29'); g.beginPath(); g.ellipse(kx, ky, 5.2, 3.2, -.5, 0, 7); g.fill();
  g.fillStyle = 'rgba(226,232,214,.35)'; g.beginPath(); g.ellipse(kx - 1, ky - 1, 1.6, .9, -.5, 0, 7); g.fill();
  g.fillStyle = rgba(D(mix(look.metal, '#ffffff', .3)), .8); g.beginPath(); g.ellipse(kx, ky, 1, .7, -.5, 0, 7); g.fill();
  g.restore();

  // 7. Леска от шпули через все 5 колец к вершинке.
  g.strokeStyle = rgba(D('#f6f4da'), .5); g.lineWidth = .7;
  g.beginPath(); g.moveTo(spoolPt[0], spoolPt[1]);
  let prev = spoolPt;
  for (const [qx, qy] of guides) {
    g.quadraticCurveTo((prev[0] + qx) / 2, (prev[1] + qy) / 2 + 1.6, qx, qy);
    prev = [qx, qy];
  }
  g.lineTo(tx, ty); g.stroke();

  // 8. Правая рука (сжатый кулак с чёткими гранями + большой палец вдоль левой кромки втулки + стройное запястье + компактный рукав).
  const [hx, hy] = gripAt(.64);
  const P8 = (dx, dy) => [hx + dx, hy + dy];

  // Металлическая втулка катушкодержателя у выхода рукояти из кулака.
  g.save();
  g.lineCap = 'butt';
  const [rs0x, rs0y] = gripAt(.68), [rs1x, rs1y] = gripAt(.75), [rs2x, rs2y] = gripAt(.81);
  g.strokeStyle = D('#23272b'); g.lineWidth = 15.6;
  g.beginPath(); g.moveTo(rs0x, rs0y); g.lineTo(rs1x, rs1y); g.stroke();
  const [g8x, g8y] = gripAt(.78);
  const silverCollar = g.createLinearGradient(g8x + gpx * 8, g8y + gpy * 8, g8x - gpx * 8, g8y - gpy * 8);
  silverCollar.addColorStop(0, D('#98a2a6'));
  silverCollar.addColorStop(.32, D('#edf1f3'));
  silverCollar.addColorStop(.62, D('#b2bcc0'));
  silverCollar.addColorStop(1, D('#5b6469'));
  g.strokeStyle = silverCollar; g.lineWidth = 15.8;
  g.beginPath(); g.moveTo(rs1x, rs1y); g.lineTo(rs2x, rs2y); g.stroke();
  g.strokeStyle = 'rgba(12,16,18,.42)'; g.lineWidth = .8;
  for (const [sx, sy] of [[rs1x, rs1y], [rs2x, rs2y]]) {
    g.beginPath(); g.moveTo(sx - gpx * 7.8, sy - gpy * 7.8); g.lineTo(sx + gpx * 7.8, sy + gpy * 7.8); g.stroke();
  }
  g.restore();

  // Мягкая контактная тень от большого пальца вдоль левой кромки втулки/пробки и затенение седловины.
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(12,10,8,.30)'; g.lineWidth = 3.4;
  g.beginPath(); g.moveTo(...P8(-17.5, -19.8)); g.lineTo(...P8(-12.0, -12.5)); g.stroke();
  g.restore();
  const [shx, shy] = gripAt(.735);
  const seatShadow = g.createRadialGradient(shx, shy, 1, shx, shy, 8.0);
  seatShadow.addColorStop(0, 'rgba(14,10,8,.28)');
  seatShadow.addColorStop(1, 'rgba(14,10,8,0)');
  g.fillStyle = seatShadow;
  g.beginPath(); g.arc(shx, shy, 8.0, 0, 7); g.fill();

  // Компактное тёмное нутро свободного правого рукава позади стройного запястья.
  g.fillStyle = D('#1d241e');
  g.beginPath();
  g.moveTo(...P8(5.0, 42.5));
  g.quadraticCurveTo(...P8(21.5, 33.8), ...P8(37.5, 36.8));
  g.quadraticCurveTo(...P8(21.5, 45.0), ...P8(5.0, 42.5));
  g.closePath();
  g.fill();

  // Единый анатомический силуэт правой кисти + большого пальца вдоль рукояти + стройного запястья.
  const traceRightHand = () => {
    g.beginPath();
    g.moveTo(...P8(6.8, 43.5));
    // Левый край стройного голого запястья -> шейка запястья:
    g.bezierCurveTo(...P8(3.2, 34.0), ...P8(-1.8, 25.8), ...P8(-4.5, 19.2));
    // Компактное основание большого пальца (тенар):
    g.bezierCurveTo(...P8(-11.5, 13.2), ...P8(-17.8, 5.5), ...P8(-21.2, -3.0));
    // Плавный наружный край большого пальца к суставу IP и подушечке:
    g.bezierCurveTo(...P8(-23.2, -8.0), ...P8(-25.0, -12.6), ...P8(-25.4, -16.8));
    // Небольшая мягкая округлая подушечка кончика без перегиба вправо:
    g.bezierCurveTo(...P8(-25.8, -20.6), ...P8(-23.0, -22.6), ...P8(-20.0, -21.0));
    // Внутренний край пальца вдоль втулки в угол хвата:
    g.bezierCurveTo(...P8(-18.0, -19.6), ...P8(-15.4, -15.6), ...P8(-12.2, -12.6));
    // Согнутая основная фаланга указательного пальца плотно огибает рукоять к костяшке K1:
    g.bezierCurveTo(...P8(-8.6, -14.8), ...P8(-6.0, -18.2), ...P8(-2.0, -18.8));
    // Верхняя почти горизонтальная грань кулака (указательная K1 -> средняя костяшка K2):
    g.bezierCurveTo(...P8(3.2, -19.4), ...P8(7.6, -18.2), ...P8(12.2, -18.2));
    // Анатомический диагональный скос к безымянной (K3) и угловато-скруглённой мизинцевой костяшке (K4):
    g.bezierCurveTo(...P8(16.2, -18.2), ...P8(19.2, -15.0), ...P8(22.5, -13.8));
    g.bezierCurveTo(...P8(25.8, -12.6), ...P8(28.8, -9.6), ...P8(29.8, -6.2));
    // Упругое ребро гипотенара -> ровный естественный вход стройного мужского запястья в рукав:
    g.bezierCurveTo(...P8(31.4, -0.5), ...P8(30.4, 9.2), ...P8(28.8, 18.2));
    g.bezierCurveTo(...P8(28.5, 24.5), ...P8(32.0, 31.8), ...P8(35.8, 38.8));
    g.closePath();
  };

  const skinGrad = g.createLinearGradient(...P8(-26, -22), ...P8(34, 22));
  skinGrad.addColorStop(0, D('#f3ccb0'));
  skinGrad.addColorStop(.42, D('#e3ae8b'));
  skinGrad.addColorStop(.72, D('#c68563'));
  skinGrad.addColorStop(1, D('#8f553a'));

  g.save();
  traceRightHand();
  g.fillStyle = skinGrad;
  g.fill();
  g.clip();

  // Заворот верхней кромки согнутых пальцев за рукоять.
  const wrapTop = g.createLinearGradient(...P8(10, -20), ...P8(9, -13.5));
  wrapTop.addColorStop(0, rgba(D('#9e553b'), .22));
  wrapTop.addColorStop(1, rgba(D('#9e553b'), 0));
  g.fillStyle = wrapTop;
  g.fillRect(hx - 14, hy - 22, 48, 11);

  // Световой гребень пястья и костяшек K1..K2.
  const rDome = g.createRadialGradient(...P8(4, -5), 2, ...P8(4, -5), 30);
  rDome.addColorStop(0, rgba(D('#fff2e4'), .22));
  rDome.addColorStop(1, rgba(D('#fff2e4'), 0));
  g.fillStyle = rDome; g.beginPath(); g.arc(...P8(4, -5), 30, 0, 7); g.fill();

  g.strokeStyle = rgba(D('#fff4e6'), .16); g.lineWidth = 3.6;
  g.beginPath(); g.moveTo(...P8(-2, -16.5)); g.lineTo(...P8(13, -16.0)); g.lineTo(...P8(22, -12.2)); g.stroke();

  // Чёткий объёмный теневой план правого локтевого скоса кисти и запястья.
  const ulnarShade = g.createLinearGradient(...P8(13, 2), ...P8(33, -2));
  ulnarShade.addColorStop(0, rgba(D('#562a1b'), 0));
  ulnarShade.addColorStop(.55, rgba(D('#562a1b'), .20));
  ulnarShade.addColorStop(1, rgba(D('#421e12'), .42));
  g.fillStyle = ulnarShade; g.fillRect(hx - 40, hy - 35, 85, 90);

  // Тёплый подповерхностный румянец (SSS) на границе света и тени у костяшек и сустава IP.
  const rSss = g.createRadialGradient(...P8(14, -12), 3, ...P8(14, -12), 22);
  rSss.addColorStop(0, rgba(D('#cf6449'), .15));
  rSss.addColorStop(1, rgba(D('#cf6449'), 0));
  g.fillStyle = rSss; g.beginPath(); g.arc(...P8(14, -12), 22, 0, 7); g.fill();

  const ipSss = g.createRadialGradient(...P8(-21.5, -12.5), 1, ...P8(-21.5, -12.5), 5.5);
  ipSss.addColorStop(0, rgba(D('#cf6449'), .14));
  ipSss.addColorStop(1, rgba(D('#cf6449'), 0));
  g.fillStyle = ipSss; g.beginPath(); g.arc(...P8(-21.5, -12.5), 5.5, 0, 7); g.fill();

  // Румянец подушечки кончика большого пальца.
  const thumbTipSss = g.createRadialGradient(...P8(-22.8, -20.2), .5, ...P8(-22.8, -20.2), 3.6);
  thumbTipSss.addColorStop(0, rgba(D('#cf6449'), .12));
  thumbTipSss.addColorStop(1, rgba(D('#cf6449'), 0));
  g.fillStyle = thumbTipSss; g.beginPath(); g.arc(...P8(-22.8, -20.2), 3.6, 0, 7); g.fill();

  // Мягкое объёмное отделение большого пальца без резкой нарисованной полосы вглубь ладони.
  const webShade = g.createRadialGradient(...P8(-10.5, -7.5), 1, ...P8(-10.5, -7.5), 11);
  webShade.addColorStop(0, rgba(D('#6b3623'), .24));
  webShade.addColorStop(1, rgba(D('#6b3623'), 0));
  g.fillStyle = webShade; g.beginPath(); g.arc(...P8(-10.5, -7.5), 11, 0, 7); g.fill();

  g.strokeStyle = rgba(D('#683422'), .22); g.lineWidth = .85;
  g.beginPath(); g.moveTo(...P8(-12.2, -12.6)); g.quadraticCurveTo(...P8(-13.2, -9.2), ...P8(-12.4, -6.5)); g.stroke();

  g.strokeStyle = rgba(D('#fff3e6'), .16); g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(...P8(-22.2, -18.0)); g.quadraticCurveTo(...P8(-19.5, -8.5), ...P8(-13.8, 3.0)); g.stroke();

  g.strokeStyle = rgba(D('#7d442e'), .18); g.lineWidth = 2.0;
  g.beginPath(); g.moveTo(...P8(-24.8, -16)); g.lineTo(...P8(-21.6, -5)); g.lineTo(...P8(-5.5, 19.5)); g.stroke();

  g.strokeStyle = rgba(D('#824a33'), .18); g.lineWidth = .5;
  g.beginPath(); g.moveTo(...P8(-24.2, -11.4)); g.quadraticCurveTo(...P8(-22.0, -12.8), ...P8(-19.6, -13.6)); g.stroke();
  g.strokeStyle = rgba(D('#824a33'), .11); g.lineWidth = .5;
  g.beginPath(); g.moveTo(...P8(-24.2, -9.8)); g.quadraticCurveTo(...P8(-22.0, -11.2), ...P8(-19.6, -12.0)); g.stroke();

  // Деликатный рельеф пястья и стройного голого запястья (без резких полос).
  for (const [vx, vy] of [[5.8, -18.2], [17.5, -15.8], [26.5, -10.2]]) {
    const vg = g.createRadialGradient(...P8(vx, vy), .5, ...P8(vx, vy), 3.8);
    vg.addColorStop(0, rgba(D('#733c27'), .17)); vg.addColorStop(1, rgba(D('#733c27'), 0));
    g.fillStyle = vg; g.beginPath(); g.arc(...P8(vx, vy), 3.8, 0, 7); g.fill();
  }
  const snuffbox = g.createRadialGradient(...P8(-4.5, 15.0), 1, ...P8(-4.5, 15.0), 10);
  snuffbox.addColorStop(0, rgba(D('#7a432d'), .14));
  snuffbox.addColorStop(1, rgba(D('#7a432d'), 0));
  g.fillStyle = snuffbox; g.beginPath(); g.arc(...P8(-4.5, 15.0), 10, 0, 7); g.fill();

  g.strokeStyle = rgba(D('#ffeedd'), .09); g.lineWidth = 4.0;
  g.beginPath(); g.moveTo(...P8(10, -13)); g.lineTo(...P8(11, 18)); g.stroke();
  g.strokeStyle = rgba(D('#6e3926'), .09); g.lineWidth = 3.0;
  g.beginPath(); g.moveTo(...P8(15, -8)); g.lineTo(...P8(16, 20)); g.stroke();

  const uBone = g.createRadialGradient(...P8(25.2, 18.2), 1, ...P8(25.2, 18.2), 6.5);
  uBone.addColorStop(0, rgba(D('#ffeedd'), .15)); uBone.addColorStop(1, rgba(D('#ffeedd'), 0));
  g.fillStyle = uBone; g.beginPath(); g.arc(...P8(25.2, 18.2), 6.5, 0, 7); g.fill();

  // Деликатный ноготь большого пальца соосно дистальной фаланге в лёгком ракурсе слева.
  const [nx8, ny8] = P8(-22.6, -19.5);
  const nailGrad8 = g.createLinearGradient(nx8 + 1.1, ny8 + 1.8, nx8 - 1.1, ny8 - 1.8);
  nailGrad8.addColorStop(0, D('#d89f85'));
  nailGrad8.addColorStop(.72, D('#e8bfaa'));
  nailGrad8.addColorStop(1, D('#f0d0be'));
  g.fillStyle = nailGrad8;
  g.beginPath(); g.ellipse(nx8, ny8, 1.60, 2.35, -.52, 0, 7); g.fill();
  g.strokeStyle = rgba(D('#875039'), .22); g.lineWidth = .45;
  g.beginPath(); g.ellipse(nx8, ny8, 1.60, 2.35, -.52, -.15, Math.PI + .15); g.stroke();
  g.fillStyle = rgba(D('#fff8f0'), .18);
  g.beginPath(); g.ellipse(nx8 - .35, ny8 - .45, .55, .95, -.52, 0, 7); g.fill();
  g.restore();

  g.strokeStyle = rgba(D('#5a3220'), .18); g.lineWidth = .65;
  traceRightHand(); g.stroke();

  // Компактный правый рукав и свободный отворот под стройное запястье (первый градиент sleeve сохранён).
  g.save();
  g.beginPath();
  g.moveTo(...P8(5.8, 42.5));
  g.quadraticCurveTo(hx + 20, 442, 676, 462);
  g.lineTo(760, 462);
  g.quadraticCurveTo(hx + 68, 430, ...P8(36.8, 36.8));
  g.quadraticCurveTo(...P8(21.5, 34.8), ...P8(5.8, 42.5));
  g.closePath();
  g.fillStyle = sleeve;
  g.fill();
  g.clip();
  const rCloth = g.createLinearGradient(...P8(6, 41), ...P8(42, 38));
  rCloth.addColorStop(0, rgba(D('#dbe6d0'), .14));
  rCloth.addColorStop(.45, rgba(D('#718064'), 0));
  rCloth.addColorStop(1, rgba(D('#141e19'), .38));
  g.fillStyle = rCloth; g.fillRect(hx - 15, hy + 20, 175, 140);
  g.strokeStyle = rgba(D('#1a2821'), .20); g.lineWidth = 4.0;
  g.beginPath(); g.moveTo(...P8(14, 41)); g.quadraticCurveTo(hx + 22, 442, 704, 462); g.stroke();
  g.beginPath(); g.moveTo(...P8(28, 39)); g.quadraticCurveTo(hx + 42, 438, 734, 462); g.stroke();
  g.restore();

  _drawRolledCuffBand(g, ...P8(5.0, 42.5), ...P8(21.5, 34.8), ...P8(37.5, 36.8), 9.4, D);

  // 9. Левая рука: голое предплечье, 3 пальца в тени, тёмный просвет, щипок чёрного кноба (wait, bite, reel, res).
  const leftHand = S === 'wait' || S === 'bite' || S === 'reel' || S === 'res';
  if (leftHand) {
    const [ckx, cky] = crankPt;
    const L9 = (dx, dy) => [ckx + dx, cky + dy];

    // Тёмное нутро свободного левого рукава позади голого предплечья.
    g.fillStyle = D('#1d241e');
    g.beginPath();
    g.moveTo(...L9(-90, 9));
    g.quadraticCurveTo(...L9(-81, 18), ...L9(-80, 31));
    g.quadraticCurveTo(...L9(-93, 21), ...L9(-90, 9));
    g.closePath();
    g.fill();

    // 3 согнутых пальца под ладонью (мизинец -> безымянный -> средний) в глубокой тёплой тени.
    const lShadowSkin = g.createLinearGradient(...L9(-18, 6), ...L9(-28, 19));
    lShadowSkin.addColorStop(0, D('#a35c44'));
    lShadowSkin.addColorStop(.55, D('#7d3e2b'));
    lShadowSkin.addColorStop(1, D('#58281c'));
    const tuckedFingers = [
      [[-29, 8], [-25.5, 16.0], [-32.5, 17.5], [-35.5, 10.5], [-28.5, 14.5]],
      [[-21, 6], [-16.8, 15.2], [-25.0, 17.2], [-28.2, 9.2], [-20.5, 13.8]],
      [[-12.5, 4], [-7.5, 13.0], [-16.5, 15.2], [-20.5, 7.2], [-11.5, 11.8]]
    ];
    for (const [fIdx, [a, b, c, e, padPt]] of tuckedFingers.entries()) {
      g.beginPath();
      g.moveTo(...L9(a[0], a[1]));
      g.bezierCurveTo(...L9(a[0] + 4, a[1] + 5), ...L9(b[0] + 2, b[1] - 2), ...L9(b[0], b[1]));
      g.bezierCurveTo(...L9(b[0] - 2, b[1] + 3), ...L9(c[0] + 3, c[1] + 1), ...L9(c[0], c[1]));
      g.bezierCurveTo(...L9(c[0] - 4, c[1] - 2), ...L9(e[0] - 1, e[1] + 4), ...L9(e[0], e[1]));
      g.closePath();
      g.fillStyle = lShadowSkin;
      g.fill();
      const padGlow = g.createRadialGradient(...L9(padPt[0], padPt[1]), .4, ...L9(padPt[0], padPt[1]), 4.2);
      padGlow.addColorStop(0, rgba(D('#cf7b60'), .24));
      padGlow.addColorStop(1, rgba(D('#cf7b60'), 0));
      g.fillStyle = padGlow;
      g.beginPath(); g.arc(...L9(padPt[0], padPt[1]), 4.2, 0, 7); g.fill();
      if (fIdx < 2) {
        g.strokeStyle = rgba(D('#3b1a10'), .38); g.lineWidth = .75;
        g.beginPath();
        g.moveTo(...L9(b[0] + 2.5, b[1] - 7.5));
        g.quadraticCurveTo(...L9(b[0] + 1.5, b[1] - 1.5), ...L9(b[0] - 1.5, b[1] + 1.2));
        g.stroke();
      }
    }

    // Тёмное внутреннее «окошко» (впадина между указательным и большим пальцем).
    const pocketGrad = g.createLinearGradient(...L9(-30, 1), ...L9(-1, 0));
    pocketGrad.addColorStop(0, D('#542619'));
    pocketGrad.addColorStop(1, D('#82432f'));
    g.fillStyle = pocketGrad;
    g.beginPath();
    g.moveTo(...L9(-30, -2));
    g.lineTo(...L9(-8, -7));
    g.lineTo(...L9(-1, 0));
    g.lineTo(...L9(-12, 5));
    g.lineTo(...L9(-30, 4));
    g.closePath();
    g.fill();

    // Общий мировой градиент кожи левой руки для бесшовного слияния кисти, предплечья и большого пальца.
    const lSkin = g.createLinearGradient(...L9(-68, -14), ...L9(-8, 22));
    lSkin.addColorStop(0, D('#f3ccb0'));
    lSkin.addColorStop(.42, D('#e3ae8b'));
    lSkin.addColorStop(.78, D('#c68664'));
    lSkin.addColorStop(1, D('#965c41'));

    // Единый контур: голое предплечье + запястье + тыл кисти + 2-суставной согнутый указательный палец.
    const traceLeftDorsal = () => {
      g.beginPath();
      g.moveTo(...L9(-90, 10));
      g.quadraticCurveTo(...L9(-70, 5), ...L9(-52, -2.5));
      g.bezierCurveTo(...L9(-40, -8.5), ...L9(-31, -13.4), ...L9(-24.5, -13.2));
      g.quadraticCurveTo(...L9(-15.5, -12.6), ...L9(-7.5, -10.6));
      g.bezierCurveTo(...L9(-3.2, -9.4), ...L9(1.8, -5.2), ...L9(3.4, -2.0));
      g.bezierCurveTo(...L9(4.1, -0.5), ...L9(1.2, 0.2), ...L9(-1.8, -0.8));
      g.quadraticCurveTo(...L9(-6.5, -4.0), ...L9(-11.5, -5.8));
      g.quadraticCurveTo(...L9(-18.5, -4.6), ...L9(-25.5, -2.2));
      g.bezierCurveTo(...L9(-34, 4.5), ...L9(-42, 11.0), ...L9(-50, 15.5));
      g.quadraticCurveTo(...L9(-66, 23.0), ...L9(-82, 29.5));
      g.closePath();
    };

    g.save();
    traceLeftDorsal();
    g.fillStyle = lSkin;
    g.fill();
    g.clip();
    // Солнечный свет сверху предплечья, пястья и указательного пальца.
    const lSunTop = g.createLinearGradient(...L9(-55, -12), ...L9(-45, 22));
    lSunTop.addColorStop(0, rgba(D('#fff2e4'), .22));
    lSunTop.addColorStop(.45, rgba(D('#fff2e4'), 0));
    lSunTop.addColorStop(1, rgba(D('#5e301f'), .28));
    g.fillStyle = lSunTop;
    g.fillRect(ckx - 95, cky - 20, 108, 60);

    // Нежный румянец на суставах MCP и PIP указательного пальца + тончайшая складочка PIP.
    for (const [jx, jy, jr] of [[-24.5, -12, 5.2], [-7.5, -9.5, 4.2]]) {
      const jf = g.createRadialGradient(...L9(jx, jy), .4, ...L9(jx, jy), jr);
      jf.addColorStop(0, rgba(D('#d1664a'), .16)); jf.addColorStop(1, rgba(D('#d1664a'), 0));
      g.fillStyle = jf; g.beginPath(); g.arc(...L9(jx, jy), jr, 0, 7); g.fill();
    }
    g.strokeStyle = rgba(D('#824a33'), .20); g.lineWidth = .55;
    g.beginPath();
    g.moveTo(...L9(-8.5, -10.5));
    g.quadraticCurveTo(...L9(-7.5, -8.8), ...L9(-8.0, -7.2));
    g.stroke();
    g.restore();

    // Деликатный контур указательного пальца и верха предплечья.
    g.strokeStyle = rgba(D('#5a3220'), .18); g.lineWidth = .65;
    traceLeftDorsal(); g.stroke();

    // Объёмный чёрный прорезиненный кноб катушки + серебристый штифт оси.
    const knobGrad = g.createLinearGradient(...L9(-2, -4), ...L9(5, 5));
    knobGrad.addColorStop(0, D('#384044'));
    knobGrad.addColorStop(.55, D('#1a1f22'));
    knobGrad.addColorStop(1, D('#101416'));
    g.fillStyle = knobGrad;
    g.beginPath(); g.ellipse(...L9(1.6, .6), 5.8, 3.7, -.18, 0, 7); g.fill();
    g.strokeStyle = rgba(D('#cdd6da'), .16); g.lineWidth = .8;
    g.beginPath(); g.ellipse(...L9(1.6, .6), 5.0, 2.9, -.18, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    g.fillStyle = D('#cfd7d4');
    g.beginPath(); g.arc(...L9(4.4, .8), 1.4, 0, 7); g.fill();
    g.fillStyle = D('#2a3230');
    g.beginPath(); g.arc(...L9(4.4, .8), .52, 0, 7); g.fill();

    // Контактная тень от подушечки большого пальца на левой части чёрного кноба.
    g.fillStyle = 'rgba(10,12,14,.32)';
    g.beginPath(); g.arc(...L9(0, 1.8), 3.4, 0, 7); g.fill();

    // Горизонтальный большой палец на переднем плане (тем же lSkin без шва).
    const traceLeftThumb = () => {
      g.beginPath();
      g.moveTo(...L9(-46, 3.0));
      g.quadraticCurveTo(...L9(-38, .8), ...L9(-30, -.8));
      g.quadraticCurveTo(...L9(-22, -1.3), ...L9(-15, -1.2));
      g.quadraticCurveTo(...L9(-8.5, -1.6), ...L9(-3.5, -1.4));
      g.quadraticCurveTo(...L9(-.8, -.6), ...L9(.4, 1.4));
      g.bezierCurveTo(...L9(1.0, 3.8), ...L9(-2.0, 5.8), ...L9(-7.5, 6.2));
      g.bezierCurveTo(...L9(-14.5, 6.8), ...L9(-21.5, 9.8), ...L9(-31.0, 12.2));
      g.bezierCurveTo(...L9(-38.0, 13.8), ...L9(-44.0, 14.5), ...L9(-48.5, 15.0));
      g.closePath();
    };

    g.save();
    traceLeftThumb();
    g.fillStyle = lSkin;
    g.fill();
    g.clip();
    const ltHigh = g.createRadialGradient(...L9(-15, .5), 1, ...L9(-15, .5), 18);
    ltHigh.addColorStop(0, rgba(D('#fff2e4'), .22)); ltHigh.addColorStop(1, rgba(D('#fff2e4'), 0));
    g.fillStyle = ltHigh; g.beginPath(); g.arc(...L9(-15, .5), 18, 0, 7); g.fill();

    const ltShade = g.createRadialGradient(...L9(-16, 8.5), 2, ...L9(-16, 8.5), 20);
    ltShade.addColorStop(0, rgba(D('#6b3725'), .26)); ltShade.addColorStop(1, rgba(D('#6b3725'), 0));
    g.fillStyle = ltShade; g.beginPath(); g.arc(...L9(-16, 8.5), 20, 0, 7); g.fill();

    const ltPad = g.createRadialGradient(...L9(-3, 2), .5, ...L9(-3, 2), 6);
    ltPad.addColorStop(0, rgba(D('#cc6248'), .16)); ltPad.addColorStop(1, rgba(D('#cc6248'), 0));
    g.fillStyle = ltPad; g.beginPath(); g.arc(...L9(-3, 2), 6, 0, 7); g.fill();

    g.strokeStyle = rgba(D('#7d4630'), .20); g.lineWidth = .55;
    g.beginPath();
    g.moveTo(...L9(-12.5, -.2));
    g.quadraticCurveTo(...L9(-12.2, 1.4), ...L9(-13.0, 2.8));
    g.stroke();

    // Естественный ноготь большого пальца в профиль-сверху.
    const [lnx, lny] = L9(-3.6, -.2);
    const lNailGrad = g.createLinearGradient(lnx - 2.4, lny, lnx + 2.4, lny);
    lNailGrad.addColorStop(0, D('#dfa68c')); lNailGrad.addColorStop(1, D('#eec6b2'));
    g.fillStyle = lNailGrad;
    g.beginPath(); g.ellipse(lnx, lny, 2.5, 1.15, .08, 0, 7); g.fill();
    g.strokeStyle = rgba(D('#8c563e'), .22); g.lineWidth = .48;
    g.beginPath(); g.ellipse(lnx, lny, 2.5, 1.15, .08, Math.PI * .65, Math.PI * 1.35); g.stroke();
    g.restore();

    // Мягкая короткая складка у корня перепонки и тонкий контур только снизу и на кончике большого пальца.
    g.strokeStyle = rgba(D('#6e3926'), .18); g.lineWidth = .65;
    g.beginPath();
    g.moveTo(...L9(-27.5, -.6));
    g.quadraticCurveTo(...L9(-30.0, .6), ...L9(-32.5, 2.2));
    g.stroke();

    g.strokeStyle = rgba(D('#5a3220'), .13); g.lineWidth = .6;
    g.beginPath();
    g.moveTo(...L9(-15, -1.2));
    g.quadraticCurveTo(...L9(-8.5, -1.6), ...L9(-3.5, -1.4));
    g.quadraticCurveTo(...L9(-.8, -.6), ...L9(.4, 1.4));
    g.bezierCurveTo(...L9(1.0, 3.8), ...L9(-2.0, 5.8), ...L9(-7.5, 6.2));
    g.bezierCurveTo(...L9(-14.5, 6.8), ...L9(-21.5, 9.8), ...L9(-31.0, 12.2));
    g.stroke();

    // Левый рукав и свободный мягкий отворот поверх голого предплечья.
    const lSleeve = g.createLinearGradient(310, 435, ckx - 55, cky + 12);
    lSleeve.addColorStop(0, D('#253b31')); lSleeve.addColorStop(.52, D('#495e47')); lSleeve.addColorStop(1, D(SLEEVE_LIGHT));
    g.save();
    g.beginPath();
    g.moveTo(285, 458);
    g.lineTo(415, 458);
    g.quadraticCurveTo(445, 422, ...L9(-80, 30));
    g.quadraticCurveTo(...L9(-82, 18), ...L9(-90, 9));
    g.quadraticCurveTo(378, 396, 285, 430);
    g.closePath();
    g.fillStyle = lSleeve;
    g.fill();
    g.clip();
    const lFold = g.createLinearGradient(340, 396, 405, 450);
    lFold.addColorStop(0, rgba(D('#dbe8d2'), .14));
    lFold.addColorStop(.50, rgba(D('#495e47'), 0));
    lFold.addColorStop(1, rgba(D('#141e19'), .38));
    g.fillStyle = lFold; g.fillRect(280, 360, 260, 105);
    g.strokeStyle = rgba(D('#1a2821'), .22); g.lineWidth = 3.2;
    g.beginPath(); g.moveTo(340, 424); g.quadraticCurveTo(402, 412, ...L9(-88, 16)); g.stroke();
    g.beginPath(); g.moveTo(368, 438); g.quadraticCurveTo(426, 426, ...L9(-83, 25)); g.stroke();
    g.restore();

    _drawRolledCuffBand(g, ...L9(-91, 9), ...L9(-82, 19), ...L9(-79, 31), 10.0, D);
  }

  const [bmx, bmy] = at(.90), [btx, bty] = tan(.90), bml = Math.hypot(btx, bty) || 1;
  ROD_RIG = {
    tip: [tx, ty],
    blankBase: [bx0, by0],
    gripStart: [gx0, gy0],
    gripEnd: [gx1, gy1],
    spool: spoolPt,
    guides,
    crank: crankPt,
    widths: [baseW, tipW],
    bow,
    breath: [brx, bry],
    leftHand,
    bellMount: { pos: [bmx, bmy], tan: [btx / bml, bty / bml], up: [ux, uy], width: width(.90) }
  };
  g.restore();
}