const FISH_APPEARANCE = {
  1: {
    body: 'M16 46 Q20 38 29 32 C45 19 69 19 89 26 C108 33 115 41 128 43 L129 50 C114 51 105 59 86 64 C60 72 34 65 22 54 Q15 52 16 46Z',
    top: 22, bottom: 67, head: 42, eye: [28, 42, 2.5], mouth: 'M16 48 Q20 49 24 47',
    tail: 'M125 43 Q136 38 149 29 Q145 40 140 46 Q144 53 149 63 Q135 58 125 50Z',
    dorsal: [[[51,26],[55,13],[62,12],[71,14],[80,19],[96,31]]],
    ventral: [[[62,64],[69,75],[80,73],[77,64]], [[99,58],[111,70],[118,64],[116,52]]],
    pectoral: [[41,50],[48,61],[62,62],[52,49]], scale: 5,
    back: '#61553a', side: '#c3a565', belly: '#eee0b9', fin: '#93814e', lower: '#b19357', iris: '#b7a362'
  },
  2: {
    body: 'M16 46 Q19 42 23 40 Q27 31 42 29 C62 23 85 27 102 34 Q117 42 130 43 L130 50 C115 52 99 59 78 63 C55 66 33 60 24 52 Q15 53 16 46Z',
    top: 26, bottom: 63, head: 43, eye: [28,40,2.4], mouth: 'M16 47 Q20 50 24 48',
    tail: 'M126 43 Q137 36 150 28 Q146 39 141 46 Q145 54 150 65 Q135 57 126 50Z',
    dorsal: [[[47,29],[53,12],[59,13],[70,18],[91,22],[111,36]]],
    ventral: [[[66,62],[73,74],[82,72],[80,60]], [[105,56],[117,68],[124,58],[120,51]]],
    pectoral: [[42,49],[49,62],[67,64],[56,48]], scale: 6,
    barbels: 'M20 49 Q18 54 22 56 M24 49 Q25 54 31 55',
    back: '#4c4b39', side: '#afa073', belly: '#e4d8b3', fin: '#776d4b', lower: '#a78251', iris: '#bb9d57'
  },
  3: {
    body: 'M15 45 Q23 33 41 31 C57 24 77 27 94 34 Q115 43 130 43 L130 50 Q113 51 96 57 C69 64 44 61 27 53 Q18 51 15 45Z',
    top: 28, bottom: 61, head: 41, eye: [28,41,2.7], mouth: 'M15 45 Q20 47 29 47',
    tail: 'M126 43 Q136 37 150 32 Q147 40 141 46 Q146 53 150 61 Q138 58 126 50Z',
    dorsal: [[[39,31],[43,16],[47,24],[50,11],[54,21],[58,9],[62,21],[67,12],[71,23],[76,16],[80,28],[88,34]], [[89,34],[98,22],[107,25],[115,40]]],
    ventral: [[[63,60],[71,74],[81,72],[79,59]], [[99,56],[111,67],[121,59],[119,51]]],
    pectoral: [[39,48],[50,58],[65,57],[50,46]], scale: 3.7,
    back: '#495238', side: '#9fa775', belly: '#e4dfbe', fin: '#8b9677', lower: '#c56a43', iris: '#cab153'
  },
  4: {
    body: 'M8 45 Q17 43 29 41 Q36 33 48 33 C73 30 105 36 131 42 L133 47 C108 50 76 51 52 50 Q31 52 18 51 Q8 51 8 45Z',
    top: 33, bottom: 52, head: 51, eye: [31,41,2.2], mouth: 'M8 47 Q25 49 45 45',
    tail: 'M128 42 Q139 34 151 28 Q146 40 141 45 Q146 52 151 63 Q138 56 128 48Z',
    dorsal: [[[110,37],[117,23],[126,25],[136,34],[131,43]]],
    ventral: [[[68,51],[74,61],[85,59],[82,50]], [[110,49],[120,62],[132,57],[130,48]]],
    pectoral: [[48,48],[58,57],[72,57],[61,48]], scale: 0,
    back: '#4c6050', side: '#82936e', belly: '#dbddbc', fin: '#7b845d', lower: '#b0a56a', iris: '#c7b470'
  },
  5: {
    body: 'M17 45 Q24 36 37 33 C59 26 85 29 104 38 Q118 44 129 43 L131 49 Q112 51 97 57 C72 64 43 59 27 51 Q19 50 17 45Z',
    top: 30, bottom: 60, head: 39, eye: [28,41,2.6], mouth: 'M17 46 Q22 47 26 46',
    tail: 'M126 43 Q137 35 150 28 Q146 40 140 46 Q146 55 149 65 Q135 57 126 49Z',
    dorsal: [[[60,30],[66,12],[75,15],[88,32]]],
    ventral: [[[65,60],[71,74],[81,70],[79,58]], [[105,54],[117,65],[124,58],[122,50]]],
    pectoral: [[39,48],[47,60],[61,59],[50,47]], scale: 4,
    back: '#465e58', side: '#b5c5bd', belly: '#e8ece0', fin: '#7d8b80', lower: '#b6604c', iris: '#b66445'
  },
  6: {
    body: 'M19 47 Q29 41 38 30 C47 17 64 14 81 19 C105 27 111 39 127 43 L130 48 Q111 51 99 61 C76 75 47 72 32 56 Q23 54 19 47Z',
    top: 18, bottom: 70, head: 38, eye: [28,43,2.1], mouth: 'M19 48 L24 50 L27 49',
    tail: 'M125 43 Q137 35 150 26 Q146 38 139 46 Q146 56 149 69 Q135 58 125 49Z',
    dorsal: [[[63,19],[71,6],[78,10],[88,23]]],
    ventral: [[[54,68],[62,79],[72,76],[68,68]], [[80,67],[96,78],[122,57],[119,51]]],
    pectoral: [[37,51],[45,63],[64,65],[50,51]], scale: 4.5,
    back: '#5d6153', side: '#b7af8f', belly: '#e6ddc8', fin: '#686d63', lower: '#6b7064', iris: '#c1b481'
  },
  7: {
    body: 'M13 45 Q26 36 40 34 C68 26 96 34 116 42 L133 43 L134 48 Q117 50 103 54 C75 63 43 58 26 51 Q17 49 13 45Z',
    top: 32, bottom: 58, head: 39, eye: [27,42,2.7], mouth: 'M13 45 Q20 47 29 47',
    tail: 'M129 43 Q141 34 151 23 Q148 37 139 46 Q148 57 151 69 Q138 58 129 49Z',
    dorsal: [[[53,32],[60,16],[66,18],[76,34]], [[102,39],[110,30],[120,41]]],
    ventral: [[[59,57],[66,67],[76,63],[73,56]], [[101,54],[112,62],[121,51]]],
    pectoral: [[39,47],[49,57],[66,54],[50,46]], scale: 0,
    back: '#264e54', side: '#90b3ae', belly: '#e3ebe3', fin: '#6e8d88', lower: '#aab29d', iris: '#c4b17b'
  },
  8: {
    body: 'M13 46 Q20 36 36 34 C61 29 86 34 105 39 Q122 44 133 43 L135 49 Q121 51 109 54 C80 62 43 61 25 53 Q16 52 13 46Z',
    top: 33, bottom: 60, head: 43, eye: [27,41,2.3], mouth: 'M13 46 Q24 49 34 46',
    tail: 'M130 43 Q143 36 150 37 Q154 46 149 57 Q140 57 131 50Z',
    dorsal: [[[41,34],[48,19],[57,22],[63,33]], [[70,33],[81,24],[94,28],[103,39]], [[109,41],[120,34],[132,42]]],
    ventral: [[[49,58],[60,69],[86,61],[91,57]], [[96,57],[111,63],[132,50]]],
    pectoral: [[41,48],[52,60],[70,59],[54,47]], scale: 0,
    barbels: 'M24 53 Q26 60 31 61',
    back: '#555e48', side: '#a7ab86', belly: '#e3deca', fin: '#93977b', lower: '#aba88c', iris: '#b5b27b'
  },
  9: {
    body: 'M15 46 L23 38 Q30 29 45 28 C67 21 87 31 107 39 Q121 44 131 43 L132 50 Q115 53 99 59 C73 68 45 62 29 54 L21 51Z',
    top: 27, bottom: 64, head: 43, eye: [28,40,3.2], mouth: 'M15 46 L25 48 L34 46',
    tail: 'M128 43 Q139 35 150 32 Q149 42 144 46 Q148 54 150 62 Q138 59 128 50Z',
    dorsal: [[[39,30],[42,19],[47,26],[50,13],[55,24],[59,11],[64,24],[68,14],[73,26],[77,18],[83,29],[86,22],[92,33],[98,26],[110,39]]],
    ventral: [[[64,63],[71,77],[84,72],[81,61]], [[99,59],[103,69],[110,64],[115,70],[126,53]]],
    pectoral: [[42,49],[50,63],[70,63],[55,48]], scale: 3.5,
    back: '#98553f', side: '#d58c65', belly: '#eed5ac', fin: '#bd7651', lower: '#d4946b', iris: '#d6b457'
  },
  10: {
    body: 'M12 45 Q25 37 38 31 C58 23 79 29 94 35 Q116 44 131 44 L136 43 L137 49 L132 48 Q114 49 95 58 C69 68 44 61 29 52 Q17 50 12 45Z',
    top: 28, bottom: 62, head: 40, eye: [27,42,2.4], mouth: 'M12 45 Q23 48 33 47',
    tail: 'M133 44 C140 39 146 23 153 17 C149 30 143 42 142 46 C143 51 149 64 153 76 C146 69 139 54 133 49Z',
    dorsal: [[[47,29],[56,11],[61,16],[74,30]], [[86,34],[99,24],[96,37],[107,41]]],
    ventral: [[[59,62],[65,70],[75,64],[73,62]], [[92,58],[103,65],[102,54],[112,52]]],
    pectoral: [[40,47],[49,57],[66,58],[53,46]], scale: 0,
    back: '#233f54', side: '#97b5bf', belly: '#e5e9e1', fin: '#526a78', lower: '#9e9d68', iris: '#c3bd83'
  },
  11: {
    body: 'M12 45 Q18 38 32 37 C52 34 73 39 96 40 Q119 40 134 43 L136 50 Q114 52 92 54 C65 57 38 55 24 51 Q13 52 12 45Z',
    top: 36, bottom: 55, head: 38, eye: [26,42,2], mouth: 'M12 46 Q24 49 34 46',
    tail: 'M130 42 C143 34 153 38 154 46 C154 56 142 60 130 51Z',
    dorsal: [[[40,37],[46,28],[54,28],[62,38]], [[67,39],[72,30],[82,29],[92,30],[104,31],[117,33],[128,37],[137,44]]],
    ventral: [[[60,55],[65,63],[82,62],[108,57],[136,49]]],
    pectoral: [[37,48],[43,57],[56,58],[52,49]], scale: 0,
    barbels: 'M23 51 Q24 61 30 63',
    back: '#4c5135', side: '#b1ab77', belly: '#dcd6a4', fin: '#aa9f6f', lower: '#aa9e72', iris: '#bcb77e'
  },
  12: {
    body: 'M13 45 Q24 37 39 33 C62 27 87 32 105 38 Q120 44 132 43 L134 49 Q117 51 103 55 C78 63 48 59 29 53 Q17 51 13 45Z',
    top: 31, bottom: 60, head: 41, eye: [27,41,2.5], mouth: 'M13 45 Q22 48 32 47',
    tail: 'M129 43 Q141 35 150 32 Q147 40 141 46 Q147 54 150 62 Q138 58 129 50Z',
    dorsal: [[[61,31],[68,15],[78,16],[91,34]], [[114,40],[119,31],[125,33],[128,43]]],
    ventral: [[[65,60],[72,72],[82,67],[78,58]], [[103,54],[114,65],[125,57],[121,51]]],
    pectoral: [[40,48],[50,59],[67,59],[54,47]], scale: 2.8,
    back: '#455f53', side: '#aebca6', belly: '#e4e8d8', fin: '#85978c', lower: '#a5a08b', iris: '#bbb27a'
  }
};
const fishArtCache = new Map();
let fishSvgId = 0;

function fishEllipse(x, y, rx, ry = rx) {
  return `M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${rx*2} 0a${rx} ${ry} 0 1 0 ${-rx*2} 0`;
}
function fishArtwork(id) {
  if (fishArtCache.has(id)) return fishArtCache.get(id);
  const p = FISH_APPEARANCE[id], layers = [];
  const add = (d, fill, stroke = 'none', width = .6, opacity = 1, clip = false) => {
    layers.push({d, fill, stroke, width, opacity, clip});
  };
  const finSpots = (outline, left, top, right, bottom) => {
    if (id!==11 && id!==12) return;
    let spots='';
    for (let y=top+2;y<bottom;y+=3.5) for (let x=left+2;x<right;x+=4) {
      spots+=fishEllipse(x+Math.sin(y+x)*.9,y+Math.sin(x)*.8,id===11?1.2:.55,id===11?.8:.55);
    }
    add(spots, '#3e4b35', 'none', 0, .65, outline);
  };
  const fin = (points, fill, soft = true) => {
    let outline='M'+points[0].join(' ');
    for (let i=1;i<points.length-1;i++) {
      const prev=points[i-1], tip=points[i], next=points[i+1];
      outline += soft ? `L${tip[0]+(prev[0]-tip[0])*.18} ${tip[1]+(prev[1]-tip[1])*.18}Q${tip.join(' ')} ${tip[0]+(next[0]-tip[0])*.18} ${tip[1]+(next[1]-tip[1])*.18}` : 'L'+tip.join(' ');
    }
    outline += 'L'+points[points.length-1].join(' ')+'Z';
    add(outline, fill, p.back, .45, .88);
    const first = points[0], last = points[points.length-1];
    let rays = '';
    for (let i=1;i<points.length-1;i++) {
      const tip = points[i], next = points[i+1];
      const x = first[0]*.65+last[0]*.35, y = first[1]*.65+last[1]*.35;
      rays += `M${x} ${y}L${tip[0]} ${tip[1]}M${x+1.5} ${y}L${(tip[0]+next[0])/2} ${(tip[1]+next[1])/2}`;
    }
    add(rays, 'none', p.back, .45, .38, outline);
    finSpots(outline, Math.min(...points.map(point=>point[0])), Math.min(...points.map(point=>point[1])), Math.max(...points.map(point=>point[0])), Math.max(...points.map(point=>point[1])));
  };
  add(p.tail, 'fin', p.back, .6, .95);
  let tailRays = '';
  for (let i=0;i<6;i++) {
    const y = 32+i*5.5, x = id===10 ? 147 : 146-Math.sin(i/5*Math.PI)*5;
    tailRays += `M130 ${44+i*.8}Q138 ${43+i*1.1} ${x} ${y}`;
  }
  add(tailRays, 'none', p.back, .55, .45, p.tail);
  finSpots(p.tail,133,28,153,64);
  p.dorsal.forEach(points => fin(points, 'fin', points.length<8));
  p.ventral.forEach(points => fin(points, 'lower'));
  if (id===7 || id===10) {
    for (let i=0;i<4;i++) {
      const x = 117+i*4;
      fin([[x,42],[x+1,38+i*.9],[x+4,43]], id===10 ? '#b5a65d' : 'fin');
      fin([[x,51],[x+2,55-i*.8],[x+4,50]], id===10 ? '#b5a65d' : 'lower');
    }
  }
  add(p.body, 'body', p.back, .7);
  if (id===3) {
    let bars = '';
    for (let i=0;i<7;i++) {
      const x=44+i*10, end=53+(i<3?4:0);
      bars += `M${x} 25Q${x+4} 32 ${x+3} 41L${x+1} ${end}Q${x-2} 47 ${x-3} 35Z`;
    }
    add(bars, '#384c34', 'none', 0, .65, true);
  }
  if (id===7) {
    let waves = '';
    for (let i=0;i<11;i++) {
      const x=42+i*7.5, y=40+Math.sin(i*.9)*1.6;
      waves += `M${x} 28C${x-5} 32 ${x+5} 33 ${x} 36Q${x-4} 39 ${x+1} ${y}`;
    }
    add(waves, 'none', '#214c4a', 1.7, .8, true);
  }
  if (id===4 || id===8 || id===11 || id===12) {
    let spots = '';
    const start=p.head+4, step=id===12?5.8:8, rows=id===4?3:4;
    for (let row=0;row<rows;row++) for (let x=start+row%2*step*.5;x<131;x+=step) {
      const y=p.top+4+row*(p.bottom-p.top-7)/(rows-1)+Math.sin(x*.8+row)*(id===11?3:1.7);
      const r=id===12?.6+(Math.sin(x+row)+1)*.28:id===11?2.5+(Math.sin(x*.4+row)+1)*1.8:1.5+(Math.sin(x*.4+row)+1)*.7;
      if (id===8 || id===11) {
        spots += `M${x-r} ${y}Q${x-1} ${y-r*1.4} ${x+r} ${y-.4}Q${x+r*1.5} ${y+r} ${x} ${y+r*.7}Q${x-r*1.2} ${y+r} ${x-r} ${y}Z`;
      } else spots += fishEllipse(x,y,id===4?r*1.2:r,id===4?r*.6:r);
    }
    add(spots, id===4?'#e4dab0':id===11?'#444b31':id===8?'#64724f':'#374b42', 'none', 0, id===12?.8:id===11?.72:.48, true);
  }
  if (id===12) add('M33 43C61 39 97 43 134 46L134 49C94 48 60 51 33 49Z', '#b7727c', 'none', 0, .45, true);
  if (p.scale) {
    let scales = '', gleam = '';
    const step=p.scale;
    for (let row=0,y=p.top+4;y<p.bottom-3;y+=step*.72,row++) {
      for (let x=p.head+4+row%2*step*.5;x<129;x+=step) {
        scales += `M${x} ${y}q${step*.48} ${step*.6} ${step} 0`;
        gleam += `M${x+.4} ${y-.4}q${step*.48} ${step*.6} ${step-.8} 0`;
      }
    }
    add(scales, 'none', '#35483a', .45, id===2?.22:.13, true);
    add(gleam, 'none', '#faf0cc', .35, .18, true);
  }
  add(p.body, 'sheen', 'none', 0, 1, true);
  const middle=(p.top+p.bottom)/2;
  add(`M${p.head+3} ${middle}C70 ${middle-3} 105 ${middle+2} 130 46`, 'none', id===8?'#e9e5c8':p.back, id===8?1.15:.5, id===8?.85:.25, true);
  add(`M${p.head-10} ${p.top+3}Q${p.head+14} ${middle} ${p.head-4} ${p.bottom-3}Q16 ${p.bottom-5} 10 45Q15 ${p.top+3} ${p.head-10} ${p.top+3}Z`, 'head', 'none', 0, .42, true);
  add(`M${p.head} ${p.top+7}Q${p.head+8} ${middle+1} ${p.head-1} ${p.bottom-5}`, 'none', p.back, .85, .65, true);
  add(`M${p.head+1.5} ${p.top+8}Q${p.head+9} ${middle} ${p.head+.5} ${p.bottom-6}`, 'none', p.belly, .65, .65, true);
  fin(p.pectoral, 'lower');
  add(p.mouth, 'none', p.back, .85, .95);
  if (p.barbels) add(p.barbels, 'none', p.side, 1, 1);
  const [ex,ey,er]=p.eye;
  add(fishEllipse(ex,ey,er+1), p.back, 'none', 0, .35);
  add(fishEllipse(ex,ey,er), p.iris, p.back, .5);
  add(fishEllipse(ex,ey,er*.65), '#152824');
  add(fishEllipse(ex-er*.24,ey-er*.3,er*.21), '#f4f2df', 'none', 0, .9);
  const art = {profile:p, layers};
  fishArtCache.set(id,art);
  return art;
}

function fishSvg(f) {
  const art=fishArtwork(f.id), p=art.profile, id=`fish-${++fishSvgId}`;
  const paint=value => ['body','fin','lower','sheen','head'].includes(value) ? `url(#${id}-${value})` : value;
  const defs = `<linearGradient id="${id}-body" gradientUnits="userSpaceOnUse" x1="0" y1="${p.top}" x2="0" y2="${p.bottom}"><stop stop-color="${p.back}"/><stop offset=".42" stop-color="${p.side}"/><stop offset=".72" stop-color="${p.side}"/><stop offset="1" stop-color="${p.belly}"/></linearGradient><linearGradient id="${id}-fin" gradientUnits="userSpaceOnUse" x1="0" y1="12" x2="0" y2="62"><stop stop-color="${p.fin}" stop-opacity=".6"/><stop offset=".55" stop-color="${p.fin}"/><stop offset="1" stop-color="${p.belly}"/></linearGradient><linearGradient id="${id}-lower" gradientUnits="userSpaceOnUse" x1="0" y1="46" x2="0" y2="78"><stop stop-color="${p.lower}"/><stop offset="1" stop-color="${p.lower}" stop-opacity=".6"/></linearGradient><radialGradient id="${id}-sheen" gradientUnits="userSpaceOnUse" cx="73" cy="${(p.top+p.bottom)/2-2}" r="47" gradientTransform="translate(0 ${(p.top+p.bottom)/2-2}) scale(1 .36) translate(0 ${-((p.top+p.bottom)/2-2)})"><stop stop-color="#f0efdb" stop-opacity=".5"/><stop offset="1" stop-color="#f0efdb" stop-opacity="0"/></radialGradient><linearGradient id="${id}-head" gradientUnits="userSpaceOnUse" x1="18" y1="36" x2="${p.head+6}" y2="50"><stop stop-color="${p.back}"/><stop offset=".7" stop-color="${p.side}"/><stop offset="1" stop-color="${p.belly}"/></linearGradient><clipPath id="${id}-clip"><path d="${p.body}"/></clipPath>`;
  const finClips=art.layers.map((layer,i)=>typeof layer.clip==='string'?`<clipPath id="${id}-fin-${i}"><path d="${layer.clip}"/></clipPath>`:'').join('');
  const paths = art.layers.map((layer,i) => `<path d="${layer.d}" fill="${paint(layer.fill)}" stroke="${paint(layer.stroke)}" stroke-width="${layer.width}" fill-opacity="${layer.opacity}" stroke-opacity="${layer.opacity}"${layer.clip?` clip-path="url(#${id}-${layer.clip===true?'clip':'fin-'+i})"`:''}/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 88" aria-hidden="true" focusable="false"><defs>${defs}${finClips}</defs><g stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

function paintFishArtwork(gc, id) {
  const art=fishArtwork(id), p=art.profile;
  if (!art.paths) {
    art.paths=art.layers.map(layer=>new Path2D(layer.d));
    art.clips=art.layers.map(layer=>layer.clip?new Path2D(layer.clip===true?p.body:layer.clip):null);
  }
  const gradient=(x1,y1,x2,y2,stops)=>{
    const value=gc.createLinearGradient(x1,y1,x2,y2);
    stops.forEach(([offset,color])=>value.addColorStop(offset,color));
    return value;
  };
  const cy=(p.top+p.bottom)/2-2;
  const sheen=gc.createRadialGradient(73,cy,0,73,cy,47);
  sheen.addColorStop(0,'rgba(240,239,219,.5)'); sheen.addColorStop(1,'rgba(240,239,219,0)');
  const palette={
    body:gradient(0,p.top,0,p.bottom,[[0,p.back],[.42,p.side],[.72,p.side],[1,p.belly]]),
    fin:gradient(0,12,0,62,[[0,p.fin+'99'],[.55,p.fin],[1,p.belly]]),
    lower:gradient(0,46,0,78,[[0,p.lower],[1,p.lower+'99']]),
    head:gradient(18,36,p.head+6,50,[[0,p.back],[.7,p.side],[1,p.belly]]), sheen
  };
  gc.save(); gc.lineCap='round'; gc.lineJoin='round';
  art.layers.forEach((layer,i)=>{
    gc.save(); gc.globalAlpha*=layer.opacity;
    if (layer.clip) gc.clip(art.clips[i]);
    if (layer.fill!=='none') {
      gc.fillStyle=palette[layer.fill] || layer.fill;
      if (layer.fill==='sheen') {
        gc.clip(art.paths[i]); gc.translate(0,cy); gc.scale(1,.36); gc.translate(0,-cy);
        gc.fillRect(0,-200,160,600);
      } else gc.fill(art.paths[i]);
    }
    if (layer.stroke!=='none') { gc.strokeStyle=palette[layer.stroke] || layer.stroke; gc.lineWidth=layer.width; gc.stroke(art.paths[i]); }
    gc.restore();
  });
  gc.restore();
}
