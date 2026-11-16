// Море и лодка используют ту же перспективу и освещение, что и пресные водоёмы.
function paintSea(c) {
  const P=getPalette();
  paintSky(c,183);
  shape(c,[[0,181],[24,171],[46,175],[66,169],[102,183]],mix(P.ridges[0],'#8a9fa4',.35));
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
  const lighting=currentDayPart()+':'+currentWeather();
  if(landscapeKey!=='sea'||landscapeLighting!==lighting){scenery.setTransform(2,0,0,2,0,0);paintSea(scenery);landscapeKey='sea';landscapeLighting=lighting;}
  g.drawImage(landscape,0,0,800,420);
  drawWaterSurface(time,true);
  if(currentDayPart()!=='night'&&currentWeather()!=='rain') {
    g.strokeStyle='#435960';g.lineWidth=.7;
    for(let i=0;i<4;i++){const x=(120+i*137+time*3)%850,y=65+Math.sin(time+i)*3;g.beginPath();g.moveTo(x-5,y);g.quadraticCurveTo(x-2,y-4,x,y);g.quadraticCurveTo(x+3,y-4,x+6,y);g.stroke();}
  }
}
function drawBoat(time) {
  const P=getPalette(), dim=P.part==='night'?.45:P.part==='evening'?.12:0;
  const D=c=>mix(c,'#141c26',dim);
  const tilt=Math.sin(time*.85)*.012,bob=Math.sin(time*1.3)*2.5;
  g.translate(400,390+bob);g.rotate(tilt);g.translate(-400,-390);
  let material=g.createLinearGradient(0,310,0,420);material.addColorStop(0,D('#d7d9c9'));material.addColorStop(.5,D('#919f98'));material.addColorStop(1,D('#536d6e'));
  shape(g,[[400,310],[625,369],[765,420],[35,420],[175,369]],material);
  material=g.createLinearGradient(0,326,0,420);material.addColorStop(0,D('#233f47'));material.addColorStop(.4,D('#526b6a'));material.addColorStop(1,D('#8b9a8b'));
  shape(g,[[400,326],[598,378],[690,420],[110,420],[202,378]],material);
  shape(g,[[400,326],[202,378],[110,420],[151,420],[232,382],[400,342],[568,382],[650,420],[690,420],[598,378]],D('#314c50'));
  g.strokeStyle='rgba(210,223,207,.22)';g.lineWidth=2;
  for(let i=0;i<5;i++){g.beginPath();g.moveTo(400,343+i*12);g.lineTo(225-i*16,384+i*9);g.moveTo(400,343+i*12);g.lineTo(575+i*16,384+i*9);g.stroke();}
  shape(g,[[190,387],[610,387],[643,408],[157,408]],'rgba(13,30,32,.42)');
  const seat=g.createLinearGradient(0,382,0,401);seat.addColorStop(0,D('#c3ad83'));seat.addColorStop(.7,D('#9a805a'));seat.addColorStop(1,D('#5d503b'));
  shape(g,[[194,383],[606,383],[638,400],[162,400]],seat);
  for(let i=0;i<19;i++){const y=384+i*.7;g.strokeStyle=i%3?'rgba(70,49,29,.25)':'rgba(232,207,155,.3)';g.lineWidth=.5;g.beginPath();g.moveTo(195-i,y);g.bezierCurveTo(310,y+1,520,y-1,608+i,y);g.stroke();}
  g.strokeStyle=D('#d8dfd0');g.lineWidth=4;g.beginPath();g.moveTo(400,311);g.lineTo(175,370);g.lineTo(35,420);g.moveTo(400,311);g.lineTo(625,370);g.lineTo(765,420);g.stroke();
  for(const x of [209,591]){g.fillStyle=D('#3f4e49');g.beginPath();g.ellipse(x,390,2,1.2,0,0,7);g.fill();}
  g.strokeStyle=D('#b4bba4');g.lineWidth=2;g.beginPath();g.ellipse(400,333,8,3,0,0,7);g.stroke();
  for(let i=0;i<6;i++){g.strokeStyle=D(i%2?'#a89873':'#70684f');g.lineWidth=1.7;g.beginPath();g.ellipse(350,363,10+i*2,4+i*.8,-.2,.2,6);g.stroke();}
}
