const FISH_APPEARANCE = {
  1: {
    body: 'M16 46 Q20 38 29 32 C45 18 69 18 89 26 C108 33 115 41 128 43 L129 50 C114 51 105 59 86 64 C60 72 34 65 22 54 Q15 52 16 46Z',
    top: 21, bottom: 67, head: 42, eye: [28,42,2.4], mouth: 'M16.4 47.6L20 48L24 46.9 M17 49.3Q19 50.2 21 49.8',
    tail: 'M125 43 Q136 38 149 29 Q145 40 140 46 Q144 53 149 63 Q135 58 125 50Z',
    dorsal: [[[51,26],[55,13],[62,12],[71,14],[80,19],[96,31]]],
    ventral: [[[62,64],[66,72],[73,75],[80,72],[77,64]], [[99,58],[108,67],[115,69],[118,64],[116,52]]],
    pectoral: [[41,50],[45,57],[54,62],[61,60],[52,49]], scale: 5,
    heightScale: [.28, .47],
    back: '#565039', side: '#b8a067', belly: '#e8d9b0', fin: '#887d51', lower: '#a08c54', iris: '#b7a362'
  },
  2: {
    body: 'M16 46 Q18 42 23 40 Q27 31 42 28 C62 21 85 26 102 34 Q117 42 130 43 L130 50 C115 52 99 61 78 65 C55 68 33 61 24 53 Q15 54 16 46Z',
    top: 24, bottom: 66, head: 43, eye: [28,40,2.3], mouth: 'M16.4 47.4Q18 49.8 21 50L26 47.9 M16.7 49.5Q18.5 52 22 51',
    tail: 'M126 43 Q137 36 150 28 Q146 39 141 46 Q145 54 150 65 Q135 57 126 50Z',
    dorsal: [[[47,27],[51,15],[56,13],[62,15],[71,18],[86,21],[103,30],[111,37]]],
    ventral: [[[66,64],[70,71],[76,76],[83,72],[80,62]], [[105,57],[111,65],[118,68],[124,59],[120,51]]],
    pectoral: [[42,49],[46,57],[56,64],[65,63],[56,48]], scale: 6,
    barbels: 'M20 50 Q18 54 21 57 M24 50 Q25 54 30 55',
    heightScale: [.30, .47],
    back: '#454332', side: '#b49b65', belly: '#e3d3a9', fin: '#766b48', lower: '#a17c4e', iris: '#b59a55'
  },
  3: {
    body: 'M15 45 Q23 33 41 29 C56 20 78 24 94 32 Q115 42 130 43 L130 50 Q113 52 96 59 C69 67 44 62 27 53 Q18 51 15 45Z',
    top: 24, bottom: 64, head: 41, eye: [28,40,2.7], mouth: 'M15.5 45.4L22 46.2L31 44.7 M18 48.2Q24 49.2 30 47.5',
    tail: 'M126 43 Q136 37 150 32 Q147 40 141 46 Q146 53 150 61 Q138 58 126 50Z',
    dorsal: [[[39,29],[43,16],[47,18],[50,11],[54,15],[58,9],[62,14],[67,12],[71,18],[76,16],[80,25],[88,33]], [[89,33],[95,24],[101,22],[108,27],[115,40]]],
    ventral: [[[63,63],[68,71],[75,76],[82,71],[79,61]], [[99,58],[106,66],[113,69],[122,59],[119,51]]],
    pectoral: [[39,48],[44,54],[55,59],[64,56],[50,46]], scale: 3.7,
    heightScale: [.30, .45],
    back: '#3f4e35', side: '#98a371', belly: '#dddcc0', fin: '#859373', lower: '#c26b40', iris: '#c6b15b'
  },
  4: {
    body: 'M8 43 Q18 42 28 40 Q34 34 46 32 C70 28 105 35 131 42 L133 48 C108 51 77 55 51 54 Q34 54 23 52 Q13 53 7 48 Q6 45 8 43Z',
    top: 31, bottom: 55, head: 47, eye: [30,41.5,1.9], mouth: 'M8 46.2L22 46.8L40 44.6 M10 49.3Q22 51.2 35 49.4',
    tail: 'M128 42 Q139 34 151 28 Q146 40 141 45 Q146 52 151 63 Q138 56 128 49Z',
    dorsal: [[[110,37],[115,27],[121,23],[128,25],[135,34],[131,43]]],
    ventral: [[[68,54],[71,60],[78,63],[85,59],[82,53]], [[110,51],[115,59],[124,63],[132,57],[130,49]]],
    pectoral: [[46,50],[50,55],[59,59],[70,56],[59,49]], scale: 0,
    heightScale: [.32, .39],
    back: '#3c5142', side: '#7e8d60', belly: '#d6d9b6', fin: '#76825d', lower: '#a39b58', iris: '#c4b267'
  },
  5: {
    body: 'M17 45 Q24 36 37 33 C59 26 85 29 104 38 Q118 44 129 43 L131 49 Q112 51 97 57 C72 64 43 59 27 51 Q19 50 17 45Z',
    top: 30, bottom: 60, head: 39, eye: [28,41,2.5], mouth: 'M17.4 45.8L21 46.8L26 45.9',
    tail: 'M126 43 Q137 35 150 28 Q146 40 140 46 Q146 55 149 65 Q135 57 126 49Z',
    dorsal: [[[60,30],[66,12],[75,15],[88,32]]],
    ventral: [[[65,60],[68,67],[74,73],[81,69],[79,58]], [[105,54],[113,63],[120,65],[124,58],[122,50]]],
    pectoral: [[39,48],[43,55],[52,61],[61,58],[50,47]], scale: 4,
    heightScale: [.30, .44],
    back: '#3c5557', side: '#b2c2be', belly: '#e9ede4', fin: '#788980', lower: '#ae624d', iris: '#bc6347'
  },
  6: {
    body: 'M19 47 Q29 41 38 30 C47 17 64 14 81 19 C105 27 111 39 127 43 L130 48 Q111 51 99 61 C76 75 47 72 32 56 Q23 54 19 47Z',
    top: 18, bottom: 70, head: 38, eye: [29,43.5,2.1], mouth: 'M19.3 47.7L22 49.6L26 49.3 M20 50Q22 51.1 24 50.8',
    tail: 'M125 43 Q137 35 150 26 Q146 38 139 46 Q146 56 149 69 Q135 58 125 49Z',
    dorsal: [[[63,19],[71,6],[78,10],[88,23]]],
    ventral: [[[54,68],[58,75],[65,79],[72,75],[68,68]], [[80,67],[87,75],[96,79],[106,72],[122,57],[119,51]]],
    pectoral: [[37,51],[41,59],[52,65],[63,64],[50,51]], scale: 4.5,
    heightScale: [.28, .47],
    back: '#4d5247', side: '#b5ae8d', belly: '#e4dcc4', fin: '#656b60', lower: '#686e61', iris: '#b9ae7a'
  },
  7: {
    body: 'M12 45 L23 40 Q31 35 40 34 C68 26 96 34 116 42 L133 44 L134 48 Q117 50 103 54 C75 63 43 58 26 51 Q17 50 12 45Z',
    top: 32, bottom: 58, head: 39, eye: [26,42,2.5], mouth: 'M12.6 45.2L22 46.1L32 45.5 M18 48.6Q25 49.7 33 47.3',
    tail: 'M129 43C139 39 147 32 152 28C148 38 143 42 139 46C143 50 148 57 152 64C143 61 135 54 129 49Z',
    dorsal: [[[53,32],[59,19],[63,16],[68,21],[76,34]], [[102,39],[108,31],[114,34],[120,41]]],
    ventral: [[[59,57],[66,66],[73,64],[76,59],[73,56]], [[101,54],[108,60],[115,57],[121,51]]],
    pectoral: [[39,46],[46,49],[59,51],[53,48],[44,45]], scale: 0,
    heightScale: [.32, .40],
    back: '#214850', side: '#94b5b4', belly: '#e8eee8', fin: '#658788', lower: '#a1afa2', iris: '#bdb587'
  },
  8: {
    body: 'M11 43.5Q12 39.5 19 37Q26 34 32 34C45 29 66 30 86 35Q117 44 133 44L135 49Q120 52 108 56C78 64 46 62 27 55Q19 54 15 49L13 46.5Z',
    top: 31, bottom: 62, head: 49, eye: [27,40,2.3], mouth: 'M11.5 44.8L20 45.5L36 44.5 M15.5 48.5Q25 50.7 36 47.4',
    tail: 'M130 43 Q143 36 150 37 Q154 46 149 58 Q140 57 131 50Z',
    dorsal: [[[41,33],[44,25],[49,20],[55,20],[60,25],[64,33]], [[70,33],[76,27],[82,24],[90,25],[97,30],[104,39]], [[109,41],[115,35],[121,34],[127,37],[133,43]]],
    ventral: [[[34,55],[36,62],[42,64],[45,57]], [[53,60],[60,68],[69,69],[86,63],[92,58]], [[97,58],[105,63],[115,62],[132,50]]],
    pectoral: [[47,49],[51,55],[59,61],[68,59],[57,48]], scale: 0,
    barbels: 'M21 53 Q19 58 22 62',
    heightScale: [.30, .43],
    back: '#4e5943', side: '#a0a982', belly: '#e2dfc8', fin: '#8c957b', lower: '#a7a68b', iris: '#b7b481'
  },
  9: {
    body: 'M16 45.5L21 37.5Q33 26 48 25C69 20 91 30 107 38Q121 43 131 43L132 50Q115 54 99 62C73 71 46 65 30 56Q22 54 18 49.5Z',
    top: 23, bottom: 67, head: 49, eye: [29,39,3.6], mouth: 'M16.5 45.8L24 47.2L38 44.9 M18.2 49.3Q28 52 37 47.8',
    tail: 'M128 43 Q140 36 149 34 Q152 46 149 61 Q139 57 128 50Z',
    dorsal: [[[43,27],[46,18],[50,21],[54,12],[59,17],[63,11],[68,18],[73,14],[78,22],[83,19],[88,27],[93,25],[98,32],[102,34],[106,29],[112,27],[119,31],[126,41]]],
    ventral: [[[64,66],[69,73],[76,79],[85,72],[81,64]], [[99,62],[103,69],[108,67],[114,71],[126,53]]],
    pectoral: [[48,50],[50,58],[59,66],[69,62],[59,49]], scale: 3.5,
    heightScale: [.29, .46],
    back: '#914d3d', side: '#c77b59', belly: '#e9cfa8', fin: '#b66b4c', lower: '#c38961', iris: '#cfb568'
  },
  10: {
    body: 'M12 45 Q24 37 37 31 C54 22 75 25 93 35 Q114 44 131 45 L136 44 L137 49 L132 49 Q114 51 95 60 C68 70 43 63 29 53 Q17 51 12 45Z',
    top: 25, bottom: 66, head: 40, eye: [27,41,2.3], mouth: 'M12.5 45.3L24 46.3L34 45.7 M18 48.7Q25 50.2 34 48',
    tail: 'M133 44C141 39 146 27 153 22C149 33 145 42 143 46C145 52 149 61 153 70C146 66 140 55 133 50Q137 47 133 44Z',
    dorsal: [[[47,28],[55,13],[59,12],[64,21],[74,29]], [[87,34],[96,23],[99,24],[99,31],[103,37],[109,42]]],
    ventral: [[[59,65],[65,72],[73,67],[75,63]], [[92,61],[102,67],[104,58],[112,53]]],
    pectoral: [[40,46],[49,49],[74,53],[63,49],[49,44]], scale: 0,
    heightScale: [.30, .45],
    back: '#203a4c', side: '#94b2bd', belly: '#e6ebe4', fin: '#4d6676', lower: '#aba064', iris: '#bebc88'
  },
  11: {
    body: 'M11 45 Q17 38 31 37 C51 34 73 39 96 40 Q119 40 134 43 L136 50 Q114 52 92 54 C65 57 38 56 24 52 Q14 53 11 45Z',
    top: 36, bottom: 56, head: 38, eye: [25,42,1.9], mouth: 'M11.5 45.8L23 47L34 45.3 M15 49.3Q25 51.5 33 48.1',
    tail: 'M130 42 C143 34 153 38 154 46 C154 56 142 60 130 51Z',
    dorsal: [[[40,37],[45,29],[50,27],[56,30],[62,38]], [[67,39],[72,30],[82,29],[92,30],[104,31],[117,33],[128,37],[137,44]]],
    ventral: [[[29,53],[30,58],[35,61],[39,59],[36,54]], [[60,56],[65,63],[82,64],[108,58],[136,49]]],
    pectoral: [[37,48],[39,54],[46,58],[52,56],[54,51]], scale: 0,
    barbels: 'M22 52 Q21 58 25 63',
    heightScale: [.32, .38],
    back: '#454b32', side: '#a69f6c', belly: '#d8d1a0', fin: '#9c9565', lower: '#a1966a', iris: '#b5ae77'
  },
  12: {
    body: 'M13 45 Q23 36 39 33 C62 27 87 32 105 38 Q120 44 132 43 L134 49 Q117 51 103 55 C78 63 48 59 29 53 Q17 51 13 45Z',
    top: 31, bottom: 60, head: 41, eye: [27,41,2.4], mouth: 'M13.6 45.3L22 46.8L35 44.9 M18 49Q26 50.7 34 47.6',
    tail: 'M129 43 Q141 35 150 32 Q147 40 141 46 Q147 54 150 62 Q138 58 129 50Z',
    dorsal: [[[61,31],[65,21],[70,15],[78,16],[85,24],[91,34]]],
    adipose: [[114,40],[118,35],[123,34],[127,38],[128,43]],
    ventral: [[[65,60],[69,67],[75,72],[82,67],[78,58]], [[103,54],[110,62],[118,65],[125,57],[121,51]]],
    pectoral: [[40,48],[44,55],[54,60],[65,57],[54,47]], scale: 2.8,
    heightScale: [.31, .41],
    back: '#3e554b', side: '#a9b8aa', belly: '#e3e8db', fin: '#7a9185', lower: '#9b9a88', iris: '#b7af7d'
  }
};
const fishArtCache = new Map();
let fishSvgId = 0;

function fishEllipse(x, y, rx, ry = rx) {
  return `M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${rx*2} 0a${rx} ${ry} 0 1 0 ${-rx*2} 0`;
}
function fishBodySections(path) {
  const points=[];
  let x=0, y=0;
  for (const [,command,values] of path.matchAll(/([MLQCZ])([^MLQCZ]*)/g)) {
    const a=(values.match(/-?\d*\.?\d+/g)||[]).map(Number);
    if (command==='M' || command==='L') {
      [x,y]=a;points.push([x,y]);
    } else if (command==='Z') points.push(points[0]);
    else {
      for (let i=1;i<=32;i++) {
        const t=i/32, u=1-t;
        points.push(command==='Q'
          ? [u*u*x+2*u*t*a[0]+t*t*a[2],u*u*y+2*u*t*a[1]+t*t*a[3]]
          : [u*u*u*x+3*u*u*t*a[0]+3*u*t*t*a[2]+t*t*t*a[4],u*u*u*y+3*u*u*t*a[1]+3*u*t*t*a[3]+t*t*t*a[5]]);
      }
      [x,y]=a.slice(-2);
    }
  }
  return Array.from({length:161},(_,column)=>{
    const hits=[];
    for (let i=1;i<points.length;i++) {
      const a=points[i-1], b=points[i];
      if ((a[0]<=column && b[0]>column)||(b[0]<=column && a[0]>column)) hits.push(a[1]+(column-a[0])*(b[1]-a[1])/(b[0]-a[0]));
    }
    return hits.length>=2 ? [Math.min(...hits),Math.max(...hits)] : null;
  });
}
function fishArtwork(id) {
  if (fishArtCache.has(id)) return fishArtCache.get(id);
  const p = FISH_APPEARANCE[id], layers = [], sections=fishBodySections(p.body), paints={};
  const rgb=color=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
  const back=rgb(p.back), side=rgb(p.side), belly=rgb(p.belly);
  let finId=0;
  const add = (d, fill, stroke = 'none', width = .6, opacity = 1, clip = false) => {
    const precise=path=>path.replace(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi,value=>String(Math.round(Number(value)*1000)/1000));
    layers.push({d:precise(d),fill,stroke,width,opacity,clip:typeof clip==='string'?precise(clip):clip});
  };
  const noise = key => {
    const seed=Math.sin(key*12.9898+id*37.719)*43758.5453;
    return seed-Math.floor(seed);
  };
  const finSpots = (outline, left, top, right, bottom) => {
    if (id!==11 && id!==12) return;
    let spots='';
    const count=Math.ceil((right-left)*(bottom-top)/12);
    for (let i=0;i<count;i++) {
      const x=left+noise(i*3+1)*(right-left), y=top+noise(i*3+2)*(bottom-top);
      const r=id===11?.8+noise(i*3+3)*.9:.35+noise(i*3+3)*.45;
      spots+=fishEllipse(x,y,r,r*(id===11?.7:.9));
    }
    add(spots, '#3e4b35', 'none', 0, .65, outline);
  };
  const fin = (points, fill, {soft = true, fan = false, rays = true} = {}) => {
    let outline='M'+points[0].join(' ');
    for (let i=1;i<points.length-1;i++) {
      const prev=points[i-1], tip=points[i], next=points[i+1];
      outline += soft ? `L${tip[0]+(prev[0]-tip[0])*.24} ${tip[1]+(prev[1]-tip[1])*.24}Q${tip.join(' ')} ${tip[0]+(next[0]-tip[0])*.24} ${tip[1]+(next[1]-tip[1])*.24}` : 'L'+tip.join(' ');
    }
    outline += 'L'+points[points.length-1].join(' ')+'Z';
    const first=points[0], last=points[points.length-1], edge=points.slice(1,-1), name=`membrane-${finId++}`;
    const color=fill==='lower'?p.lower:fill==='fin'?p.fin:fill;
    paints[name]={from:[(first[0]+last[0])/2,(first[1]+last[1])/2],to:[edge.reduce((sum,a)=>sum+a[0],0)/edge.length,edge.reduce((sum,a)=>sum+a[1],0)/edge.length],stops:[[0,color,.95],[.3,color,.75],[.72,color,.38],[1,p.belly,.18]]};
    add(outline,name,'none',0,.85);
    add(outline,'none',p.back,.22,.3);
    if (rays) {
      let ribs='', light='', forks='';
      for (let i=1;i<points.length-1;i++) for (let j=0;j<3;j++) {
        const tip=points[i], next=points[i+1], t=j/3, u=fan?.12+(i+t)/(points.length-1)*.2:(i+t)/(points.length-1);
        const tx=tip[0]+(next[0]-tip[0])*t, ty=tip[1]+(next[1]-tip[1])*t;
        const x=first[0]+(last[0]-first[0])*u, y=first[1]+(last[1]-first[1])*u;
        ribs+=`M${x} ${y}Q${(x+tx)/2-.3} ${(y+ty)/2} ${tx} ${ty}`;
        light+=`M${x+.23} ${y}Q${(x+tx)/2} ${(y+ty)/2} ${tx+.23} ${ty}`;
        forks+=`M${x+(tx-x)*.65} ${y+(ty-y)*.65}Q${tx-.4} ${ty+.5} ${tx+(next[0]-tip[0])*.12} ${ty+(next[1]-tip[1])*.12}`;
      }
      add(ribs,'none',p.back,.25,.38,outline);
      add(light,'none',p.belly,.18,.3,outline);
      add(forks,'none',p.back,.14,.22,outline);
    }
    finSpots(outline, Math.min(...points.map(point=>point[0])), Math.min(...points.map(point=>point[1])), Math.max(...points.map(point=>point[0])), Math.max(...points.map(point=>point[1])));
  };
  paints.tail={from:[128,46],to:[153,46],stops:[[0,p.fin,.92],[.35,p.fin,.7],[.75,p.fin,.32],[1,p.belly,.2]]};
  add(p.tail,'tail','none',0,.9);
  add(p.tail,'none',p.back,.22,.35);
  let tailRays='', tailLight='', tailForks='';
  for (let i=0;i<24;i++) {
    const t=i/23, y=24+t*47, x=id===10?151:150-Math.sin(t*Math.PI)*7;
    const sy=43+t*6;
    tailRays+=`M129 ${sy}Q138 ${36+t*22} ${x} ${y}`;
    tailLight+=`M129 ${sy+.22}Q138 ${36.22+t*22} ${x} ${y+.22}`;
    tailForks+=`M142 ${39+t*15}Q147 ${y+1} ${x+1.8} ${y+1.4}`;
  }
  add(tailRays,'none',p.back,.25,.45,p.tail);
  add(tailLight,'none',p.belly,.18,.3,p.tail);
  add(tailForks,'none',p.back,.14,.22,p.tail);
  finSpots(p.tail,133,28,153,64);
  p.dorsal.forEach(points => fin(points, 'fin', {soft: points.length<8}));
  p.ventral.forEach(points => fin(points, 'lower'));
  if (p.adipose) fin(p.adipose, 'fin', {rays: false});
  if (id===7 || id===10) {
    const count=id===10?7:5;
    for (let i=0;i<count;i++) {
      const u=i/(count-1), x=110+u*21, upper=39+u*5, lower=55-u*5;
      fin([[x,upper],[x+1.2,upper-2.5],[x+3,upper+.7]], id===10?'#b9aa61':'fin', {rays: false});
      fin([[x,lower],[x+1.5,lower+2.4],[x+3,lower-.7]], id===10?'#b9aa61':'lower', {rays: false});
    }
  }
  add(p.body, 'body');
  for (let x=0;x<158;x+=2) {
    const left=sections[x], right=sections[x+2];
    if (!left || !right) continue;
    const before=sections[Math.max(0,x-2)]||left, after=sections[x+4]||right;
    const slope=((after[1]-after[0])-(before[1]-before[0]))/8, name=`skin-${x}`, stops=[];
    for (let row=0;row<=32;row++) {
      const t=row/32, v=t*2-1, z=Math.sqrt(1-v*v), nx=-slope*z*.55, length=Math.hypot(nx,v,z);
      const diffuse=Math.max(0,(-nx*.22-v*.5+z*.84)/length);
      const specular=Math.pow(Math.max(0,(-nx*.12-v*.27+z*.955)/length),42)*.23;
      const mix=t<.4?Math.sin(t/.4*Math.PI/2):1, silver=Math.max(0,(t-.55)/.45);
      const color='#'+side.map((channel,i)=>{
        const pigment=(back[i]+(channel-back[i])*mix)*(1-silver)+belly[i]*silver;
        const reflection=(i===2?16:11)*Math.max(0,v);
        const value=pigment*(.42+.58*diffuse)+specular*(255-pigment*.3)+reflection;
        return Math.max(0,Math.min(255,Math.round(value))).toString(16).padStart(2,'0');
      }).join('');
      stops.push([t,color]);
    }
    paints[name]={from:[x,(left[0]+right[0])/2],to:[x,(left[1]+right[1])/2],stops};
    add(`M${x-.5} 0h3v88h-3Z`,name,'none',0,1,true);
  }
  add(p.body,'none',p.back,.22,.35);
  if (id===3) {
    let bars='';
    for (let i=0;i<6;i++) {
      const x=43+i*13+noise(i+700)*2, end=60-i*1.5-noise(i+750)*3;
      bars+=`M${x-3} 23Q${x+5} 31 ${x+2.5} 41L${x+1.5} ${end}L${x} ${end-2}Q${x-1.8} 49 ${x-3} 43Q${x-4.8} 35 ${x-3} 23Z`;
    }
    paints.bars={from:[0,23],to:[0,64],stops:[[0,'#30412f',.9],[.4,'#30412f',.65],[.78,'#30412f',.35],[1,'#30412f',.08]]};
    add(bars,'bars','none',0,.85,true);
  }
  if (id===7) {
    let waves = '';
    for (let i=0;i<13;i++) {
      const x=41+i*6.5+noise(i)*2, y=38.5+noise(i+40)*3.5, bend=2.5+noise(i+80)*3;
      waves += `M${x} 27C${x-bend} 31 ${x+bend*.7} 32 ${x-.5} 35Q${x-bend*.7} 38 ${x+1} ${y}`;
      if (i%3===1) waves += `M${x-2} 31Q${x-5} 32 ${x-4} 35`;
    }
    add(waves, 'none', '#214c4a', 1.45, .76, true);
  }
  if (id===4 || id===8 || id===11 || id===12) {
    const spots=['','',''], start=p.head+2, count=id===12?160:id===11?48:id===4?120:110;
    for (let i=0;i<count;i++) {
      const px=start+noise(i*5+1)*(132-start), section=sections[Math.round(px)];
      if (!section) continue;
      const t=.12+noise(i*5+2)*.78, y=section[0]+t*(section[1]-section[0]);
      const size=noise(i*5+3), r=id===12?.25+size*.7:id===11?1.1+size*3.1:id===4?.3+size*.8:.35+size*1.3;
      const ry=id===4?(.8+size*1.7)*(1-Math.abs(t-.5)*.4):r*(id===11?.55+noise(i*5+4)*.6:.7);
      const group=Math.floor(noise(i*5+5)*3);
      spots[group]+=`M${px-r} ${y}Q${px-r*.7} ${y-ry} ${px+r*.3} ${y-ry*.8}Q${px+r*1.1} ${y-ry*.25} ${px+r} ${y+ry*.4}Q${px+r*.2} ${y+ry} ${px-r*.5} ${y+ry*.7}Q${px-r*.9} ${y+ry*.2} ${px-r} ${y}Z`;
    }
    const colors=id===4?['#d8d9aa','#b8c294','#e4d9b1']:id===12?['#35483c','#243b35','#506657']:id===11?['#414b30','#545236','#333d2c']:['#63734e','#78815e','#526442'];
    spots.forEach((path,i)=>add(path,colors[i],'none',0,id===12?.65:id===4?.33+i*.04:.38+i*.06,true));
  }
  if (id===12) {
    paints.flush={center:[78,46],radius:57,stretch:.08,stops:[[0,'#d592a3',.4],[.6,'#bc8394',.25],[1,'#bba8aa',0]]};
    add(p.body,'flush','none',0,1,true);
  }
  if (p.scale) {
    const rows=Math.ceil((p.bottom-p.top)/(p.scale*.68)), groups=Array.from({length:5},()=>({faces:'',rims:'',light:'',grooves:''}));
    for (let row=0;row<rows;row++) {
      const v=(row/(rows-1)-.5)*2, bend=Math.sin(v*Math.PI/2), bucket=Math.min(4,Math.floor((1-Math.abs(v))*5));
      for (let x=p.head+2+row%2*p.scale*.42;x<130;) {
        const section=sections[Math.round(x)];
        if (!section) break;
        const u=(x-p.head)/(131-p.head), sx=p.scale*(1-u*.45)*(1-Math.abs(v)*.2);
        const sy=(section[1]-section[0])/rows*.62*Math.max(.22,Math.cos(v*Math.PI/2));
        const cy=(section[0]+section[1])/2+bend*(section[1]-section[0])*.46+(noise(row*43+x)-.5)*sy*.18;
        const group=groups[bucket];
        group.faces+=`M${x-sx*.5} ${cy-sy}Q${x+sx*.24} ${cy-sy*1.2} ${x+sx*.55} ${cy}Q${x+sx*.22} ${cy+sy*1.15} ${x-sx*.5} ${cy+sy}Z`;
        group.rims+=`M${x-sx*.28} ${cy-sy}Q${x+sx*.38} ${cy-sy*.8} ${x+sx*.52} ${cy}Q${x+sx*.3} ${cy+sy*.9} ${x-sx*.35} ${cy+sy}`;
        group.light+=`M${x-sx*.25} ${cy-sy+.13}Q${x+sx*.28} ${cy-sy*.7} ${x+sx*.39} ${cy-.1}`;
        group.grooves+=`M${x+sx*.11} ${cy}l${-sx*.28} ${sy*.7}M${x+sx*.18} ${cy}l${-sx*.25} ${sy*.3}`;
        x+=sx*.79;
      }
    }
    groups.forEach((group,i)=>{
      add(group.faces,p.belly,'none',0,.014+i*.005,true);
      add(group.rims,'none',p.back,.24,id===2?.19:.11,true);
      add(group.light,'none','#fff9e8',.2,.06+i*.045,true);
      add(group.grooves,'none',p.back,.1,.07,true);
    });
  }
  let grain='', wet='', pores='';
  for (let i=0;i<1100;i++) {
    const x=16+noise(i*5+1)*115, section=sections[Math.round(x)];
    if (!section) continue;
    const t=noise(i*5+2), y=section[0]+t*(section[1]-section[0]), size=.07+noise(i*5+3)*.14;
    grain+=fishEllipse(x,y,size,size*.65);
    if (t>.2 && t<.6 && noise(i*5+4)>.65) wet+=`M${x} ${y}l${.2+noise(i*5+5)*.4} -.08`;
    if (x<p.head) pores+=fishEllipse(x,y,.13,.08);
  }
  add(grain,p.back,'none',0,.18,true);
  add(pores,p.belly,'none',0,.16,true);
  add(wet,'none','#f5faed',.15,.35,true);
  add(p.body,'shade','none',0,.36,true);
  add(p.body,'sheen','none',0,.6,true);
  add(`M${p.head+3} ${p.top+4}C70 ${p.top-1} 104 ${p.top+5} 129 44`, 'none', '#f3f6df', .45, .3, true);
  const middle=(p.top+p.bottom)/2;
  add(`M${p.head+3} ${middle}C70 ${middle-3} 105 ${middle+2} 130 46`, 'none', id===8?'#e9e5c8':p.back, id===8?.65:.3, id===8?.65:.23, true);
  add(p.body, 'head', 'none', 0, 1, true);
  add(p.body, 'cheek', 'none', 0, 1, true);
  add(`M${p.head-1} ${p.top+7}C${p.head+7} ${middle-5} ${p.head+6} ${middle+7} ${p.head-2} ${p.bottom-5}`, 'none', p.back, .65, .65, true);
  add(`M${p.head+.2} ${p.top+8}C${p.head+7.5} ${middle-4} ${p.head+6.5} ${middle+7} ${p.head-.5} ${p.bottom-6}`, 'none', p.belly, .45, .65, true);
  add(`M${p.head-12} ${middle+4}Q${p.head-8} ${middle+9} ${p.head-3} ${p.bottom-5}`, 'none', p.belly, .35, .35, true);
  add(fishEllipse(p.pectoral[0][0]+3,p.pectoral[0][1]+1,6,2),p.back,'none',0,.18,true);
  fin(p.pectoral,'lower',{fan:true});
  add(p.mouth, 'none', p.back, .55, .88, true);
  if (p.barbels) add(p.barbels, 'none', p.side, .7, 1);
  const [ex,ey,er]=p.eye;
  if (id===4 || id===12) {
    let cheek='';
    for (let i=0;i<6;i++) cheek+=fishEllipse(ex+5+i*2.3,ey+3+Math.sin(i*1.7)*2,id===4?.65:.4,id===4?.4:.3);
    add(cheek, id===4?'#d9d4ab':'#38463a', 'none', 0, .48, true);
  }
  add(fishEllipse(ex-6,ey-1.1,.55,.35), p.back, 'none', 0, .62, true);
  add(fishEllipse(ex,ey,er+.7), p.back, 'none', 0, .25, true);
  add(fishEllipse(ex,ey,er), 'iris', p.back, .35);
  let irisThreads='';
  for(let i=0;i<28;i++){
    const a=i/28*Math.PI*2, r=er*(.58+noise(i+990)*.12);
    irisThreads+=`M${ex+Math.cos(a)*r} ${ey+Math.sin(a)*r}L${ex+Math.cos(a+.025)*er*.94} ${ey+Math.sin(a+.025)*er*.94}`;
  }
  add(irisThreads,'none',p.back,.1,.3,fishEllipse(ex,ey,er));
  add(fishEllipse(ex,ey,er*.57),'#101b18');
  add(`M${ex-er} ${ey}Q${ex} ${ey-er*1.3} ${ex+er} ${ey}`, 'none', p.back, .4, .65);
  add(fishEllipse(ex-er*.24,ey-er*.3,er*.18), '#f9fff1', 'none', 0, .95);
  add(fishEllipse(ex+er*.33,ey+er*.4,er*.1), p.belly, 'none', 0, .5);
  const art = {profile:p, layers, paints};
  fishArtCache.set(id,art);
  return art;
}

function fishPaints(p) {
  const [ex,ey,er]=p.eye;
  return {
    body: {from:[0,p.top],to:[0,p.bottom],stops:[[0,p.back],[.38,p.side],[.68,p.side],[1,p.belly]]},
    shade: {from:[0,p.top],to:[0,p.bottom],stops:[[0,p.back,.12],[.25,p.back,0],[.65,p.back,0],[.82,p.back,.15],[1,p.back,.62]]},
    fin: {from:[0,12],to:[0,64],stops:[[0,p.fin,.38],[.55,p.fin,.82],[1,p.belly,.45]]},
    lower: {from:[0,46],to:[0,78],stops:[[0,p.lower,.85],[1,p.lower,.35]]},
    head: {center:[p.head-8,p.top+(p.bottom-p.top)*.38],radius:18,stretch:.65,stops:[[0,p.belly,.55],[.5,p.side,.16],[1,p.side,0]]},
    cheek: {center:[p.head-4,p.top+(p.bottom-p.top)*.65],radius:14,stretch:.55,stops:[[0,p.back,.25],[.6,p.back,.1],[1,p.back,0]]},
    sheen: {center:[66,p.top+(p.bottom-p.top)*.43],radius:45,stretch:.28,stops:[[0,'#f6f9e9',.36],[.65,'#f6f9e9',.13],[1,'#f6f9e9',0]]},
    iris: {center:[ex-er*.3,ey-er*.3],radius:er*1.6,stops:[[0,p.belly],[.5,p.iris],[1,p.back]]}
  };
}

function fishSvg(f) {
  const art=fishArtwork(f.id), p=art.profile, id=`fish-${++fishSvgId}`, palette={...fishPaints(p),...art.paints};
  const paint=value => palette[value] ? `url(#${id}-${value})` : value;
  const gradients=Object.entries(palette).map(([name,value])=>{
    const stops=value.stops.map(([offset,color,opacity=1])=>`<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`).join('');
    if (value.center) {
      const [cx,cy]=value.center, transform=value.stretch?` gradientTransform="translate(${cx} ${cy}) scale(1 ${value.stretch}) translate(${-cx} ${-cy})"`:'';
      return `<radialGradient id="${id}-${name}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${value.radius}"${transform}>${stops}</radialGradient>`;
    }
    return `<linearGradient id="${id}-${name}" gradientUnits="userSpaceOnUse" x1="${value.from[0]}" y1="${value.from[1]}" x2="${value.to[0]}" y2="${value.to[1]}">${stops}</linearGradient>`;
  }).join('');
  const defs=gradients+`<clipPath id="${id}-clip"><path d="${p.body}"/></clipPath>`;
  const finClips=art.layers.map((layer,i)=>typeof layer.clip==='string'?`<clipPath id="${id}-fin-${i}"><path d="${layer.clip}"/></clipPath>`:'').join('');
  const paths=art.layers.map((layer,i)=>`<path d="${layer.d}" fill="${paint(layer.fill)}" stroke="${paint(layer.stroke)}" stroke-width="${layer.width}" fill-opacity="${layer.opacity}" stroke-opacity="${layer.opacity}"${layer.clip?` clip-path="url(#${id}-${layer.clip===true?'clip':'fin-'+i})"`:''}/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 88" aria-hidden="true" focusable="false"><defs>${defs}${finClips}</defs><g stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

function paintFishArtwork(gc, id) {
  const art=fishArtwork(id), p=art.profile;
  if (!art.paths) {
    art.paths=art.layers.map(layer=>new Path2D(layer.d));
    art.clips=art.layers.map(layer=>layer.clip?new Path2D(layer.clip===true?p.body:layer.clip):null);
  }
  const paints={...fishPaints(p),...art.paints}, palette={};
  Object.entries(paints).forEach(([name,value])=>{
    let gradient;
    if (value.center) {
      const [cx,cy]=value.center;
      gradient=gc.createRadialGradient(cx,cy,0,cx,cy,value.radius);
    } else gradient=gc.createLinearGradient(...value.from,...value.to);
    value.stops.forEach(([offset,color,opacity=1])=>gradient.addColorStop(offset,opacity===1?color:color+Math.round(opacity*255).toString(16).padStart(2,'0')));
    palette[name]=gradient;
  });
  gc.save();gc.lineCap='round';gc.lineJoin='round';
  art.layers.forEach((layer,i)=>{
    gc.save();gc.globalAlpha*=layer.opacity;
    if (layer.clip) gc.clip(art.clips[i]);
    if (layer.fill!=='none') {
      gc.fillStyle=palette[layer.fill] || layer.fill;
      const paint=paints[layer.fill];
      if (paint?.stretch) {
        const [cx,cy]=paint.center;
        gc.clip(art.paths[i]);gc.translate(cx,cy);gc.scale(1,paint.stretch);gc.translate(-cx,-cy);
        gc.fillRect(0,-200,160,600);
      } else gc.fill(art.paths[i]);
    }
    if (layer.stroke!=='none') {gc.strokeStyle=palette[layer.stroke] || layer.stroke;gc.lineWidth=layer.width;gc.stroke(art.paths[i]);}
    gc.restore();
  });
  gc.restore();
}
