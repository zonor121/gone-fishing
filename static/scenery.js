// Детерминированные детали окружения: пейзаж кэшируется, рябь рисуется отдельно.
const landscape = document.createElement('canvas');
landscape.width = 1600; landscape.height = 840;
const scenery = landscape.getContext('2d');
let landscapeKey = '', landscapeLighting = '';
const noise = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
function shape(c, points, color) {
  c.fillStyle = color; c.beginPath(); points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath(); c.fill();
}
function tree(c, x, y, h, color, pine) {
  c.strokeStyle = '#485044'; c.lineWidth = Math.max(.5, h / 35);
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
function paintSky(c, horizon) {
  let sky=c.createLinearGradient(0,0,0,horizon);
  sky.addColorStop(0,'#7196ad');sky.addColorStop(.6,'#b4c8ca');sky.addColorStop(1,'#e3e2ce');
  c.fillStyle=sky;c.fillRect(0,0,800,horizon+1);
  const part=typeof currentDayPart==='function'?currentDayPart():'day';
  const wx=typeof currentWeather==='function'?currentWeather():'clear';
  c.save();c.globalAlpha=part==='night'?0:(wx==='rain'||wx==='fog'?.12:1);
  const halo=c.createRadialGradient(572,57,3,572,57,125);
  halo.addColorStop(0,'rgba(255,246,213,.9)');halo.addColorStop(.18,'rgba(255,242,208,.3)');halo.addColorStop(1,'rgba(255,242,208,0)');
  c.fillStyle=halo;c.fillRect(440,0,260,190);
  c.fillStyle='#fff6da';c.beginPath();c.arc(572,57,9,0,7);c.fill();c.restore();
  // Полупрозрачные группы облаков с затенённой нижней кромкой.
  for(let band=0;band<8;band++) {
    const x=noise(band+55)*900-50,y=18+noise(band+21)*horizon*.55;
    for(let j=0;j<18;j++) {
      const px=x+(j-9)*9, py=y+Math.sin(j*.5)*3, r=8+noise(j+band*21)*15;
      c.fillStyle='rgba(233,235,221,.065)';c.beginPath();c.ellipse(px,py,r*2,r*.3,0,0,7);c.fill();
    }
  }
}
const reflectedBank = document.createElement('canvas');
reflectedBank.width=1600;reflectedBank.height=840;
function paintLandscape(l) {
  const c=scenery;c.setTransform(2,0,0,2,0,0);
  c.clearRect(0,0,800,420);
  if(l.code==='sea'){paintSea(c);return;}
  paintSky(c,190);
  for(let layer=0;layer<4;layer++) {
    const base=150+layer*10, pts=[[0,200],[0,base]];
    const ridge=x=>base-9*Math.sin(x*.009+layer)-7*Math.sin(x*.019+layer*2);
    for(let x=0;x<=820;x+=8)pts.push([x,ridge(x)]);
    pts.push([800,200]);shape(c,pts,['#a2b3ac','#899e92','#667e6c','#465e49'][layer]);
    for(let i=0;i<130;i++) {
      const x=i*6.4+noise(i)*5,h=10+noise(i+layer*99)*(layer*7+16);
      tree(c,x,ridge(x)+4,h,['#9bac9f','#829883','#5f795f','#425b43'][layer],l.forest || noise(i+6)>.68);
    }
  }
  // Береговая кромка и отражение берега используют одну геометрию.
  shape(c,[[0,182],[130,180],[310,184],[470,181],[640,179],[800,184],[800,191],[0,191]],'#6e7255');
  c.strokeStyle='rgba(207,206,163,.6)';c.lineWidth=.7;c.beginPath();c.moveTo(0,187);c.bezierCurveTo(240,181,550,190,800,185);c.stroke();
  const r=reflectedBank.getContext('2d');r.clearRect(0,0,1600,840);r.drawImage(landscape,0,0);
  const water=c.createLinearGradient(0,185,0,420);
  water.addColorStop(0,'#a2b5af');water.addColorStop(.25,l.forest?'#627969':'#77958b');water.addColorStop(.65,l.current?'#426d64':'#3b625b');water.addColorStop(1,'#233f39');
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
  if(l.current) {
    // Речной мыс сужает дальний плёс, но не перекрывает зону заброса.
    shape(c,[[800,184],[699,191],[633,204],[681,210],[749,224],[800,241]],'#555d43');
    c.strokeStyle='rgba(190,194,151,.5)';c.lineWidth=1;c.beginPath();c.moveTo(800,242);c.quadraticCurveTo(706,210,633,204);c.stroke();
    for(let i=0;i<170;i++){const x=689+noise(i+36)*111,y=192+noise(i+77)*13;c.strokeStyle=i%2?'#727b50':'#3f563b';c.beginPath();c.moveTo(x,y);c.lineTo(x-2,y-3-noise(i)*8);c.stroke();}
  }
  if(l.forest) {
    for(let i=0;i<24;i++) {
      const x=20+noise(i+63)*140,y=266+noise(i+43)*83,r=3+(y-260)*.07;
      c.fillStyle='rgba(17,38,30,.3)';c.beginPath();c.ellipse(x+2,y+2,r*1.3,r*.35,0,0,7);c.fill();
      c.fillStyle=i%2?'#5e7248':'#788257';c.beginPath();c.ellipse(x,y,r,r*.4,-.12,.2,6);c.lineTo(x,y);c.fill();
      c.strokeStyle='rgba(188,192,131,.4)';c.lineWidth=.5;c.beginPath();c.moveTo(x,y);c.lineTo(x-r*.7,y);c.stroke();
    }
  }
  // Ближний берег остаётся по краям, оставляя центр открытым для ловли.
  shape(c,[[0,290],[24,308],[49,349],[82,420],[0,420]],'#303f2d');
  for(let i=0;i<90;i++) {
    const x=noise(i+71)*42,y=335+noise(i+81)*85,r=2+noise(i+91)*7;
    const stone=c.createLinearGradient(x,y-r,x,y+r);stone.addColorStop(0,'#8a8b71');stone.addColorStop(1,'#3d493c');
    c.fillStyle=stone;c.beginPath();c.ellipse(x,y,r,r*.55,-.4,0,7);c.fill();
  }
}
function drawWaterSurface(time, sea=false, current=false) {
  const weather=typeof currentWeather==='function'?currentWeather():'clear';
  const rough=weather==='wind'?1.8:weather==='rain'?1.3:1;
  for(let i=0;i<190;i++) {
    const z=noise(i+300),y=189+z*z*231,span=2+z*z*(sea?95:47);
    const speed=(current?10:sea?5:2)*(1+z)*rough;
    const x=(noise(i+800)*940+time*speed)%940-70;
    const wave=Math.sin(time*(1+z)+i)*z*rough;
    g.strokeStyle=`rgba(202,221,211,${.025+z*.1})`;g.lineWidth=.35+z*.65;
    g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x+span*.3,y-wave,x+span*.65,y+wave,x+span,y);g.stroke();
    if(i%3===0){g.strokeStyle=`rgba(17,40,34,${z*.12})`;g.beginPath();g.moveTo(x,y+1.4);g.lineTo(x+span*.7,y+1.4);g.stroke();}
  }
  // Дрожащая дорожка света: с расстоянием штрихи становятся мельче.
  const part=typeof currentDayPart==='function'?currentDayPart():'day';
  const lit=part!=='night'&&weather!=='rain'&&weather!=='fog';
  for(let i=0;i<(lit?95:0);i++) {
    const z=noise(i+1400),y=190+z*z*230;
    const x=572+(noise(i+1500)-.5)*(16+z*z*190)+Math.sin(time*1.2+i)*z*5;
    g.fillStyle=`rgba(255,237,188,${(.05+noise(i+42)*.25)*( .65+Math.sin(time*2+i)*.35)})`;
    g.fillRect(x,y,1+z*z*22,.5+z*.5);
  }
}
function drawEnvironment(l, time) {
  const lighting=currentDayPart()+':'+currentWeather();
  if(landscapeKey!==sl.value||landscapeLighting!==lighting){paintLandscape(l);landscapeKey=sl.value;landscapeLighting=lighting;}
  g.drawImage(landscape,0,0,800,420);
  drawWaterSurface(time,false,l.current);
  const wind=typeof currentWeather==='function'&&currentWeather()==='wind'?2.5:1;
  for(let i=0;i<65;i++) {
    const x=noise(i+100)*73,y=372+noise(i+45)*50,h=25+noise(i+65)*80,sway=Math.sin(time*1.2+i*.7)*2*wind;
    g.strokeStyle=['#334b31','#657249','#889065'][i%3];g.lineWidth=.7+noise(i)*1.1;
    g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x-5,y-h*.5,x+sway,y-h);g.stroke();
    g.beginPath();g.moveTo(x,y-8);g.quadraticCurveTo(x+18,y-h*.6,x+13,y-h*.7);g.stroke();
    if(i%4===0){g.strokeStyle='#5b4934';g.lineWidth=2.5;g.beginPath();g.moveTo(x+sway,y-h);g.lineTo(x+sway,y-h+12);g.stroke();}
  }
  g.strokeStyle='rgba(48,65,62,.6)';g.lineWidth=.8;
  for(let i=0;i<3;i++){const x=260+i*21+Math.sin(time*.08)*15,y=65+i%2*9;g.beginPath();g.moveTo(x-4,y);g.quadraticCurveTo(x-2,y-2,x,y);g.quadraticCurveTo(x+2,y-2,x+5,y-1);g.stroke();}
}
const dockTexture=document.createElement('canvas');dockTexture.width=1600;dockTexture.height=840;
let dockReady=false;
function drawFirstPersonDock() {
  if(!dockReady) {
    const c=dockTexture.getContext('2d');c.scale(2,2);
    shape(c,[[202,367],[598,367],[800,420],[0,420]],'#302c22');
    for(let j=0;j<7;j++) {
      const a=j/7,b=(j+1)/7,y=367+53*a*a,bottom=367+53*b*b,left=202*(1-a*a),right=800-left;
      const wood=c.createLinearGradient(0,y,0,bottom);wood.addColorStop(0,j%2?'#887b60':'#99896a');wood.addColorStop(1,'#665b46');
      c.save();c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.lineTo(800-202*(1-b*b),bottom-1);c.lineTo(202*(1-b*b),bottom-1);c.closePath();c.clip();
      c.fillStyle=wood;c.fillRect(0,y,800,bottom-y);
      for(let k=0;k<95;k++) {
        const x=noise(j*95+k)*800, yy=y+noise(k+j*81)*(bottom-y);
        c.strokeStyle=k%3?'rgba(37,33,24,.19)':'rgba(217,204,159,.17)';c.lineWidth=.3;
        c.beginPath();c.moveTo(x,yy);c.bezierCurveTo(x+15,yy-.6,x+34,yy+.6,x+60+noise(k)*90,yy);c.stroke();
      }
      for(const x of [left+18,right-18,390]) {
        c.fillStyle='#403c32';c.beginPath();c.ellipse(x,(y+bottom)/2,1.2,.6,0,0,7);c.fill();
        c.fillStyle='#b1aa8f';c.fillRect(x-.7,(y+bottom)/2-.5,.8,.4);
      }
      c.restore();
    }
    for(const x of [260,400,540]){c.strokeStyle='rgba(38,31,22,.65)';c.lineWidth=.8;c.beginPath();c.moveTo(x,367);c.lineTo(400+(x-400)*2.1,420);c.stroke();}
    dockReady=true;
  }
  g.drawImage(dockTexture,0,0,800,420);
}

// Только руки и снасть: положение камеры совпадает со взглядом рыбака.
function drawFirstPersonRod(tx, ty, time) {
  const lift = S==='charge' ? pw*30 : S==='fly' ? Math.sin(Math.min(1,cast)*Math.PI)*18 : 0;
  const hx=590, hy=374-lift;
  g.save();g.lineCap='round';
  const sleeve=g.createLinearGradient(580,330,710,430);
  sleeve.addColorStop(0,'#718064');sleeve.addColorStop(.5,'#495d46');sleeve.addColorStop(1,'#283f35');
  shape(g,[[800,420],[673,420],[572,376-lift],[590,344-lift],[695,376]],sleeve);
  g.strokeStyle='#8a9477';g.lineWidth=1.3;g.beginPath();g.moveTo(612,368-lift);g.lineTo(710,410);g.stroke();
  g.save();g.translate(hx,hy);g.rotate(-.55);
  const skin=g.createLinearGradient(-12,-20,15,18);skin.addColorStop(0,'#e1b58a');skin.addColorStop(.6,'#bd8e68');skin.addColorStop(1,'#805940');
  g.fillStyle=skin;g.beginPath();g.roundRect(-17,-23,34,49,12);g.fill();g.restore();
  const rodColor=['#ab8750','#526b62','#384849'][+sr.value] || '#ab8750';
  g.strokeStyle='#252f2b';g.lineWidth=10;g.beginPath();g.moveTo(624,420);g.lineTo(hx,hy);g.stroke();
  g.strokeStyle='#b89b68';g.lineWidth=8;g.beginPath();g.moveTo(615,406);g.lineTo(563,333-lift);g.stroke();
  g.strokeStyle='#312e24';g.lineWidth=1;
  for(let i=0;i<9;i++){g.beginPath();g.moveTo(574+i*3,345-lift+i*4);g.lineTo(581+i*3,342-lift+i*4);g.stroke();}
  const cx=(563+tx)/2-20, cy=(333-lift+ty)/2-(S==='reel'?t*65:12);
  for(const [width,color] of [[5,'#283b33'],[3,rodColor],[.7,'#d0c5a1']]){
    g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.moveTo(563,333-lift);g.quadraticCurveTo(cx,cy,tx,ty);g.stroke();
  }
  g.strokeStyle='#bfc7ba';g.lineWidth=1;
  for(const u of [.25,.5,.75,1]){const x=(1-u)*(1-u)*563+2*(1-u)*u*cx+u*u*tx, y=(1-u)*(1-u)*(333-lift)+2*(1-u)*u*cy+u*u*ty;g.beginPath();g.ellipse(x+3,y+3,3,4,-.5,0,7);g.stroke();}
  // Металлический корпус катушки и тёмная полость шпули.
  const metal=g.createLinearGradient(554,368-lift,587,400-lift);
  metal.addColorStop(0,'#c1c8bd');metal.addColorStop(.25,'#5c716b');metal.addColorStop(.6,'#273d38');metal.addColorStop(.85,'#8b9a8c');metal.addColorStop(1,'#263831');
  g.fillStyle=metal;g.beginPath();g.ellipse(572,385-lift,14,18,-.4,0,7);g.fill();
  g.fillStyle='#1e302c';g.beginPath();g.ellipse(571,381-lift,8,10,-.4,0,7);g.fill();
  g.strokeStyle='#b9bda7';g.lineWidth=.6;
  for(let i=0;i<7;i++){g.beginPath();g.ellipse(570,378-lift+i,7,4,-.4,0,7);g.stroke();}
  g.strokeStyle='#b6b9a2';g.lineWidth=3;g.beginPath();g.ellipse(572,382-lift,10,12,-.4,0,7);g.stroke();
  const crank=S==='reel'&&hold ? time*13 : 1;
  const kx=550+Math.cos(crank)*10, ky=389-lift+Math.sin(crank)*9;
  g.strokeStyle='#a3ab95';g.lineWidth=3;g.beginPath();g.moveTo(571,389-lift);g.lineTo(kx,ky);g.stroke();
  g.fillStyle='#252e29';g.beginPath();g.ellipse(kx,ky,5,3,-.5,0,7);g.fill();
  // Пальцы обхватывают рукоять, не перекрывая вершинку.
  g.strokeStyle='#d5a67d';g.lineWidth=6;
  for(let i=0;i<3;i++){g.beginPath();g.moveTo(578+i*4,360-lift+i*6);g.quadraticCurveTo(594+i*3,360-lift+i*6,592+i*3,367-lift+i*6);g.stroke();}
  if(S==='reel'){
    shape(g,[[331,420],[421,420],[548,394-lift],[544,374-lift],[499,380-lift]],sleeve);
    g.fillStyle='#c69b75';g.beginPath();g.ellipse(kx-7,ky+2,17,10,-.3,0,7);g.fill();
  }
  g.restore();
}
