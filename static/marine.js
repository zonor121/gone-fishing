// Море и лодка используют ту же перспективу и освещение, что и пресные водоёмы.
function paintSea(c, P = getPalette()) {
  paintSky(c,183,false,P);
  // Левый дальний многоплановый мыс в дымке.
  shape(c,[[0,183],[0,174],[18,167],[38,171],[60,165],[86,174],[114,183]],mix(P.ridges[0],'#8a9fa4',.42));
  shape(c,[[0,183],[0,178],[26,173],[52,177],[78,183]],mix(P.ridges[1],'#72888e',.32));
  // Правый скалистый мыс: дальняя гряда + освещённые и теневые грани скал + полоска прибоя.
  shape(c,[[800,183],[800,159],[770,162],[742,167],[704,174],[674,183]],mix(P.ridges[0],'#85989c',.35));
  shape(c,[[800,183],[800,164],[772,166],[740,170],[712,177],[684,183]],mix(P.ridges[1],'#6a7b7e',.35));
  shape(c,[[772,166],[758,173],[744,183],[712,177],[740,170]],mix(P.ridges[2],'#56676b',.35));
  c.fillStyle=rgba(P.haze,.26);c.fillRect(674,178,126,5);
  c.strokeStyle=rgba(mix(P.waveLight,'#ffffff',.45),.35);c.lineWidth=.8;
  c.beginPath();c.moveTo(682,182.5);c.lineTo(800,182.5);c.stroke();

  // Силуэт далёкого маяка на правом мысу.
  const lx=758, ly=167.5;
  shape(c,[[lx-1.6,ly],[lx-1,ly-8.5],[lx+1,ly-8.5],[lx+1.6,ly]],mix('#d8d6c8',P.haze,P.night>.5?.65:.25));
  c.fillStyle=mix('#495758',P.haze,.3);c.fillRect(lx-1.3,ly-10,2.6,1.8);
  shape(c,[[lx-1.6,ly-10],[lx,ly-11.6],[lx+1.6,ly-10]],mix('#8c3c32',P.haze,P.night>.5?.55:.25));
  if(P.night>.25) {
    const lg=c.createRadialGradient(lx,ly-9.2,.4,lx,ly-9.2,9);
    lg.addColorStop(0,`rgba(255,228,150,${.85*P.night})`);
    lg.addColorStop(.35,`rgba(255,215,120,${.25*P.night})`);
    lg.addColorStop(1,'rgba(255,215,120,0)');
    c.fillStyle=lg;c.beginPath();c.arc(lx,ly-9.2,9,0,7);c.fill();
  }

  const water=c.createLinearGradient(0,183,0,420);
  water.addColorStop(0,P.seaWater[0]);water.addColorStop(.12,P.seaWater[1]);water.addColorStop(.5,P.seaWater[2]);water.addColorStop(1,P.seaWater[3]);
  c.fillStyle=water;c.fillRect(0,183,800,237);
  for(let i=0;i<1600;i++){
    const z=noise(i+22),y=184+z*z*236,x=noise(i+741)*840-20;
    c.fillStyle=i%3?'rgba(17,48,62,.08)':'rgba(194,214,207,.12)';c.fillRect(x,y,2+z*noise(i+2)*55,.3+z);
  }
  c.fillStyle=rgba(P.haze,.3);c.fillRect(0,183,800,.7);
  if(P.mist>0){
    const m=c.createLinearGradient(0,183,0,240);
    m.addColorStop(0,rgba(P.haze,P.mist));m.addColorStop(1,rgba(P.haze,0));
    c.fillStyle=m;c.fillRect(0,183,800,57);
  }
}
function drawSea(time) {
  const P=getPalette();
  drawLandscape({code:'sea'},P);
  if(typeof drawCelestial==='function') drawCelestial(183,false,P);
  if(typeof drawDynamicSky==='function') drawDynamicSky(time,183,P,true);
  drawWaterSurface(time,true);
  if(typeof drawAtmosphere==='function') drawAtmosphere({code:'sea'},time,P);
  if(P.night>0.3&&P.wx!=='rain') {
    const pulse=.35+.65*(.5+.5*Math.sin(time*2.1));
    const lg=g.createRadialGradient(758,158.3,.4,758,158.3,12);
    lg.addColorStop(0,`rgba(255,235,165,${.75*P.night*pulse})`);
    lg.addColorStop(1,'rgba(255,215,120,0)');
    g.fillStyle=lg;g.beginPath();g.arc(758,158.3,12,0,7);g.fill();
  }
  if(P.night<1&&P.wx!=='rain') {
    g.save();
    const gullCol=rgba('#3d5258',.85*(1-P.night));
    const wingTip=rgba('#223238',.9*(1-P.night));
    for(let i=0;i<5;i++){
      const sc=.68+(i%3)*.22;
      const x=(((105+i*122+time*(3.5+i*.4))%860)+860)%860-30;
      const y=54+(i%3)*13+Math.sin(time*.9+i)*3;
      const flap=Math.sin(time*4.5+i*1.9)*3*sc;
      g.strokeStyle=gullCol;g.lineWidth=1.1*sc;
      g.beginPath();
      g.moveTo(x-5.5*sc,y-flap);g.quadraticCurveTo(x-2.4*sc,y-3.4*sc,x,y);
      g.quadraticCurveTo(x+2.4*sc,y-3.4*sc,x+5.5*sc,y-flap);
      g.stroke();
      g.strokeStyle=wingTip;g.lineWidth=.9*sc;
      g.beginPath();
      g.moveTo(x-5.5*sc,y-flap);g.lineTo(x-4.2*sc,y-flap-.6*sc);
      g.moveTo(x+5.5*sc,y-flap);g.lineTo(x+4.2*sc,y-flap-.6*sc);
      g.stroke();
    }
    g.restore();
  }
}
function drawBoat(time) {
  const P=getPalette(), dim=P.foregroundDim;
  const D=c=>mix(c,'#141c26',dim);
  const tilt=Math.sin(time*.85)*.012,bob=Math.sin(time*1.3)*2.5;
  g.translate(400,390+bob);g.rotate(tilt);g.translate(-400,-390);
  // ПЕРВЫЙ градиент функции (проверяется test_hands_and_boat_dim_gradually).
  let material=g.createLinearGradient(0,310,0,420);material.addColorStop(0,D('#d7d9c9'));material.addColorStop(.5,D('#919f98'));material.addColorStop(1,D('#536d6e'));

  // Контактная тень на воде и живая пена у левой и правой скулы корпуса (ниже y=310).
  shape(g,[[400,311],[636,371],[782,420],[18,420],[164,371]],'rgba(6,18,24,.34)');
  g.save();
  const foamCol=rgba(mix(P.waveLight,'#ffffff',.45),.38*(1-dim*.4));
  g.strokeStyle=foamCol;g.lineCap='round';
  for(let i=0;i<4;i++){
    const wave=Math.sin(time*2.2+i*1.4)*1.6;
    const lx0=400-35-i*85, ly0=320+i*24, lx1=lx0-65, ly1=ly0+18;
    const rx0=400+35+i*85, ry0=320+i*24, rx1=rx0+65, ry1=ry0+18;
    g.lineWidth=1.8-i*.2;
    g.beginPath();g.moveTo(lx0,ly0+wave);g.quadraticCurveTo((lx0+lx1)/2-3,(ly0+ly1)/2-2+wave,lx1,ly1+wave);g.stroke();
    g.beginPath();g.moveTo(rx0,ry0-wave);g.quadraticCurveTo((rx0+rx1)/2+3,(ry0+ry1)/2-2-wave,rx1,ry1-wave);g.stroke();
  }
  g.restore();

  // Внешний корпус и внутренний кокпит.
  shape(g,[[400,310],[625,369],[765,420],[35,420],[175,369]],material);
  material=g.createLinearGradient(0,326,0,420);material.addColorStop(0,D('#233f47'));material.addColorStop(.4,D('#4c6565'));material.addColorStop(1,D('#7f8f82'));
  shape(g,[[400,326],[598,378],[690,420],[110,420],[202,378]],material);
  // Внутренние стенки бортов с объёмным переходом к дну.
  shape(g,[[400,326],[202,378],[110,420],[151,420],[232,382],[400,342],[568,382],[650,420],[690,420],[598,378]],D('#2c464a'));

  // Деревянные слани (продольные планки настила на дне лодки).
  for(let i=-3;i<=3;i++){
    const xTop=400+i*22, xBot=400+i*48;
    g.strokeStyle=D(i%2?'#5b6c61':'#69796d');g.lineWidth=12;
    g.beginPath();g.moveTo(xTop,355);g.lineTo(xBot,420);g.stroke();
    g.strokeStyle='rgba(14,26,28,.35)';g.lineWidth=1.2;
    g.beginPath();g.moveTo(xTop+6,355);g.lineTo(xBot+8,420);g.stroke();
  }
  // Объёмные шпангоуты (рёбра жёсткости по внутренним бортам).
  for(let i=0;i<5;i++){
    const y0=344+i*12, xl=226-i*16, xr=574+i*16, yb=384+i*9;
    g.strokeStyle='rgba(12,24,26,.45)';g.lineWidth=3.4;
    g.beginPath();g.moveTo(400,y0+1.5);g.lineTo(xl,yb+1.5);g.moveTo(400,y0+1.5);g.lineTo(xr,yb+1.5);g.stroke();
    g.strokeStyle='rgba(210,223,207,.24)';g.lineWidth=1.8;
    g.beginPath();g.moveTo(400,y0);g.lineTo(xl,yb);g.moveTo(400,y0);g.lineTo(xr,yb);g.stroke();
  }

  // Носовая треугольная палуба и тень под её кромкой.
  shape(g,[[400,322],[478,342],[468,351],[332,351],[322,342]],'rgba(10,22,24,.45)');
  const deckGrad=g.createLinearGradient(0,318,0,346);
  deckGrad.addColorStop(0,D('#c5cabd'));deckGrad.addColorStop(1,D('#89948b'));
  shape(g,[[400,318],[482,340],[474,346],[326,346],[318,340]],deckGrad);
  g.strokeStyle='rgba(245,248,236,.38)';g.lineWidth=1;
  g.beginPath();g.moveTo(326,345.5);g.lineTo(474,345.5);g.stroke();
  if(P.wx==='rain'||P.wx==='wind'){
    // Влажный блеск на носовой палубе и скамейке в сырую погоду.
    const sheen=g.createLinearGradient(0,318,0,346);
    sheen.addColorStop(0,rgba(mix(P.haze,'#eef4f8',.5),.24));sheen.addColorStop(1,'rgba(255,255,255,0)');
    shape(g,[[400,318],[482,340],[474,346],[326,346],[318,340]],sheen);
  }

  // Швартовый рым и металлическая утка на носовой палубе.
  g.fillStyle='rgba(12,24,26,.45)';g.beginPath();g.ellipse(400,335,10,3.6,0,0,7);g.fill();
  g.strokeStyle=D('#c0c8b4');g.lineWidth=2.2;g.beginPath();g.ellipse(400,333,8,3,0,0,7);g.stroke();
  g.fillStyle=D('#7e897c');g.beginPath();g.ellipse(400,331,4.5,1.6,0,0,7);g.fill();

  // Тень под банкой и объёмная деревянная скамейка (банка) с передней гранью, сучками и болтами.
  shape(g,[[184,387],[616,387],[652,412],[148,412]],'rgba(10,22,24,.48)');
  shape(g,[[162,398],[638,398],[642,405],[158,405]],D('#4a3c2a'));
  const seat=g.createLinearGradient(0,382,0,399);seat.addColorStop(0,D('#cbb68c'));seat.addColorStop(.65,D('#9c825b'));seat.addColorStop(1,D('#6b5940'));
  shape(g,[[194,383],[606,383],[638,399],[162,399]],seat);
  for(let i=0;i<19;i++){const y=384+i*.7;g.strokeStyle=i%3?'rgba(70,49,29,.25)':'rgba(232,207,155,.32)';g.lineWidth=.5;g.beginPath();g.moveTo(195-i,y);g.bezierCurveTo(310,y+1,520,y-1,608+i,y);g.stroke();}
  for(const [kx,ky] of [[290,391],[485,389]]){
    g.fillStyle=D('#5d4830');g.beginPath();c_ellipse(g,kx,ky,5.5,1.8);
  }
  g.strokeStyle='rgba(248,236,204,.35)';g.lineWidth=.8;
  g.beginPath();g.moveTo(195,383.5);g.lineTo(605,383.5);g.stroke();

  // Планширь (бортовой край) + тёмный резиновый привальный брус + уключины.
  g.strokeStyle=D('#2a3636');g.lineWidth=6.5;
  g.beginPath();g.moveTo(400,310);g.lineTo(174,369);g.lineTo(33,420);g.moveTo(400,310);g.lineTo(626,369);g.lineTo(767,420);g.stroke();
  g.strokeStyle=D('#d6ded0');g.lineWidth=3.6;
  g.beginPath();g.moveTo(400,311);g.lineTo(175,370);g.lineTo(35,420);g.moveTo(400,311);g.lineTo(625,370);g.lineTo(765,420);g.stroke();
  g.strokeStyle='rgba(255,253,242,.38)';g.lineWidth=1;
  g.beginPath();g.moveTo(400,310.5);g.lineTo(175,369.5);g.lineTo(37,419);g.moveTo(400,310.5);g.lineTo(625,369.5);g.lineTo(763,419);g.stroke();

  // Болты крепления скамейки и металлические уключины по бортам.
  for(const x of [209,591]){
    g.fillStyle='rgba(18,22,18,.45)';g.beginPath();g.ellipse(x,390.5,2.4,1.4,0,0,7);g.fill();
    g.fillStyle=D('#53615b');g.beginPath();g.ellipse(x,390,1.9,1.1,0,0,7);g.fill();
  }
  for(const [ox,oy,ang] of [[146,380,-.35],[654,380,.35]]){
    g.fillStyle=D('#364341');g.beginPath();g.ellipse(ox,oy,7,3,ang,0,7);g.fill();
    g.strokeStyle=D('#adb6a4');g.lineWidth=1.8;g.beginPath();g.moveTo(ox,oy);g.lineTo(ox,oy-5.5);g.stroke();
    g.strokeStyle=D('#d2dac8');g.lineWidth=1.4;g.beginPath();g.arc(ox,oy-6.5,2.5,0,7);g.stroke();
  }

  // Реалистичная бухта швартового каната в носу.
  g.fillStyle='rgba(12,24,26,.36)';g.beginPath();g.ellipse(351,365,22,9.5,-.2,0,7);g.fill();
  for(let i=5;i>=0;i--){
    g.strokeStyle=D(i%2?'#ad9c76':'#756b50');g.lineWidth=1.9;
    g.beginPath();g.ellipse(350,363-i*.45,10+i*2,4+i*.8,-.2,.2,6);g.stroke();
  }
}
function c_ellipse(ctx,x,y,rx,ry){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,7);ctx.fill();}
