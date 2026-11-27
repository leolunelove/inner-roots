import {CELL,random,hedgeDensity,sampleTrail} from './maze.js?v=1.3.0-demo.1';

// A survey of physical trail geometry. Unvisited portions are never composited.
export function createFieldMap(canvas){
 const size=896,pad=54,span=size-pad*2;
 canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d');
 let base=null,knownMaze=null,zoom=1;
 function prepare(maze,theme){
  const c=document.createElement('canvas');c.width=c.height=size;
  const g=c.getContext('2d'),r=random(maze.seed+923),scale=span/(maze.n*CELL);
  const at=v=>pad+(v+CELL/2)*scale;
  g.fillStyle=theme.id==='cinder'?'#26221c':theme.id==='drowned'?'#182b2b':'#202b22';g.fillRect(0,0,size,size);
  // Survey hatching follows actual banks and the local hedge / tree regions.
  for(let z=0;z<maze.n*CELL;z+=.63)for(let x=0;x<maze.n*CELL;x+=.63){
   const px=x-CELL/2+(r()-.5)*.5,pz=z-CELL/2+(r()-.5)*.5,s=sampleTrail(maze,px,pz);
   if(s.clearance>0)continue;
   const cover=hedgeDensity(maze,px,pz),sx=at(px),sy=at(pz);
   g.strokeStyle=s.clearance>-.5?'#a6b39638':'#93a18c13';g.lineWidth=.7;
   g.beginPath();g.moveTo(sx,sy);g.lineTo(sx+2+r()*3,sy-2-r()*4);g.stroke();
   if(cover>.55&&r()<.28){g.strokeStyle='#a2b79b22';g.beginPath();g.arc(sx,sy,2+r()*3,0,Math.PI*2);g.stroke()}
  }
  const paths=(colour,multiplier)=>{
   g.fillStyle=colour;
   for(const s of maze.space.shapes){
    const steps=s.clearing?0:3;
    for(let i=0;i<=steps;i++){
     const t=steps?i/steps:0,e=t*t*(3-2*t);
     g.beginPath();g.arc(at(s.ax+(s.bx-s.ax)*t),at(s.az+(s.bz-s.az)*t),(s.wa+(s.wb-s.wa)*e)*scale*multiplier,0,Math.PI*2);g.fill();
    }
   }
  };
  paths(theme.id==='cinder'?'#6d604740':theme.id==='drowned'?'#5d969240':'#84957540',1.1);
  paths(theme.id==='cinder'?'#5a5141':theme.id==='drowned'?'#375652':'#49583e',1);
  paths(theme.id==='cinder'?'#75684e25':theme.id==='drowned'?'#769b9120':'#98a17b20',.66);
  // Sparse distinct canopy and reed symbols sit outside the walking surfaces.
  for(let i=0;i<maze.n*maze.n*9;i++){
   const x=(r()*maze.n-.5)*CELL,z=(r()*maze.n-.5)*CELL;
   if(sampleTrail(maze,x,z).clearance>-.3)continue;
   const px=at(x),py=at(z),rad=2+r()*4;
   g.strokeStyle='#b3c3a64a';g.lineWidth=.65;g.beginPath();
   if(theme.id==='drowned'&&r()<.55){g.moveTo(px-2,py-3);g.lineTo(px,py+4);g.lineTo(px+3,py-4);g.moveTo(px,py+4);g.lineTo(px,py-6)}
   else if(theme.id==='cinder'){g.moveTo(px,py+rad);g.lineTo(px,py-rad);g.moveTo(px,py);g.lineTo(px-rad*.7,py-rad*.7);g.moveTo(px,py+1);g.lineTo(px+rad*.7,py-rad*.3)}
   else{g.arc(px,py,rad,0,Math.PI*2);g.moveTo(px,py-rad);g.lineTo(px,py+rad);g.moveTo(px-rad,py);g.lineTo(px+rad,py)}
   g.stroke();
  }
  // Fine paper grain stays deterministic when the map is reopened.
  for(let i=0;i<12000;i++){g.fillStyle=r()>.5?'#e3dfbd09':'#00000018';g.fillRect(r()*size,r()*size,1,1)}
  base=c;knownMaze=maze;
 }
 function draw({maze,theme,discovered,signals,exit,collected,player,yaw,landmarks=[],trail=[]}){
  if(knownMaze!==maze){prepare(maze,theme);zoom=1}
  const scale=span/(maze.n*CELL),at=v=>pad+(v+CELL/2)*scale;
  ctx.clearRect(0,0,size,size);ctx.fillStyle='#111711';ctx.fillRect(0,0,size,size);
  const paper=ctx.createRadialGradient(size*.43,size*.42,0,size*.5,size*.5,size*.7);paper.addColorStop(0,'#29302544');paper.addColorStop(1,'#03060466');ctx.fillStyle=paper;ctx.fillRect(0,0,size,size);
  // Coordinates remain a neutral survey reference in the uncharted area.
  ctx.strokeStyle='#c4cbb414';ctx.lineWidth=1;ctx.beginPath();
  for(let i=0;i<=8;i++){const p=pad+span*i/8;ctx.moveTo(p,pad);ctx.lineTo(p,size-pad);ctx.moveTo(pad,p);ctx.lineTo(size-pad,p)}ctx.stroke();
  ctx.save();ctx.beginPath();ctx.rect(pad,pad,span,span);ctx.clip();
  const px=at(player.x),py=at(player.z),cx=zoom===1?size/2:Math.max(pad+span/(2*zoom),Math.min(size-pad-span/(2*zoom),px)),cy=zoom===1?size/2:Math.max(pad+span/(2*zoom),Math.min(size-pad-span/(2*zoom),py));
  ctx.translate(size/2,size/2);ctx.scale(zoom,zoom);ctx.translate(-cx,-cy);
  ctx.save();ctx.beginPath();
  for(const key of discovered){const [x,z]=key.split(',').map(Number),s=scale*CELL;ctx.roundRect(pad+x*s,pad+z*s,s,s,s*.13)}
  ctx.clip();ctx.drawImage(base,0,0);
  // Breadcrumbs record walking, while the pulse may chart routes further ahead.
  if(trail.length){ctx.strokeStyle='#d8d8aa70';ctx.lineWidth=1.3/zoom;ctx.setLineDash([2/zoom,5/zoom]);ctx.beginPath();trail.forEach((p,i)=>i?ctx.lineTo(at(p.x),at(p.z)):ctx.moveTo(at(p.x),at(p.z)));ctx.stroke();ctx.setLineDash([])}
  ctx.restore();
  const visibleLandmarks=[];
  for(const mark of landmarks){
   if(!discovered.has(`${mark.cellX??Math.round(mark.x/CELL)},${mark.cellZ??Math.round(mark.z/CELL)}`))continue;visibleLandmarks.push(mark);
   const x=at(mark.x),y=at(mark.z);ctx.strokeStyle='#c7cfb9';ctx.lineWidth=1/zoom;ctx.beginPath();ctx.arc(x,y,4/zoom,0,Math.PI*2);ctx.stroke();
   ctx.font=`${19/zoom}px "IBM Plex Mono",monospace`;ctx.textAlign='left';ctx.fillStyle='#d2d5be';ctx.fillText(mark.name.toUpperCase(),x+10/zoom,y+4/zoom);
  }
  for(const signal of signals){
   if(!discovered.has(`${signal.x},${signal.z}`))continue;
   ctx.save();ctx.translate(at(signal.x*CELL),at(signal.z*CELL));ctx.rotate(Math.PI/4);ctx.lineWidth=1.7/zoom;ctx.strokeStyle=signal.found?'#91a183':theme.accent;ctx.fillStyle=signal.found?'#7f9472':'#111711';ctx.fillRect(-4/zoom,-4/zoom,8/zoom,8/zoom);ctx.strokeRect(-4/zoom,-4/zoom,8/zoom,8/zoom);ctx.restore();
  }
  if(discovered.has(`${exit.x},${exit.z}`)){
   ctx.strokeStyle=collected===3?theme.accent:'#bdc5ae';ctx.lineWidth=2/zoom;const x=at(exit.x*CELL),y=at(exit.z*CELL);
   ctx.beginPath();ctx.moveTo(x-5/zoom,y+6/zoom);ctx.lineTo(x-5/zoom,y-6/zoom);ctx.lineTo(x+5/zoom,y-6/zoom);ctx.lineTo(x+5/zoom,y+6/zoom);ctx.stroke();
  }
  ctx.save();ctx.translate(px,py);ctx.scale(1/zoom,1/zoom);ctx.rotate(-yaw);
  ctx.fillStyle='#e8ecd0';ctx.shadowColor=theme.accent;ctx.shadowBlur=9;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(6,7);ctx.lineTo(0,4);ctx.lineTo(-6,7);ctx.closePath();ctx.fill();ctx.restore();ctx.restore();
  ctx.strokeStyle='#a8b79555';ctx.lineWidth=1;ctx.strokeRect(pad,pad,span,span);
  ctx.fillStyle='#b4bca6';ctx.font='19px "IBM Plex Mono",monospace';ctx.textAlign='center';
  for(let i=0;i<8;i++){ctx.fillText(String.fromCharCode(65+i),pad+span*(i+.5)/8,pad-15);ctx.fillText(String(i+1),pad-22,pad+span*(i+.5)/8+4)}
  ctx.textAlign='left';ctx.font='15px "IBM Plex Mono",monospace';ctx.fillStyle='#88927e';ctx.fillText('SURVEY / '+theme.name.toUpperCase(),pad,size-22);
  ctx.strokeStyle='#c4cdb4';ctx.beginPath();ctx.moveTo(size-pad-90,size-30);ctx.lineTo(size-pad,size-30);ctx.moveTo(size-pad-90,size-34);ctx.lineTo(size-pad-90,size-26);ctx.moveTo(size-pad,size-34);ctx.lineTo(size-pad,size-26);ctx.stroke();ctx.textAlign='right';ctx.fillText(`${Math.round(90/scale/zoom)} m`,size-pad,size-39);
  ctx.textAlign='center';ctx.fillStyle='#dde2c7';ctx.fillText('N',size/2,23);ctx.beginPath();ctx.moveTo(size/2,28);ctx.lineTo(size/2-4,37);ctx.lineTo(size/2+4,37);ctx.closePath();ctx.fill();
  let known=0,total=0;for(let z=0;z<maze.n;z++)for(let x=0;x<maze.n;x++)if(!maze.grid[z][x]){total++;if(discovered.has(`${x},${z}`))known++}
  return {percent:Math.round(known/total*100),landmarks:visibleLandmarks,zoom};
 }
 return {draw,zoomBy(amount){zoom=Math.max(1,Math.min(2.5,zoom+amount))},reset(){zoom=1},dispose(){base=null;knownMaze=null}};
}
