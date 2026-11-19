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
  morning: {
    sky: ['#7f97b0', '#c8b39e', '#efd7a6'], sun: [505, 148, 13, '#ffe9b0'], halo: '255,225,160',
    ridges: ['#b0b6ab', '#909d89', '#6a7f64', '#495f45'], trees: ['#a3b09e', '#879882', '#61795d', '#445b43'],
    bank: '#6e7255', water: ['#b3b3a2', '#84917a', '#4d6e58', '#2a4237'],
    seaWater: ['#b0aca0', '#7d8f8a', '#4a6a70', '#20404c'],
    cloud: ['#f6e8d2', '#bfa88e'], haze: '#e8d9b8',
    sparkle: '255,228,160', waveLight: '#e8dcc0', waveDark: '#2c3a2e', mist: .13
  },
  day: {
    sky: ['#7196ad', '#b4c8ca', '#e3e2ce'], sun: [572, 57, 9, '#fff6da'], halo: '255,246,213',
    ridges: ['#a8b8b4', '#899e92', '#667e6c', '#465e49'], trees: ['#9bac9f', '#829883', '#5f795f', '#425b43'],
    bank: '#6e7255', water: ['#a2b5af', '#77958b', '#3b625b', '#233f39'],
    seaWater: ['#91a6ab', '#648992', '#376775', '#183f52'],
    cloud: ['#eef0e2', '#b9c0ae'], haze: '#dfe3d2',
    sparkle: '255,237,188', waveLight: '#caddd3', waveDark: '#112822', mist: 0
  },
  evening: {
    sky: ['#565a80', '#c07a5c', '#f2b263'], sun: [600, 163, 14, '#ffd28a'], halo: '255,190,110',
    ridges: ['#8d8078', '#6f6a60', '#4d5648', '#33443a'], trees: ['#84796e', '#665f55', '#454f42', '#2e3d34'],
    bank: '#5c5a44', water: ['#c9a27a', '#7d7a64', '#3f5a50', '#1f3630'],
    seaWater: ['#c9a27a', '#6f7d80', '#33556a', '#142c40'],
    cloud: ['#f2c9a0', '#8a6a68'], haze: '#e8b888',
    sparkle: '255,200,130', waveLight: '#e8c9a0', waveDark: '#1c2822', mist: .06
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
function getPalette(phase) {
  const blend = phase ? {part: phase, next: phase, amount: 0}
    : typeof currentDayBlend === 'function' ? currentDayBlend()
    : {part: typeof currentDayPart === 'function' ? currentDayPart() : 'day', amount: 0};
  const {part, amount} = blend, next = blend.next || part;
  const wx = typeof currentWeather === 'function' ? currentWeather() : 'clear';
  const p = PALETTES[part], q = PALETTES[next];
  const wash = wx === 'rain' ? ['#5c6a70', .38] : wx === 'fog' ? ['#b7c0ba', .34] : wx === 'wind' ? ['#8a9590', .08] : null;
  const tint = c => wash ? mix(c, wash[0], wash[1]) : c;
  const color = (a, b) => amount ? mix(tint(a), tint(b), amount) : tint(a);
  const colors = key => p[key].map((c, i) => color(c, q[key][i]));
  const scalar = (a, b) => a * (1 - amount) + b * amount;
  const night = scalar(part === 'night' ? 1 : 0, next === 'night' ? 1 : 0);
  const dim = phase => phase === 'night' ? .5 : phase === 'evening' ? .15 : 0;
  const foregroundDim = phase => phase === 'night' ? .45 : phase === 'evening' ? .12 : 0;
  return {part, next, amount, wx, night,
    sky: colors('sky'), ridges: colors('ridges'), trees: colors('trees'), bank: color(p.bank, q.bank),
    water: colors('water'), seaWater: colors('seaWater'), cloud: colors('cloud'), haze: color(p.haze, q.haze),
    sun: [...p.sun.slice(0, 3).map((v, i) => scalar(v, q.sun[i])), mix(p.sun[3], q.sun[3], amount)],
    halo: rgbOf(mix(p.halo, q.halo, amount)).join(','),
    sparkle: rgbOf(mix(p.sparkle, q.sparkle, amount)).join(','),
    waveLight: color(p.waveLight, q.waveLight), waveDark: color(p.waveDark, q.waveDark),
    environmentDim: scalar(dim(part), dim(next)), foregroundDim: scalar(foregroundDim(part), foregroundDim(next)),
    celestialAlpha: wx === 'rain' || wx === 'fog' ? .12 : 1,
    stars: night > 0 && (wx === 'clear' || wx === 'wind'),
    lit: wx !== 'rain' && wx !== 'fog',
    mist: wx === 'fog' ? .3 : scalar(p.mist, q.mist)};
}

function tree(c, x, y, h, color, pine) {
  c.strokeStyle = mix(color, '#2a3026', .55); c.lineWidth = Math.max(.5, h / 35);
  c.beginPath(); c.moveTo(x,y); c.lineTo(x,y-h); c.stroke();
  if (pine) {
    // Неровные ярусы ветвей вместо одинаковых треугольников.
    for(let j=0;j<11;j++) {
      const v=j/11, cy=y-h+v*h*.88, r=h*(.025+v*.23);
      shape(c,[[x,cy-h*.08],[x-r*(.7+noise(x+j)*.5),cy+h*.13],[x-r*.2,cy+h*.1],[x+r,cy+h*.15]],color);
      c.strokeStyle='rgba(177,190,139,.15)';c.lineWidth=.6;c.beginPath();c.moveTo(x,cy);c.lineTo(x-r*.8,cy+h*.1);c.stroke();
    }
  } else {
    for(let j=0;j<32;j++) {
      const r=h*(.05+noise(j+x)*.085), dx=(noise(x+j+9)*2-1)*h*.25;
      c.fillStyle=color;c.beginPath();c.ellipse(x+dx,y-h*.64-noise(j+x+8)*h*.32,r,r*.85,0,0,7);c.fill();
      c.fillStyle='rgba(202,209,147,.13)';c.beginPath();c.ellipse(x+dx-r*.2,y-h*.64-noise(j+x+8)*h*.32-r*.3,r*.7,r*.4,0,0,7);c.fill();
    }
  }
}
function paintSky(c, horizon, treeLine, P = getPalette()) {
  const sky = c.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, P.sky[0]); sky.addColorStop(.6, P.sky[1]); sky.addColorStop(1, P.sky[2]);
  c.fillStyle = sky; c.fillRect(0, 0, 800, horizon + 1);
  if (P.stars) {
    for (let i = 0; i < 150; i++) {
      const x = noise(i + 400) * 800, y = noise(i + 410) * horizon * .8, big = noise(i + 420) > .93;
      c.fillStyle = `rgba(226,235,248,${.2 + noise(i + 430) * .65})`;
      c.fillRect(x, y, big ? 1.6 : 1, big ? 1.6 : 1);
    }
  }
  // На лесных локациях светило поднимается над кромкой деревьев, иначе закат не виден.
  const [sx, sy0, sr, scol] = P.sun, sy = sy0 - (treeLine ? 45 : 0);
  c.save(); c.globalAlpha = P.celestialAlpha;
  const halo = c.createRadialGradient(sx, sy, 2, sx, sy, P.part === 'night' ? 95 : 135);
  halo.addColorStop(0, `rgba(${P.halo},.8)`); halo.addColorStop(.2, `rgba(${P.halo},.26)`); halo.addColorStop(1, `rgba(${P.halo},0)`);
  c.fillStyle = halo; c.fillRect(sx - 140, sy - 140, 280, 280);
  c.fillStyle = scol; c.beginPath(); c.arc(sx, sy, sr, 0, 7); c.fill();
  if (P.part === 'night') {
    c.fillStyle = 'rgba(160,178,200,.4)';
    c.beginPath(); c.arc(sx - 3, sy - 2, 1.6, 0, 7); c.fill();
    c.beginPath(); c.arc(sx + 2, sy + 3, 1.1, 0, 7); c.fill();
    c.beginPath(); c.arc(sx + 3, sy - 3, .8, 0, 7); c.fill();
  }
  c.restore();
  // Облака: подсвеченная верхняя кромка и затенённое брюхо.
  const ca = P.part === 'night' ? .5 : 1;
  for (let band = 0; band < 7; band++) {
    const x = noise(band + 55) * 900 - 50, y = 16 + noise(band + 21) * horizon * .5;
    for (let j = 0; j < 9; j++) {
      const px = x + (j - 4) * 16, py = y + Math.sin(j * .7 + band) * 4, r = 12 + noise(j + band * 21) * 16, rot = (noise(j + band * 7) - .5) * .35;
      c.globalAlpha = .11 * ca; c.fillStyle = P.cloud[1];
      c.beginPath(); c.ellipse(px, py + 3, r * 1.7, r * .42, rot, 0, 7); c.fill();
      c.globalAlpha = .14 * ca; c.fillStyle = P.cloud[0];
      c.beginPath(); c.ellipse(px, py, r * 1.6, r * .4, rot, 0, 7); c.fill();
    }
  }
  c.globalAlpha = 1;
  // Дымка у горизонта скрывает стык неба и дальних гряд.
  const hz = c.createLinearGradient(0, horizon - 44, 0, horizon);
  hz.addColorStop(0, rgba(P.haze, 0)); hz.addColorStop(1, rgba(P.haze, .4));
  c.fillStyle = hz; c.fillRect(0, horizon - 44, 800, 44);
}
const reflectedBank = document.createElement('canvas');
reflectedBank.width=1600;reflectedBank.height=840;
function paintLandscape(l, P = getPalette()) {
  const c=scenery;c.setTransform(2,0,0,2,0,0);
  c.clearRect(0,0,800,420);
  if(l.code==='sea'){paintSea(c,P);return;}
  paintSky(c,190,true,P);
  if(l.code==='pond') {
    // Пруд замкнут: вместо дальних гряд — стена хвойного леса в три яруса.
    for(let layer=0;layer<3;layer++) {
      const base=118+layer*26;
      shape(c,[[0,200],[0,base+34],[800,base+34],[800,200]],mix(P.trees[layer+1],P.haze,.22-layer*.08));
      for(let i=0;i<70;i++) {
        const x=i*11.6+noise(i+layer*7)*9,h=34+noise(i+layer*99)*(46+layer*26);
        tree(c,x,base+34,h,P.trees[layer+1],true);
      }
      if(layer<2){const hz=c.createLinearGradient(0,base,0,200);hz.addColorStop(0,rgba(P.haze,0));hz.addColorStop(1,rgba(P.haze,.14-layer*.05));c.fillStyle=hz;c.fillRect(0,base,800,200-base);}
    }
  } else {
    const layers=l.code==='lake'?2:4, low=l.code==='lake';
    for(let layer=0;layer<layers;layer++) {
      const base=low?158+layer*12:150+layer*10, amp=low?5:9;
      const pts=[[0,200],[0,base]];
      const ridge=x=>base-amp*Math.sin(x*.009+layer)-amp*.8*Math.sin(x*.019+layer*2);
      for(let x=0;x<=820;x+=8)pts.push([x,ridge(x)]);
      pts.push([800,200]);shape(c,pts,P.ridges[layer]);
      for(let i=0;i<130;i++) {
        const x=i*6.4+noise(i)*5,h=(low?6:10)+noise(i+layer*99)*(layer*7+(low?9:16));
        tree(c,x,ridge(x)+4,h,P.trees[layer],l.forest || noise(i+6)>.68);
      }
      // Воздушная перспектива: дальние гряды сильнее укрыты дымкой (мягкий градиент без кромки).
      if(layer<layers-1){const hz=c.createLinearGradient(0,110,0,200);hz.addColorStop(0,rgba(P.haze,0));hz.addColorStop(1,rgba(P.haze,[.16,.09,.04][layer]));c.fillStyle=hz;c.fillRect(0,110,800,90);}
    }
    if(low) {
      // Дальний берег озера: полоса леса по ту сторону воды, с прогалинами.
      for(let i=0;i<150;i++){if(noise(i+505)>.82)continue;const x=i*5.4+noise(i+501)*4,h=4+noise(i+502)*11;tree(c,x,180+noise(i+503)*3,h,mix(P.trees[2],P.haze,.35),noise(i+504)>.5);}
    }
  }
  // Береговая кромка и отражение берега используют одну геометрию.
  const bankCol=l.code==='lake'?mix(P.bank,'#9a8f6a',.45):P.bank;
  shape(c,[[0,182],[130,180],[310,184],[470,181],[640,179],[800,184],[800,191],[0,191]],bankCol);
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
    const stone=c.createLinearGradient(x,y-r,x,y+r);
    stone.addColorStop(0,l.code==='lake'?'#a3987a':'#8a8b71');stone.addColorStop(1,l.code==='lake'?'#5d5a44':'#3d493c');
    c.fillStyle=stone;c.beginPath();c.ellipse(x,y,r,r*.55,-.4,0,7);c.fill();
  }
  if(l.code==='river') {
    // Ива над водой: раскидистая крона и частые свисающие пряди с листвой.
    const trunk=mix('#5a4a33',P.water[3],.2);
    c.strokeStyle=trunk;c.lineWidth=8;
    c.beginPath();c.moveTo(24,368);c.quadraticCurveTo(52,306,104,276);c.stroke();
    c.lineWidth=4;c.beginPath();c.moveTo(64,322);c.quadraticCurveTo(98,298,142,292);c.stroke();
    c.lineWidth=2.5;c.beginPath();c.moveTo(96,282);c.quadraticCurveTo(120,266,150,262);c.stroke();
    const leaf=mix('#75854c',P.water[3],P.part==='night'?.55:.12);
    const leafLit=mix('#93a05e',P.water[3],P.part==='night'?.55:.1);
    for(let i=0;i<26;i++){
      const bx2=88+noise(i+420)*72,by=258+noise(i+421)*30,r=6+noise(i+422)*9;
      c.fillStyle=i%3?leaf:leafLit;c.beginPath();c.ellipse(bx2,by,r,r*.62,(noise(i+423)-.5)*.6,0,7);c.fill();
    }
    c.lineWidth=.8;
    for(let i=0;i<70;i++){
      const bx2=86+noise(i+410)*80,by=266+noise(i+411)*30,len=36+noise(i+412)*62;
      c.strokeStyle=i%4?leaf:leafLit;
      c.beginPath();c.moveTo(bx2,by);c.quadraticCurveTo(bx2+5,by+len*.6,bx2+3+noise(i+413)*5,by+len);c.stroke();
      for(let k2=1;k2<5;k2++){const u=k2/5;c.fillStyle=leafLit;c.fillRect(bx2+6*u-1,by+len*u,2.2,1.1);}
    }
  }
  if(l.code==='pond') {
    // Крупные ели по краям кадрируют замкнутую воду.
    const frame=mix(P.trees[3],'#141f18',.45);
    tree(c,64,420,220,mix(frame,P.trees[2],.3),true);
    tree(c,742,420,240,mix(frame,P.trees[2],.3),true);
    tree(c,26,420,300,frame,true);
    tree(c,778,420,320,frame,true);
  }
}
function drawWaterSurface(time, sea=false, current=false) {
  const P=getPalette();
  const rough=P.wx==='wind'?1.8:P.wx==='rain'?1.3:1;
  for(let i=0;i<190;i++) {
    const z=noise(i+300),y=189+z*z*231,span=2+z*z*(sea?95:47);
    const speed=(current?10:sea?5:2)*(1+z)*rough;
    const x=(noise(i+800)*940+time*speed)%940-70;
    const wave=Math.sin(time*(1+z)+i)*z*rough;
    g.strokeStyle=rgba(P.waveLight,.025+z*.1);g.lineWidth=.35+z*.65;
    g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x+span*.3,y-wave,x+span*.65,y+wave,x+span,y);g.stroke();
    if(i%3===0){g.strokeStyle=rgba(P.waveDark,z*.12);g.beginPath();g.moveTo(x,y+1.4);g.lineTo(x+span*.7,y+1.4);g.stroke();}
    if(sea&&rough>1.5&&i%6===0){g.strokeStyle='rgba(232,240,238,.35)';g.lineWidth=.8;g.beginPath();g.moveTo(x+span*.4,y-wave-1);g.lineTo(x+span*.55,y-wave-1);g.stroke();}
  }
  if(current) {
    // Струи течения: длинные штрихи сносятся быстрее обычной ряби.
    for(let i=0;i<26;i++){
      const z=noise(i+2100),y=196+z*z*205,len=26+z*64;
      const x=((noise(i+2200)*940-time*(16+z*26))%940+940)%940-70;
      g.strokeStyle=rgba(P.waveLight,.04+z*.08);g.lineWidth=.4+z*.5;
      g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+len*.5,y-1.5-z*2,x+len,y);g.stroke();
    }
  }
  if(sea) {
    // Медленная океанская зыбь поверх ряби.
    for(let i=0;i<3;i++){
      const y=214+i*58+Math.sin(time*.35+i*1.7)*3;
      g.strokeStyle=rgba(P.waveLight,.05+i*.01);g.lineWidth=1.1;
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
  // Дрожащая дорожка света следует за солнцем/луной; с расстоянием штрихи мельче.
  const sx=P.sun[0], count=P.lit?95:0;
  for(let i=0;i<count;i++) {
    const z=noise(i+1400),y=190+z*z*230;
    const x=sx+(noise(i+1500)-.5)*(16+z*z*190)+Math.sin(time*1.2+i)*z*5;
    const visibility=i<60?1:1-P.night;
    g.fillStyle=`rgba(${P.sparkle},${(.05+noise(i+42)*.25)*(.65+Math.sin(time*2+i)*.35)*visibility})`;
    g.fillRect(x,y,1+z*z*22,.5+z*.5);
  }
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
function drawEnvironment(l, time) {
  const P=getPalette();
  drawLandscape(l,P);
  drawWaterSurface(time,false,l.current);
  const wind=typeof currentWeather==='function'&&currentWeather()==='wind'?2.5:1;
  const dim=P.environmentDim;
  const reedDark=P.water[3];
  const reedCount=l.code==='lake'?28:l.code==='pond'?50:45;
  for(let i=0;i<reedCount;i++) {
    const x=noise(i+100)*73,y=372+noise(i+45)*50,h=25+noise(i+65)*80,sway=Math.sin(time*1.2+i*.7)*2*wind;
    g.strokeStyle=mix(['#334b31','#657249','#889065'][i%3],reedDark,dim);g.lineWidth=.7+noise(i)*1.1;
    g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x-5,y-h*.5,x+sway,y-h);g.stroke();
    g.beginPath();g.moveTo(x,y-8);g.quadraticCurveTo(x+18,y-h*.6,x+13,y-h*.7);g.stroke();
    if(i%4===0){g.strokeStyle=mix('#5b4934',reedDark,dim);g.lineWidth=2.5;g.beginPath();g.moveTo(x+sway,y-h);g.lineTo(x+sway,y-h+12);g.stroke();}
  }
  if(l.code==='pond') {
    for(let i=0;i<24;i++) {
      const x=738+noise(i+150)*58,y=378+noise(i+145)*42,h=22+noise(i+165)*70,sway=Math.sin(time*1.1+i*.9)*2*wind;
      g.strokeStyle=mix(['#2e442c','#5a6a42','#7d875c'][i%3],reedDark,dim);g.lineWidth=.7+noise(i+5)*1.1;
      g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+4,y-h*.5,x+sway,y-h);g.stroke();
      if(i%4===0){g.strokeStyle=mix('#54432f',reedDark,dim);g.lineWidth=2.3;g.beginPath();g.moveTo(x+sway,y-h);g.lineTo(x+sway,y-h+10);g.stroke();}
    }
  }
  if(P.night<1&&P.wx!=='rain') {
    g.strokeStyle=rgba('#30413e',.6*(1-P.night));g.lineWidth=.8;
    for(let i=0;i<3;i++){const x=260+i*21+Math.sin(time*.08)*15,y=65+i%2*9;g.beginPath();g.moveTo(x-4,y);g.quadraticCurveTo(x-2,y-2,x,y);g.quadraticCurveTo(x+2,y-2,x+5,y-1);g.stroke();}
  }
}
const dockFrames = new Map();
const dockBlend = document.createElement('canvas'); dockBlend.width = 1600; dockBlend.height = 108;
function paintDock(frame, P) {
    const D=c=>mix(c,'#141c26',P.environmentDim);
    const c=frame.getContext('2d');c.setTransform(2,0,0,2,0,0);c.clearRect(0,0,800,420);
    shape(c,[[202,367],[598,367],[800,420],[0,420]],D('#302c22'));
    for(let j=0;j<7;j++) {
      const a=j/7,b=(j+1)/7,y=367+53*a*a,bottom=367+53*b*b,left=202*(1-a*a),right=800-left;
      const wood=c.createLinearGradient(0,y,0,bottom);wood.addColorStop(0,D(j%2?'#887b60':'#99896a'));wood.addColorStop(1,D('#665b46'));
      c.save();c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.lineTo(800-202*(1-b*b),bottom-1);c.lineTo(202*(1-b*b),bottom-1);c.closePath();c.clip();
      c.fillStyle=wood;c.fillRect(0,y,800,bottom-y);
      for(let k=0;k<95;k++) {
        const x=noise(j*95+k)*800, yy=y+noise(k+j*81)*(bottom-y);
        c.strokeStyle=k%3?'rgba(37,33,24,.19)':'rgba(217,204,159,.17)';c.lineWidth=.3;
        c.beginPath();c.moveTo(x,yy);c.bezierCurveTo(x+15,yy-.6,x+34,yy+.6,x+60+noise(k)*90,yy);c.stroke();
      }
      for(const x of [left+18,right-18,390]) {
        c.fillStyle=D('#403c32');c.beginPath();c.ellipse(x,(y+bottom)/2,1.2,.6,0,0,7);c.fill();
        c.fillStyle=D('#b1aa8f');c.fillRect(x-.7,(y+bottom)/2-.5,.8,.4);
      }
      c.restore();
    }
    for(const x of [260,400,540]){c.strokeStyle='rgba(38,31,22,.65)';c.lineWidth=.8;c.beginPath();c.moveTo(x,367);c.lineTo(400+(x-400)*2.1,420);c.stroke();}
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

// Только руки и снасть: положение камеры совпадает со взглядом рыбака.
function drawFirstPersonRod(tx, ty, time) {
  const lift = S==='charge' ? pw*30 : S==='fly' ? Math.sin(Math.min(1,cast)*Math.PI)*18 : 0;
  const hx=590, hy=374-lift;
  g.save();g.lineCap='round';
  const P=getPalette(), dim=P.foregroundDim;
  const D=c=>mix(c,'#141c26',dim);
  const sleeve=g.createLinearGradient(580,330,710,430);
  sleeve.addColorStop(0,D('#718064'));sleeve.addColorStop(.5,D('#495d46'));sleeve.addColorStop(1,D('#283f35'));
  shape(g,[[800,420],[673,420],[572,376-lift],[590,344-lift],[695,376]],sleeve);
  g.strokeStyle=D('#8a9477');g.lineWidth=1.3;g.beginPath();g.moveTo(612,368-lift);g.lineTo(710,410);g.stroke();
  g.save();g.translate(hx,hy);g.rotate(-.55);
  const skin=g.createLinearGradient(-12,-20,15,18);skin.addColorStop(0,D('#e1b58a'));skin.addColorStop(.6,D('#bd8e68'));skin.addColorStop(1,D('#805940'));
  g.fillStyle=skin;g.beginPath();g.roundRect(-17,-23,34,49,12);g.fill();g.restore();
  // Комель и пробковая рукоять с катушкодержателем.
  g.strokeStyle=D('#252f2b');g.lineWidth=10;g.beginPath();g.moveTo(624,420);g.lineTo(610,400-lift*.4);g.stroke();
  const gx0=622, gy0=414-lift*.4, gx1=566, gy1=336-lift;
  const cork=g.createLinearGradient(gx0,gy0,gx1,gy1);
  cork.addColorStop(0,D('#a9885c'));cork.addColorStop(.5,D('#c9a875'));cork.addColorStop(1,D('#b3925f'));
  g.strokeStyle=cork;g.lineWidth=9;g.beginPath();g.moveTo(gx0,gy0);g.lineTo(gx1,gy1);g.stroke();
  g.strokeStyle=D('#d8bc8c');g.lineWidth=3;g.beginPath();g.moveTo((gx0+gx1)/2,(gy0+gy1)/2);g.lineTo(gx1,gy1);g.stroke();
  const gdx=gx1-gx0, gdy=gy1-gy0, gl=Math.hypot(gdx,gdy)||1, gpx=-gdy/gl, gpy=gdx/gl;
  g.strokeStyle='rgba(70,52,30,.35)';g.lineWidth=.7;
  for(let i=1;i<8;i++){const u=i/8, x=gx0+gdx*u, y=gy0+gdy*u;
    g.beginPath();g.moveTo(x-gpx*4.2,y-gpy*4.2);g.lineTo(x+gpx*4.2,y+gpy*4.2);g.stroke();}
  g.fillStyle='rgba(88,66,40,.3)';
  for(let i=0;i<14;i++){const u=noise(i+7), x=gx0+gdx*u+(noise(i+31)-.5)*6, y=gy0+gdy*u+(noise(i+53)-.5)*6;
    g.beginPath();g.ellipse(x,y,.9,.5,.6,0,7);g.fill();}
  for(const u of [.42,.66]){const x=gx0+gdx*u, y=gy0+gdy*u;
    g.strokeStyle=D('#5b6a60');g.lineWidth=10;g.beginPath();g.moveTo(x-gdx/gl*3,y-gdy/gl*3);g.lineTo(x+gdx/gl*3,y+gdy/gl*3);g.stroke();
    g.strokeStyle=D('#93a08f');g.lineWidth=1;g.beginPath();g.moveTo(x-gdx/gl*3-gpx*4,y-gdy/gl*3-gpy*4);g.lineTo(x+gdx/gl*3-gpx*4,y+gdy/gl*3-gpy*4);g.stroke();}
  g.fillStyle=D('#2b2620');g.beginPath();g.ellipse(gx0+1,gy0+1,6,4,-.5,0,7);g.fill();
  // Бланк: кубическая кривая с прогибом под нагрузкой, конусный профиль.
  const bx0=563, by0=333-lift, dx=tx-bx0, dy=ty-by0, len=Math.hypot(dx,dy)||1;
  let nx=dy/len, ny=-dx/len; if(ny>0){nx=-nx;ny=-ny;}
  const bow=S==='reel' ? t*38+(sd>0?sd*10:0) : (S==='idle'||S==='wait') ? 4 : 0;
  const c1x=bx0+dx*.33+nx*bow*.45, c1y=by0+dy*.33+ny*bow*.45;
  const c2x=bx0+dx*.72+nx*bow, c2y=by0+dy*.72+ny*bow;
  const at=u=>{const v=1-u;return [v*v*v*bx0+3*v*v*u*c1x+3*v*u*u*c2x+u*u*u*tx, v*v*v*by0+3*v*v*u*c1y+3*v*u*u*c2y+u*u*u*ty];};
  const tan=u=>{const v=1-u;return [3*v*v*(c1x-bx0)+6*v*u*(c2x-c1x)+3*u*u*(tx-c2x), 3*v*v*(c1y-by0)+6*v*u*(c2y-c1y)+3*u*u*(ty-c2y)];};
  const width=u=>.8+4.2*Math.pow(1-u,1.35);
  const N=24, left=[], right=[];
  for(let i=0;i<=N;i++){const u=i/N, [x,y]=at(u), [ax,ay]=tan(u), l=Math.hypot(ax,ay)||1;
    const px=-ay/l, py=ax/l, w=width(u)/2;
    left.push([x+px*w,y+py*w]);right.push([x-px*w,y-py*w]);}
  const rodBase=['#ab8750','#526b62','#384849'][+sr.value] || '#ab8750';
  const blank=g.createLinearGradient(bx0,by0,tx,ty);
  blank.addColorStop(0,D(mix(rodBase,'#f0e6c8',.22)));blank.addColorStop(.55,D(rodBase));blank.addColorStop(1,D(mix(rodBase,'#101816',.3)));
  g.fillStyle=blank;g.beginPath();g.moveTo(left[0][0],left[0][1]);
  for(const p of left)g.lineTo(p[0],p[1]);
  for(let i=N;i>=0;i--)g.lineTo(right[i][0],right[i][1]);
  g.closePath();g.fill();
  g.strokeStyle='rgba(240,236,214,.3)';g.lineWidth=.6;g.beginPath();
  for(let i=0;i<=N;i++){const p=left[i];i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]);}g.stroke();
  // Феррулы — стыки колен бланка.
  for(const u of [.38,.68]){const [x,y]=at(u), [ax,ay]=tan(u), l=Math.hypot(ax,ay)||1;
    const px=-ay/l, py=ax/l, w=width(u)*.6;
    g.strokeStyle=D('#1d2622');g.lineWidth=2.2;g.beginPath();g.moveTo(x-px*w,y-py*w);g.lineTo(x+px*w,y+py*w);g.stroke();
    g.strokeStyle='rgba(226,220,196,.4)';g.lineWidth=.6;g.beginPath();g.moveTo(x-px*w+ax/l,y-py*w+ay/l);g.lineTo(x+px*w+ax/l,y+py*w+ay/l);g.stroke();}
  // Кольца: ножка с обмотками и ободок по касательной, леска идёт под ними.
  for(const u of [.3,.5,.7,.88,1]){const [x,y]=at(u), [ax,ay]=tan(u), l=Math.hypot(ax,ay)||1, a=Math.atan2(ay,ax);
    let px=-ay/l, py=ax/l; if(py<0){px=-px;py=-py;}
    const w=width(u), r=3.4-1.8*u;
    g.strokeStyle=D('#2a2320');g.lineWidth=1.4;
    for(const o of [-1.6,1.6]){g.beginPath();g.moveTo(x+ax/l*o-px*w*.5,y+ay/l*o-py*w*.5);g.lineTo(x+ax/l*o+px*w*.5,y+ay/l*o+py*w*.5);g.stroke();}
    const gx=x+px*(w*.5+r*.75), gy=y+py*(w*.5+r*.75);
    g.strokeStyle=D('#cfd6c6');g.lineWidth=1;g.beginPath();g.ellipse(gx,gy,r*.5,r,a,0,7);g.stroke();
    g.strokeStyle=D('#6e7a6c');g.lineWidth=.5;g.beginPath();g.ellipse(gx,gy,r*.28,r*.6,a,0,7);g.stroke();}
  // Безынерционная катушка: ножка, корпус, ротор, шпуля с леской, дужка и драг.
  g.strokeStyle=D('#4a5a52');g.lineWidth=3;g.beginPath();g.moveTo(566,345-lift);g.lineTo(572,372-lift);g.stroke();
  const metal=g.createLinearGradient(554,368-lift,587,400-lift);
  metal.addColorStop(0,D('#c1c8bd'));metal.addColorStop(.25,D('#5c716b'));metal.addColorStop(.6,D('#273d38'));metal.addColorStop(.85,D('#8b9a8c'));metal.addColorStop(1,D('#263831'));
  g.fillStyle=metal;g.beginPath();g.ellipse(572,385-lift,13,16,-.4,0,7);g.fill();
  g.strokeStyle=D('#8b9a8c');g.lineWidth=1.5;g.beginPath();g.ellipse(575,378-lift,9,11,-.4,0,7);g.stroke();
  g.fillStyle=D('#3a4a44');g.beginPath();g.ellipse(577,374-lift,7,8,-.4,0,7);g.fill();
  g.strokeStyle=D('#d8d2b0');g.lineWidth=.5;
  for(let i=0;i<5;i++){g.beginPath();g.ellipse(577,371-lift+i*1.4,6,3,-.4,0,7);g.stroke();}
  g.strokeStyle=D('#d5dbca');g.lineWidth=1;g.beginPath();g.ellipse(577,374-lift,10,11,-.4,-.6,2.6);g.stroke();
  g.fillStyle=D('#202b26');g.beginPath();g.ellipse(580,369-lift,3,2.4,-.4,0,7);g.fill();
  g.strokeStyle='rgba(226,232,214,.5)';g.lineWidth=.5;g.beginPath();g.ellipse(580,369-lift,3,2.4,-.4,3.4,5.6);g.stroke();
  const crank=S==='reel'&&hold ? time*13 : 1;
  const kx=550+Math.cos(crank)*10, ky=389-lift+Math.sin(crank)*9;
  g.strokeStyle=D('#a3ab95');g.lineWidth=3;g.beginPath();g.moveTo(571,389-lift);g.lineTo(kx,ky);g.stroke();
  g.fillStyle=D('#252e29');g.beginPath();g.ellipse(kx,ky,5,3,-.5,0,7);g.fill();
  g.fillStyle='rgba(226,232,214,.35)';g.beginPath();g.ellipse(kx-1,ky-1,1.6,.9,-.5,0,7);g.fill();
  // Пальцы обхватывают рукоять, не перекрывая вершинку.
  g.strokeStyle=D('#d5a67d');g.lineWidth=6;
  for(let i=0;i<3;i++){g.beginPath();g.moveTo(578+i*4,360-lift+i*6);g.quadraticCurveTo(594+i*3,360-lift+i*6,592+i*3,367-lift+i*6);g.stroke();}
  if(S==='reel'){
    shape(g,[[331,420],[421,420],[548,394-lift],[544,374-lift],[499,380-lift]],sleeve);
    g.fillStyle=D('#c69b75');g.beginPath();g.ellipse(kx-7,ky+2,17,10,-.3,0,7);g.fill();
  }
  g.restore();
}