import * as THREE from './vendor/three.module.js';
import {createMaze,random,CELL,walkable} from './maze.js';
import {buildForest,createForestMaterials} from './forest.js';
import {createFlashlight} from './flashlight.js';
import {createNervousSystem} from './nervous-system.js';
import {PULSE_RECHARGE} from './pulse-timing.js';
import {createForestSoundscape} from './forest-audio.js';
import {LEVELS,DEMO_VERSION} from './levels.js';
const $=id=>document.getElementById(id),canvas=$('world');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'})}catch(error){$('loading').innerHTML='<p>This forest needs WebGL to grow.<br>Please open it in a browser with graphics acceleration enabled.</p>';throw error}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#010302');scene.fog=new THREE.FogExp2('#030604',.045);
const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.08,110);camera.rotation.order='YXZ';
const ambient=new THREE.HemisphereLight('#c5cbbf','#30261b',.025);scene.add(ambient);
const moon=new THREE.DirectionalLight('#d2d6c7',.012);moon.position.set(-10,24,-5);scene.add(moon);
const flashlight=createFlashlight(scene,camera);
const clock=new THREE.Clock();const keys=new Set();const pointUniforms={uPreview:{value:1},uEye:{value:new THREE.Vector3()},uDirection:{value:new THREE.Vector3()},uPulse:{value:-100},uOrigin:{value:new THREE.Vector3()},uNerveMap:{value:null},uVeinMap:{value:null},uForestSize:{value:1},uTreeMap:{value:null},uTreeCount:{value:1},uVeinTint:{value:new THREE.Color()},uScanTint:{value:new THREE.Color()},uTime:{value:0}};
let maze,world,nerveNetwork,signals=[],gate,particles=[],discovered=new Set(),collected=0,mode='home',elapsed=0,pulses=0,charge=1,pulseAge=100,yaw=0,pitch=-.04,toastTimer=0,footstep=0,seed=4201,levelIndex=0,mapOpen=false;
const player=new THREE.Vector3(CELL,1.65,CELL),lastFoot=new THREE.Vector3();let drag=null,stick={x:0,y:0},audio=null,soundOn=false,soundscape=null,lastScan=null;
let records={};try{const saved=JSON.parse(localStorage.getItem('inner-roots-demo-v1')||'{}');for(const level of LEVELS){const record=saved[level.id];if(record&&Number.isFinite(record.time)&&record.time>0&&Number.isInteger(record.pulses)&&record.pulses>=0)records[level.id]=record}}catch{}
const materials={...createForestMaterials(pointUniforms),metal:new THREE.MeshStandardMaterial({color:'#25342b',roughness:.65,metalness:.4}),glow:new THREE.MeshBasicMaterial({color:'#dddcb3'}),gate:new THREE.MeshStandardMaterial({color:'#84936d',roughness:.9,emissive:'#9acb55',emissiveIntensity:.1})};
function terrainHeight(x,z){
 let h=0;const gx=Math.round(x/CELL),gz=Math.round(z/CELL);
 for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
  const a=gx+dx,b=gz+dz;if(maze.grid[b]?.[a]!==1)continue;
  const xx=Math.abs(x-a*CELL),zz=Math.abs(z-b*CELL);
  const d=Math.pow(Math.pow(xx,4)+Math.pow(zz,4),.25);
  const height=LEVELS[levelIndex].bankHeight+.25*Math.sin(a*7.1+b*3.9);
  h=Math.max(h,height*(1-THREE.MathUtils.smoothstep(d,.75,2.12)));
 }
 const bank=Math.min(1,h/.7);
 return h+bank*(Math.sin(x*3.1+Math.sin(z*2.7))*.11+Math.sin(z*6.1+x*4.2)*.045)+Math.sin(x*2.7+z*1.2)*.022+Math.sin(z*4-x*1.7)*.015;
}
function addMesh(geo,mat,x,y,z,scale=1){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.setScalar(scale);world.add(m);return m}
function makeWorld(){
 soundscape?.reset();lastScan=null;
 if(nerveNetwork)nerveNetwork.dispose();
 if(world){world.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.customDepthMaterial)o.customDepthMaterial.dispose();if(o.material?.userData?.unique)o.material.dispose()});scene.remove(world)}
 const level=LEVELS[levelIndex];seed=level.seed;
 scene.background.set(level.background);scene.fog.color.set(level.fog);scene.fog.density=level.fogDensity;
 pointUniforms.uVeinTint.value.set(level.vein);pointUniforms.uScanTint.value.set(level.scan);
 for(const name of ['bark','root','rock','foliage','canopy','twig','terrain'])materials[name].color.set(level[{foliage:'leaf',terrain:'soil'}[name]||name]);
 document.documentElement.style.setProperty('--acid',level.accent);
 $('chapter').textContent=level.name.toUpperCase();
 world=new THREE.Group();scene.add(world);maze=createMaze(seed,level.size);const r=random(seed+200),extent=maze.n*CELL;
 const forest=buildForest(world,maze,terrainHeight,materials,pointUniforms,level);
 nerveNetwork=createNervousSystem(world,maze,terrainHeight,pointUniforms,forest);
 signals=maze.targets.map((t,i)=>{
  const g=new THREE.Group();g.position.set(t.x*CELL,terrainHeight(t.x*CELL,t.z*CELL),t.z*CELL);world.add(g);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.26,.4,.6,7),materials.rock);base.position.y=.3;g.add(base);
  const rod=new THREE.Mesh(new THREE.CylinderGeometry(.035,.04,.9,7),materials.metal);rod.position.y=.95;g.add(rod);
  const core=new THREE.Mesh(new THREE.OctahedronGeometry(.16,0),materials.glow);core.position.y=1.5;g.add(core);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.31,.012,5,40),materials.glow);ring.position.y=1.5;g.add(ring);
  const light=new THREE.PointLight('#e2dfba',.65,4,1.7);light.position.y=1.5;g.add(light);
  return {...t,group:g,core,ring,light,found:false,index:i};
 });
 gate=new THREE.Group();gate.position.set(maze.exit.x*CELL,0,maze.exit.z*CELL);world.add(gate);
 for(const x of [-.9,.9]){const post=new THREE.Mesh(new THREE.BoxGeometry(.17,3,.23),materials.bark);post.position.set(x,1.5,0);gate.add(post)}
 const lintel=new THREE.Mesh(new THREE.BoxGeometry(2.1,.16,.23),materials.bark);lintel.position.y=3;gate.add(lintel);
 const doorMat=new THREE.MeshBasicMaterial({color:'#b9e59a',transparent:true,opacity:.07,side:THREE.DoubleSide});doorMat.userData.unique=true;const portal=new THREE.Mesh(new THREE.PlaneGeometry(1.6,2.6),doorMat);portal.position.y=1.3;gate.add(portal);gate.userData.portal=portal;
 const gl=new THREE.PointLight('#d1e9a5',1,10,1.5);gl.position.set(0,2,0);gate.add(gl);gate.userData.light=gl;
 // Low guide stones give the starting trail a gentle invitation.
 for(let j=0;j<maze.n;j++)for(let i=0;i<maze.n;i++){if(maze.grid[j][i]===0&&r()>.65){const peb=addMesh(new THREE.IcosahedronGeometry(.12,0),materials.rock,i*CELL+(r()-.5)*2.6,.07,j*CELL+(r()-.5)*2.6);peb.scale.y=.4}}
 particles=[];
 player.set(CELL,1.65,CELL);const next=maze.grid[1][2]===0?{x:2,z:1}:{x:1,z:2};yaw=Math.atan2(-(next.x-1),-(next.z-1));pitch=-.13;camera.position.copy(player);camera.rotation.set(pitch,yaw,0);lastFoot.copy(player);flashlight.reset();
 discovered=new Set();reveal(1.1);collected=0;elapsed=0;pulses=0;charge=1;pulseAge=100;footstep=0;updateRelics();
}
function reveal(radius){const gx=Math.round(player.x/CELL),gz=Math.round(player.z/CELL);for(let z=0;z<maze.n;z++)for(let x=0;x<maze.n;x++)if(Math.hypot(x-gx,z-gz)<=radius)discovered.add(`${x},${z}`);if(mapOpen)drawMap()}
function toast(message,seconds=4){$('toast').textContent=message;$('toast').classList.add('visible');toastTimer=seconds}
function formatTime(t){return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`}
function updateRelics(){[...$('relics').querySelectorAll('i')].forEach((el,i)=>el.classList.toggle('found',i<collected));$('relicCount').textContent=`${collected} / 3`;$('objectiveText').textContent=collected===3?'Find the illuminated exit':'Recover the three signals';materials.gate.emissiveIntensity=collected===3?1:.1}
function start(){keys.clear();mode='playing';$('home').hidden=true;$('homeFooter').hidden=true;$('hud').hidden=false;$('pause').hidden=false;$('pausePanel').hidden=true;$('winPanel').hidden=true;$('sessionLabel').textContent=LEVELS[levelIndex].name.toUpperCase();document.body.classList.add('playing');canvas.focus();toast('Aim your flashlight with the mouse. Click or Space scans beyond the beam.',6);captureMouse()}
const desktopPointer=matchMedia('(pointer:fine)').matches;
let freeMouse=false,lastMouse=null,edgeLook={x:0,y:0};
function useFreeMouse(){if(mode!=='playing'||mapOpen||!desktopPointer)return;freeMouse=true;document.body.classList.add('mouse-look');toast('Mouse look active · Escape releases the cursor.',4)}
function captureMouse(){
 if(!desktopPointer||mode!=='playing'||mapOpen||document.pointerLockElement===canvas)return;
 lastMouse=null;edgeLook={x:0,y:0};document.body.classList.add('mouse-look');
 if(!canvas.requestPointerLock){useFreeMouse();return}
 try{const request=canvas.requestPointerLock();if(request?.catch)request.catch(()=>useFreeMouse())}catch{useFreeMouse()}
}
function setPause(value){
 if(mode==='won'||mode==='home')return;
 mode=value?'paused':'playing';$('pausePanel').hidden=!value;keys.clear();stick.x=stick.y=0;drag=null;
 if(value){soundscape?.pause();freeMouse=false;lastMouse=null;edgeLook={x:0,y:0};document.body.classList.remove('mouse-look');mapOpen=false;$('mapPanel').hidden=true;if(document.pointerLockElement)document.exitPointerLock()}
 else{canvas.focus();captureMouse()}
}
function toggleMap(){
 if(mode!=='playing'&&mode!=='map')return;
 mapOpen=!mapOpen;mode=mapOpen?'map':'playing';$('mapPanel').hidden=!mapOpen;keys.clear();
 if(mapOpen){soundscape?.pause();freeMouse=false;lastMouse=null;edgeLook={x:0,y:0};document.body.classList.remove('mouse-look');if(document.pointerLockElement)document.exitPointerLock();drawMap()}
 else{canvas.focus();captureMouse()}
}
function drawMap(){const c=$('map'),ctx=c.getContext('2d'),s=396/maze.n,pad=22;ctx.clearRect(0,0,440,440);for(let z=0;z<maze.n;z++)for(let x=0;x<maze.n;x++){const known=discovered.has(`${x},${z}`);ctx.fillStyle=known?(maze.grid[z][x]?'#27382b':'#718163'):'#101c15';ctx.fillRect(pad+x*s+1,pad+z*s+1,s-2,s-2)}for(const t of signals){if(!discovered.has(`${t.x},${t.z}`))continue;ctx.save();ctx.translate(pad+(t.x+.5)*s,pad+(t.z+.5)*s);ctx.rotate(Math.PI/4);ctx.strokeStyle=t.found?'#60734e':'#e3f3b7';ctx.lineWidth=2;ctx.strokeRect(-5,-5,10,10);ctx.restore()}if(discovered.has(`${maze.exit.x},${maze.exit.z}`)){ctx.strokeStyle=collected===3?'#e3f3b7':'#929e80';ctx.lineWidth=2;ctx.strokeRect(pad+(maze.exit.x+.25)*s,pad+(maze.exit.z+.15)*s,s*.5,s*.7)}const px=pad+(player.x/CELL+.5)*s,pz=pad+(player.z/CELL+.5)*s;ctx.save();ctx.translate(px,pz);ctx.rotate(-yaw);ctx.fillStyle='#e8f6bd';ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(6,6);ctx.lineTo(0,3);ctx.lineTo(-6,6);ctx.closePath();ctx.fill();ctx.restore()}
function pulse(){if(mode!=='playing'||charge<.99)return;charge=0;pulses++;pulseAge=0;pointUniforms.uOrigin.value.copy(player);lastScan=nerveNetwork.pulse(player);for(const cell of lastScan.charted)discovered.add(`${cell.x},${cell.z}`);soundscape?.pulse(lastScan,player);if(mapOpen)drawMap();const left=signals.filter(s=>!s.found);const near=left.sort((a,b)=>Math.hypot(a.x*CELL-player.x,a.z*CELL-player.z)-Math.hypot(b.x*CELL-player.x,b.z*CELL-player.z))[0];if(near){const dist=Math.round(Math.hypot(near.x*CELL-player.x,near.z*CELL-player.z));toast(`Signal echo · ${dist} m away`,3)}else toast('All signals recovered. The exit is illuminated.',3)}
function refreshMenu(){
 document.querySelectorAll('[data-level]').forEach(button=>{const i=Number(button.dataset.level),record=records[LEVELS[i].id];button.classList.toggle('selected',i===levelIndex);button.classList.toggle('done',!!record);button.setAttribute('aria-pressed',String(i===levelIndex));$('best'+i).textContent=record?'Cleared · '+formatTime(record.time):'Not yet explored'});
 $('start').textContent='Enter '+LEVELS[levelIndex].name;
 const count=LEVELS.filter(level=>records[level.id]).length;
 $('demoProgress').textContent=count===3?'All three groves remembered.':count?`${count} of 3 groves remembered.`:'Three mazes. Three ways home.';
}
function selectLevel(index){if(index<0||index>=LEVELS.length)return;levelIndex=index;makeWorld();refreshMenu()}
function returnMenu(){
 mode='home';soundscape?.pause();freeMouse=false;lastMouse=null;edgeLook={x:0,y:0};keys.clear();stick={x:0,y:0};drag=null;mapOpen=false;
 document.body.classList.remove('playing','mouse-look');if(document.pointerLockElement)document.exitPointerLock();
 for(const id of ['hud','pause','pausePanel','winPanel','mapPanel','infoPanel'])$(id).hidden=true;
 $('home').hidden=false;$('homeFooter').hidden=false;$('sessionLabel').textContent='GAMEPLAY DEMO';makeWorld();refreshMenu();$('start').focus();
}
function win(){
 mode='won';soundscape?.pause();freeMouse=false;document.body.classList.remove('mouse-look');if(document.pointerLockElement)document.exitPointerLock();keys.clear();
 const level=LEVELS[levelIndex],previous=records[level.id];if(!previous||elapsed<previous.time)records[level.id]={time:elapsed,pulses};
 try{localStorage.setItem('inner-roots-demo-v1',JSON.stringify(records))}catch{}
 const completed=LEVELS.filter(level=>records[level.id]).length,complete=completed===LEVELS.length;
 $('winPanel').hidden=false;$('winTime').textContent=formatTime(elapsed);$('winScans').textContent=pulses;
 $('winEyebrow').textContent=complete?'INNER ROOTS · DEMO COMPLETE':level.name.toUpperCase()+' · COMPLETE';
 $('winTitle').innerHTML=complete?'The forest<br><em>remembers.</em>':'A way<br><em>through.</em>';
 $('winCopy').textContent=complete?'Three groves. Nine signals. You found your way through a living forest. Thank you for playing the first Inner Roots demo.':`You recovered all three signals in ${level.name}. The roots have one less secret.`;
 $('next').textContent=levelIndex<LEVELS.length-1?'Enter '+LEVELS[levelIndex+1].name:'Return to main menu';
 $('winMenu').hidden=levelIndex===LEVELS.length-1;
 $('winFootnote').textContent=complete?'End of gameplay demo · v1.0':`${completed} of 3 groves remembered. Each has a different way home.`;
 refreshMenu();tone(392,1,.04);setTimeout(()=>tone(523,1.5,.025),220);
}
function initAudio(){if(audio)return;audio=new (window.AudioContext||window.webkitAudioContext)();soundscape=createForestSoundscape(audio);if(lastScan)soundscape.pulse(lastScan,pointUniforms.uOrigin.value)}
function tone(freq,duration=.3,volume=.035){if(!audio||!soundOn)return;const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.6,audio.currentTime+duration);g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);o.connect(g).connect(soundscape.interfaceBus);o.onended=()=>{o.disconnect();g.disconnect()};o.start();o.stop(audio.currentTime+duration)}
function toggleSound(){initAudio();soundOn=!soundOn;soundscape.setEnabled(soundOn);if(soundOn)audio.resume();$('sound').querySelector('span').textContent=soundOn?'ON':'OFF';$('sound').setAttribute('aria-label',soundOn?'Mute sound':'Enable sound')}
$('sound').onclick=toggleSound;$('start').onclick=start;$('pause').onclick=()=>setPause(true);$('resume').onclick=()=>setPause(false);
$('restart').onclick=()=>{makeWorld();start()};$('next').onclick=()=>{if(levelIndex<LEVELS.length-1){selectLevel(levelIndex+1);start()}else returnMenu()};
$('pauseMenu').onclick=$('winMenu').onclick=returnMenu;
$('infoButton').onclick=()=>{$('infoPanel').hidden=false;$('closeInfo').focus()};$('closeInfo').onclick=()=>{$('infoPanel').hidden=true;$('infoButton').focus()};
document.querySelectorAll('[data-level]').forEach(button=>button.onclick=()=>selectLevel(Number(button.dataset.level)));
$('scan').onclick=pulse;$('mapButton').onclick=toggleMap;$('closeMap').onclick=toggleMap;
document.querySelector('.brand').onclick=e=>{e.preventDefault();if(mode==='playing')setPause(true);else if(mode!=='home')returnMenu()};
window.addEventListener('keydown',e=>{
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape','Tab'].includes(e.code))e.preventDefault();
 if(e.code==='Escape'){if(!$('infoPanel').hidden){$('closeInfo').click();return}if(mapOpen)toggleMap();else if(mode==='playing')setPause(true);else if(mode==='paused')setPause(false);return}
 if(e.code==='Tab'&&mode==='playing'){setPause(true);return}
 if(e.code==='KeyM'&&!e.repeat){toggleMap();return}
 if(e.code==='Space'&&!e.repeat)pulse();if(mode==='playing')keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();if(mode==='playing'||mode==='map')setPause(true)});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(mode==='playing'||mode==='map'))setPause(true)});
document.addEventListener('pointerlockchange',()=>{keys.clear();if(document.pointerLockElement===canvas){freeMouse=false;document.body.classList.add('mouse-look')}else if(mode==='playing'&&desktopPointer)setPause(true)});
document.addEventListener('pointerlockerror',useFreeMouse);
document.addEventListener('mousemove',e=>{
 if(mode!=='playing'||mapOpen||!desktopPointer)return;
 const captured=document.pointerLockElement===canvas;
 if(!captured&&!freeMouse)return;
 const dx=captured?e.movementX:(lastMouse?e.clientX-lastMouse.x:0);
 const dy=captured?e.movementY:(lastMouse?e.clientY-lastMouse.y:0);
 yaw-=dx*.0022;pitch=THREE.MathUtils.clamp(pitch-dy*.0022,-1.32,1.32);
 lastMouse={x:e.clientX,y:e.clientY};
 if(!captured){const nx=e.clientX/innerWidth*2-1,ny=e.clientY/innerHeight*2-1;edgeLook.x=Math.abs(nx)>.92?Math.sign(nx)*(Math.abs(nx)-.92)/.08:0;edgeLook.y=Math.abs(ny)>.94?Math.sign(ny)*(Math.abs(ny)-.94)/.06:0}
});
canvas.addEventListener('pointerdown',e=>{
 if(mode!=='playing')return;
 if(e.pointerType==='touch'){drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)}
 else if(document.pointerLockElement===canvas||freeMouse){if(e.button===0)pulse()}else captureMouse();
});
canvas.addEventListener('pointermove',e=>{
 if(e.pointerType!=='touch'||!drag||mode!=='playing'||e.pointerId!==drag.id)return;
 yaw-=(e.clientX-drag.x)*.004;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-drag.y)*.003,-1.32,1.32);drag.x=e.clientX;drag.y=e.clientY;
});
canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
const joystick=$('stick');function stickMove(e){const rect=joystick.getBoundingClientRect();stick.x=THREE.MathUtils.clamp((e.clientX-rect.left-45)/31,-1,1);stick.y=THREE.MathUtils.clamp((e.clientY-rect.top-45)/31,-1,1);joystick.firstElementChild.style.transform=`translate(${stick.x*25}px,${stick.y*25}px)`}joystick.onpointerdown=e=>{joystick.setPointerCapture(e.pointerId);stickMove(e)};joystick.onpointermove=e=>{if(joystick.hasPointerCapture(e.pointerId))stickMove(e)};joystick.onpointerup=joystick.onpointercancel=()=>{stick.x=stick.y=0;joystick.firstElementChild.style.transform=''};
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6))});
function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;pointUniforms.uPreview.value=mode==='home'?1:0;pointUniforms.uTime.value=t;ambient.intensity=mode==='home'?.3:.025;moon.intensity=mode==='home'?.35:.012;
 if(mode==='playing'){
  if(freeMouse){yaw-=edgeLook.x*dt*1.6;pitch=THREE.MathUtils.clamp(pitch-edgeLook.y*dt*.8,-1.32,1.32)}
  elapsed+=dt;charge=Math.min(1,charge+dt/PULSE_RECHARGE);pulseAge+=dt;if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('visible')}
  const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-stick.y;
  const strafe=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+stick.x;const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?3.6:2.35)*dt/Math.max(1,Math.hypot(forward,strafe));
  if(keys.has('ArrowLeft')||keys.has('KeyQ'))yaw+=dt*1.6;if(keys.has('ArrowRight')||keys.has('KeyE'))yaw-=dt*1.6;
  const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*strafe)*speed,dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*strafe)*speed;
  if(walkable(maze,player.x+dx,player.z))player.x+=dx;if(walkable(maze,player.x,player.z+dz))player.z+=dz;
  const moved=Math.hypot(player.x-lastFoot.x,player.z-lastFoot.z);footstep+=moved;lastFoot.copy(player);if(footstep>.9){footstep=0;tone(75+Math.random()*25,.1,.018);reveal(1.1)}
  player.y=1.65+terrainHeight(player.x,player.z)+(moved>.001?Math.sin(t*10)*.025:Math.sin(t*1.4)*.008);camera.position.copy(player);camera.rotation.set(pitch,yaw,0);
  for(const s of signals){if(!s.found&&Math.hypot(player.x-s.x*CELL,player.z-s.z*CELL)<1.2){s.found=true;collected++;s.group.visible=false;updateRelics();tone(620,.8,.06);toast(collected===3?'All signals recovered. Find the illuminated exit.':`Signal recovered · ${collected} of 3`,5);if(mapOpen)drawMap()}}
  if(Math.hypot(player.x-maze.exit.x*CELL,player.z-maze.exit.z*CELL)<1.2){if(collected===3)win();else if(toastTimer<=0)toast('The exit needs all three signals.',4)}
  $('timer').textContent=formatTime(elapsed);$('charge').style.width=`${charge*100}%`;$('scanText').textContent=charge>=.99?'Pulse ready':`Recharging ${Math.ceil((1-charge)*PULSE_RECHARGE)}s`;
  let deg=((yaw*-180/Math.PI)%360+360)%360;const dirs=['N','NE','E','SE','S','SW','W','NW'];$('bearing').textContent=`${dirs[Math.round(deg/45)%8]} · ${Math.round(deg)}°`;if(mapOpen)drawMap();
 }else if(mode==='home'){
  camera.position.set(player.x,1.75,player.z);camera.rotation.set(-.03+Math.sin(t*.12)*.015,yaw+.14+Math.sin(t*.1)*.1,0);pulseAge+=dt;
 }
 flashlight.update(dt,t,keys.has('KeyW')||keys.has('KeyS')||keys.has('KeyA')||keys.has('KeyD')||keys.has('ArrowUp')||keys.has('ArrowDown')||Math.hypot(stick.x,stick.y)>.1,mode);
 const direction=new THREE.Vector3();camera.getWorldDirection(direction);pointUniforms.uEye.value.copy(camera.position);pointUniforms.uDirection.value.copy(direction);pointUniforms.uPulse.value=pulseAge;
 soundscape?.update({age:pulseAge,active:mode==='playing',position:camera.position,forward:direction});
 // Scans reveal a moving band on actual surfaces; ambient light stays dark.
 for(const s of signals){if(s.found)continue;s.core.rotation.y=t*.5;s.core.position.y=1.5+Math.sin(t*1.8+s.index)*.07;s.ring.rotation.y=t*.3;s.light.intensity=.6+Math.sin(t*2)*.12}
 gate.userData.light.intensity=collected===3?14:1;gate.userData.portal.material.opacity=collected===3?.18+Math.sin(t)*.04:.035;
 for(const p of particles){p.mesh.position.y+=Math.sin(t+p.phase)*dt*.05;p.mesh.material.opacity=.25+Math.sin(t*1.5+p.phase)*.2}
 renderer.render(scene,camera);
}
makeWorld();refreshMenu();requestAnimationFrame(()=>{$('loading').style.opacity=0;setTimeout(()=>$('loading').hidden=true,550);frame()});
