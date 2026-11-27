import * as THREE from './vendor/three.module.js';
import {createMaze,random,CELL,walkable,pathClearance,hedgeDensity} from './maze.js?v=1.3.0-demo.1';
import {buildForest,createForestMaterials} from './forest.js?v=1.3.0-demo.1';
import {createFlashlight} from './flashlight.js?v=1.3.0-demo.1';
import {createNervousSystem} from './nervous-system.js?v=1.3.0-demo.1';
import {createSignals,createGate,updateLandmarks} from './landmarks.js?v=1.3.0-demo.1';
import {createFieldMap} from './field-map.js?v=1.3.0-demo.1';
import {createAreaDetails} from './area-details.js?v=1.3.0-demo.1';
import {PULSE_RECHARGE,PULSE_DURATION} from './pulse-timing.js?v=1.3.0-demo.1';
import {createForestSoundscape} from './forest-audio.js?v=1.3.0-demo.1';
import {LEVELS,DEMO_VERSION} from './levels.js?v=1.3.0-demo.1';
const $=id=>document.getElementById(id),canvas=$('world'),fieldMap=createFieldMap($('map'));
let areaDetails=null,walkedTrail=[],worldLoading=false,graphicsFailed=false;
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'})}catch(error){$('loading').innerHTML='<p>This forest needs WebGL to grow.<br>Please open it in a browser with graphics acceleration enabled.</p>';throw error}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#010302');scene.fog=new THREE.FogExp2('#030604',.045);
const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.08,110);camera.rotation.order='YXZ';
const ambient=new THREE.HemisphereLight('#c5cbbf','#30261b',.025);scene.add(ambient);
const moon=new THREE.DirectionalLight('#d2d6c7',.012);moon.position.set(-10,24,-5);scene.add(moon);
const flashlight=createFlashlight(scene,camera);
const clock=new THREE.Clock();const keys=new Set();const pointUniforms={uPreview:{value:1},uEye:{value:new THREE.Vector3()},uDirection:{value:new THREE.Vector3()},uPulse:{value:-100},uOrigin:{value:new THREE.Vector3()},uNerveMap:{value:null},uVeinMap:{value:null},uForestSize:{value:1},uTreeMap:{value:null},uTreeCount:{value:1},uVeinTint:{value:new THREE.Color()},uScanTint:{value:new THREE.Color()},uTime:{value:0}};
let maze,world,nerveNetwork,forestSurfaces,signals=[],gate,particles=[],discovered=new Set(),collected=0,mode='home',elapsed=0,pulses=0,charge=1,pulseAge=100,yaw=0,pitch=-.04,toastTimer=0,footstep=0,seed=4201,levelIndex=0,mapOpen=false;
const player=new THREE.Vector3(CELL,1.65,CELL),lastFoot=new THREE.Vector3();let drag=null,stick={x:0,y:0},audio=null,soundOn=false,soundscape=null,lastScan=null;
let records={};try{const saved=JSON.parse(localStorage.getItem('inner-roots-demo-v1.3')||'{}');for(const level of LEVELS){const record=saved[level.id];if(record&&Number.isFinite(record.time)&&record.time>0&&Number.isInteger(record.pulses)&&record.pulses>=0)records[level.id]=record}}catch{}
const materials={...createForestMaterials(pointUniforms),metal:new THREE.MeshStandardMaterial({color:'#25342b',roughness:.65,metalness:.4}),glow:new THREE.MeshBasicMaterial({color:'#dddcb3'}),gate:new THREE.MeshStandardMaterial({color:'#84936d',roughness:.9,emissive:'#9acb55',emissiveIntensity:.1})};
function terrainHeight(x,z){
 const clearance=pathClearance(maze,x,z),cover=hedgeDensity(maze,x,z);
 const rolling=.67+.17*Math.sin(x*.23+Math.sin(z*.17))+.12*Math.sin(z*.31-x*.13);
 const peak=THREE.MathUtils.lerp(LEVELS[levelIndex].bankHeight*rolling,.24,THREE.MathUtils.smoothstep(cover,.35,.8));
 const h=peak*THREE.MathUtils.smoothstep(-clearance,.12,1.9);
 const bank=Math.min(1,h/.7);
 return h+bank*(Math.sin(x*3.1+Math.sin(z*2.7))*.11+Math.sin(z*6.1+x*4.2)*.045)+Math.sin(x*2.7+z*1.2)*.022+Math.sin(z*4-x*1.7)*.015;
}
function addMesh(geo,mat,x,y,z,scale=1){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.setScalar(scale);world.add(m);return m}
function makeWorld(){
 soundscape?.reset();lastScan=null;areaDetails?.dispose?.();fieldMap.reset();walkedTrail=[{x:CELL,z:CELL}];
 if(nerveNetwork)nerveNetwork.dispose();
 if(world){
  const geometries=new Set(),uniqueMaterials=new Set();
  world.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.customDepthMaterial&&!o.customDepthMaterial.userData.persistent)uniqueMaterials.add(o.customDepthMaterial);if(o.material?.userData?.unique)uniqueMaterials.add(o.material);if(o.isInstancedMesh)o.dispose()});
  geometries.forEach(geometry=>geometry.dispose());uniqueMaterials.forEach(material=>material.dispose());
  scene.remove(world);renderer.renderLists.dispose();
 }
 const level=LEVELS[levelIndex];seed=level.seed;
 scene.background.set(level.background);scene.fog.color.set(level.fog);scene.fog.density=level.fogDensity;
 pointUniforms.uVeinTint.value.set(level.vein);pointUniforms.uScanTint.value.set(level.scan);
 for(const name of ['bark','root','rock','foliage','canopy','twig','terrain','hedge','hedgeLeaf'])materials[name].color.set(level[{foliage:'leaf',terrain:'soil',hedgeLeaf:'hedge'}[name]||name]);
 materials.hedgeLeaf.color.lerp(new THREE.Color('#c7c2a1'),.46);
 document.documentElement.style.setProperty('--acid',level.accent);
 $('chapter').textContent=level.name.toUpperCase();
 world=new THREE.Group();scene.add(world);maze=createMaze(seed,level.size);const r=random(seed+200),extent=maze.n*CELL;
 const forest=buildForest(world,maze,terrainHeight,materials,pointUniforms,level);forestSurfaces=forest.surfacePoints;
 nerveNetwork=createNervousSystem(world,maze,terrainHeight,pointUniforms,forest);
 signals=createSignals(world,maze,terrainHeight,materials,level);
 gate=createGate(world,maze,terrainHeight,materials,level);
 areaDetails=createAreaDetails(world,maze,terrainHeight,materials,level);
 // Low guide stones give the starting trail a gentle invitation.
 for(let j=0;j<maze.n;j++)for(let i=0;i<maze.n;i++){if(maze.grid[j][i]===0&&r()>.65){const peb=addMesh(new THREE.IcosahedronGeometry(.12,0),materials.rock,i*CELL+(r()-.5)*2.6,.07,j*CELL+(r()-.5)*2.6);peb.scale.y=.4}}
 particles=[];resetRun();
}
function resetRun(){
 soundscape?.reset();lastScan=null;fieldMap.reset();walkedTrail=[{x:CELL,z:CELL}];
 for(const signal of signals){signal.found=false;signal.group.visible=true;signal.group.traverse(o=>{if(o.isMesh)o.visible=true});signal.light.intensity=.5}
 if(gate){gate.userData.open=0;gate.userData.portal.material.uniforms.uOpen.value=0}
 $('toast').classList.remove('visible');toastTimer=0;
 player.set(CELL,1.65,CELL);const next=maze.grid[1][2]===0?{x:2,z:1}:{x:1,z:2};yaw=Math.atan2(-(next.x-1),-(next.z-1));pitch=-.13;camera.position.copy(player);camera.rotation.set(pitch,yaw,0);lastFoot.copy(player);flashlight.reset();
 discovered=new Set();reveal(1.1);collected=0;elapsed=0;pulses=0;charge=1;pulseAge=100;footstep=0;updateRelics();
}
function reveal(radius){const gx=Math.round(player.x/CELL),gz=Math.round(player.z/CELL);for(let z=0;z<maze.n;z++)for(let x=0;x<maze.n;x++)if(Math.hypot(x-gx,z-gz)<=radius)discovered.add(`${x},${z}`);if(mapOpen)drawMap()}
function toast(message,seconds=4){$('toast').textContent=message;$('toast').classList.add('visible');toastTimer=seconds}
function formatTime(t){return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`}
function updateRelics(){[...$('relics').querySelectorAll('i')].forEach((el,i)=>el.classList.toggle('found',i<collected));$('relicCount').textContent=`${collected} / 3`;$('objectiveText').textContent=collected===3?'Find the illuminated exit':'Recover the three signals';materials.gate.emissiveIntensity=collected===3?1:.1}
function start(){if(worldLoading)return;keys.clear();mode='playing';$('home').hidden=true;$('homeFooter').hidden=true;$('hud').hidden=false;$('pause').hidden=false;$('pausePanel').hidden=true;$('winPanel').hidden=true;$('sessionLabel').textContent=LEVELS[levelIndex].name.toUpperCase();document.body.classList.add('playing');canvas.focus();toast('Aim your flashlight with the mouse. Click or Space scans beyond the beam.',6);captureMouse()}
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
 if(value){soundscape?.pause();freeMouse=false;lastMouse=null;edgeLook={x:0,y:0};document.body.classList.remove('mouse-look');mapOpen=false;$('mapPanel').hidden=true;if(document.pointerLockElement)document.exitPointerLock();$('resume').focus()}
 else{canvas.focus();captureMouse()}
}
function toggleMap(){
 if(mode!=='playing'&&mode!=='map')return;
 mapOpen=!mapOpen;mode=mapOpen?'map':'playing';$('mapPanel').hidden=!mapOpen;keys.clear();
 if(mapOpen){soundscape?.pause();freeMouse=false;lastMouse=null;edgeLook={x:0,y:0};document.body.classList.remove('mouse-look');if(document.pointerLockElement)document.exitPointerLock();drawMap();$('closeMap').focus()}
 else{canvas.focus();captureMouse()}
}
function drawMap(){
 const theme=LEVELS[levelIndex],survey=fieldMap.draw({maze,theme,discovered,signals,exit:maze.exit,collected,player,yaw,landmarks:areaDetails?.landmarks||[],trail:walkedTrail});
 if($('mapTitle'))$('mapTitle').textContent=theme.name;
 if($('mapSubtitle'))$('mapSubtitle').textContent=theme.description;
 if($('mapProgress'))$('mapProgress').textContent=`${survey.percent}%`;
 if($('mapSignalProgress'))$('mapSignalProgress').textContent=`${collected} / 3 signals recovered`;
 if($('mapLandmarks')){
  const places=survey.landmarks.length?survey.landmarks.map(mark=>mark.name):['No landmarks charted yet'];
  $('mapLandmarks').replaceChildren(...places.map(name=>{const item=document.createElement('li');item.textContent=name;return item}));
 }
 if($('mapZoomOut'))$('mapZoomOut').disabled=survey.zoom<=1;
 if($('mapZoomIn'))$('mapZoomIn').disabled=survey.zoom>=2.5;
}

function pulse(){if(mode!=='playing'||charge<.99)return;charge=0;pulses++;pulseAge=0;pointUniforms.uOrigin.value.copy(player);lastScan=nerveNetwork.pulse(player);for(const cell of lastScan.charted)discovered.add(`${cell.x},${cell.z}`);soundscape?.pulse(lastScan,player);if(mapOpen)drawMap();const left=signals.filter(s=>!s.found);const near=left.sort((a,b)=>Math.hypot(a.x*CELL-player.x,a.z*CELL-player.z)-Math.hypot(b.x*CELL-player.x,b.z*CELL-player.z))[0];if(near){const dist=Math.round(Math.hypot(near.x*CELL-player.x,near.z*CELL-player.z));toast(`Signal echo · ${dist} m away`,3)}else toast('All signals recovered. The exit is illuminated.',3)}
function refreshMenu(){
 document.querySelectorAll('[data-level]').forEach(button=>{const i=Number(button.dataset.level),record=records[LEVELS[i].id];button.classList.toggle('selected',i===levelIndex);button.classList.toggle('done',!!record);button.setAttribute('aria-pressed',String(i===levelIndex));$('best'+i).textContent=record?'Cleared · '+formatTime(record.time):'Not yet explored'});
 $('start').textContent='Enter '+LEVELS[levelIndex].name;
 if($('menuExtent'))$('menuExtent').textContent=`${Math.round(maze.n*CELL)} m across`;
 if($('menuRoutes'))$('menuRoutes').textContent=`${maze.space.rooms.length} hidden clearings`;
 if($('menuTerrain'))$('menuTerrain').textContent=['Moss / hedge / timber','Water / reed / stone','Ash / thorn / timber'][levelIndex];
 const count=LEVELS.filter(level=>records[level.id]).length;
 $('demoProgress').textContent=count===3?'All three groves remembered.':count?`${count} of 3 groves remembered.`:'Three mazes. Three ways home.';
}
function selectLevel(index,play=false){
 if(worldLoading||index<0||index>=LEVELS.length)return;
 if(index===levelIndex){if(play){resetRun();start()}return}
 worldLoading=true;levelIndex=index;keys.clear();soundscape?.pause();
 $('loading').hidden=false;$('loading').style.opacity=1;$('loading').querySelector('p').textContent='Entering '+LEVELS[index].name+'…';
 // Let the chapter transition paint before generating the next physical area.
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  makeWorld();refreshMenu();worldLoading=false;
  if(play)start();else $('start').focus();
  $('loading').style.opacity=0;setTimeout(()=>{if(!graphicsFailed)$('loading').hidden=true},500);
 }));
}
function returnMenu(){
 mode='home';soundscape?.pause();freeMouse=false;lastMouse=null;edgeLook={x:0,y:0};keys.clear();stick={x:0,y:0};drag=null;mapOpen=false;
 document.body.classList.remove('playing','mouse-look');if(document.pointerLockElement)document.exitPointerLock();
 for(const id of ['hud','pause','pausePanel','winPanel','mapPanel','infoPanel'])$(id).hidden=true;
 $('home').hidden=false;$('homeFooter').hidden=false;$('sessionLabel').textContent='GAMEPLAY DEMO';resetRun();refreshMenu();$('start').focus();
}
function win(){
 mode='won';soundscape?.pause();freeMouse=false;document.body.classList.remove('mouse-look');if(document.pointerLockElement)document.exitPointerLock();keys.clear();
 const level=LEVELS[levelIndex],previous=records[level.id];if(!previous||elapsed<previous.time)records[level.id]={time:elapsed,pulses};
 try{localStorage.setItem('inner-roots-demo-v1.3',JSON.stringify(records))}catch{}
 const completed=LEVELS.filter(level=>records[level.id]).length,complete=completed===LEVELS.length;
 $('winPanel').hidden=false;$('winTime').textContent=formatTime(elapsed);$('winScans').textContent=pulses;
 $('winEyebrow').textContent=complete?'INNER ROOTS · DEMO COMPLETE':level.name.toUpperCase()+' · COMPLETE';
 $('winTitle').innerHTML=complete?'The forest<br><em>remembers.</em>':'A way<br><em>through.</em>';
 $('winCopy').textContent=complete?'Three groves. Nine signals. You found your way through a living forest. Thank you for playing the first Inner Roots demo.':`You recovered all three signals in ${level.name}. The roots have one less secret.`;
 $('next').textContent=levelIndex<LEVELS.length-1?'Enter '+LEVELS[levelIndex+1].name:'Return to main menu';
 $('winMenu').hidden=levelIndex===LEVELS.length-1;
 $('winFootnote').textContent=complete?'End of gameplay demo · v1.3':`${completed} of 3 groves remembered. Each has a different way home.`;
 refreshMenu();$('next').focus();tone(392,1,.04);setTimeout(()=>tone(523,1.5,.025),220);
}
function initAudio(){if(audio)return;audio=new (window.AudioContext||window.webkitAudioContext)();soundscape=createForestSoundscape(audio);if(lastScan)soundscape.pulse(lastScan,pointUniforms.uOrigin.value)}
function tone(freq,duration=.3,volume=.035){if(!audio||!soundOn)return;const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.6,audio.currentTime+duration);g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);o.connect(g).connect(soundscape.interfaceBus);o.onended=()=>{o.disconnect();g.disconnect()};o.start();o.stop(audio.currentTime+duration)}
function toggleSound(){initAudio();soundOn=!soundOn;soundscape.setEnabled(soundOn);if(soundOn)audio.resume();$('sound').querySelector('span').textContent=soundOn?'ON':'OFF';$('sound').setAttribute('aria-label',soundOn?'Mute sound':'Enable sound')}
$('sound').onclick=toggleSound;$('start').onclick=start;$('pause').onclick=()=>setPause(true);$('resume').onclick=()=>setPause(false);
$('restart').onclick=()=>{resetRun();start()};$('next').onclick=()=>{if(levelIndex<LEVELS.length-1)selectLevel(levelIndex+1,true);else returnMenu()};
$('pauseMenu').onclick=$('winMenu').onclick=returnMenu;
$('infoButton').onclick=()=>{$('infoPanel').hidden=false;$('closeInfo').focus()};$('closeInfo').onclick=()=>{$('infoPanel').hidden=true;$('infoButton').focus()};
document.querySelectorAll('[data-level]').forEach(button=>button.onclick=()=>selectLevel(Number(button.dataset.level)));
$('scan').onclick=pulse;$('mapButton').onclick=toggleMap;$('closeMap').onclick=toggleMap;
for(const [id,amount] of [['mapZoomIn',.5],['mapZoomOut',-.5]])if($(id))$(id).onclick=()=>{fieldMap.zoomBy(amount);drawMap()};
if($('mapReset'))$('mapReset').onclick=()=>{fieldMap.reset();drawMap()};
$('map').addEventListener('wheel',e=>{if(!mapOpen)return;e.preventDefault();fieldMap.zoomBy(e.deltaY<0?.25:-.25);drawMap()},{passive:false});
document.querySelector('.brand').onclick=e=>{e.preventDefault();if(mode==='playing')setPause(true);else if(mode!=='home')returnMenu()};
window.addEventListener('keydown',e=>{
 if(mode==='playing'&&['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape','Tab'].includes(e.code))e.preventDefault();
 // Menus retain native keyboard activation, with focus held in the open overlay.
 if(e.code==='Tab'&&mode!=='playing'){
  const panel=!$('infoPanel').hidden?$('infoPanel'):mapOpen?$('mapPanel'):mode==='paused'?$('pausePanel'):mode==='won'?$('winPanel'):null;
  if(panel){const buttons=[...panel.querySelectorAll('button:not([disabled]),a[href]')].filter(el=>!el.hidden),current=buttons.indexOf(document.activeElement);if(buttons.length){e.preventDefault();buttons[current<0?(e.shiftKey?buttons.length-1:0):(current+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus()}}
 }
 if(mapOpen&&['Equal','NumpadAdd','Minus','NumpadSubtract','Digit0'].includes(e.code)){e.preventDefault();if(e.code==='Digit0')fieldMap.reset();else fieldMap.zoomBy(['Equal','NumpadAdd'].includes(e.code)?.5:-.5);drawMap();return}
 if(e.code==='Escape'){if(e.repeat)return;if(!$('infoPanel').hidden){$('closeInfo').click();return}if(mapOpen)toggleMap();else if(mode==='playing')setPause(true);else if(mode==='paused')setPause(false);return}
 if(e.code==='Tab'&&mode==='playing'){setPause(true);return}
 if(e.code==='KeyM'&&!e.repeat&&(mode==='playing'||mode==='map')){toggleMap();return}
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
function frame(){if(graphicsFailed)return;requestAnimationFrame(frame);if(worldLoading){clock.getDelta();return}const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;pointUniforms.uPreview.value=mode==='home'?1:0;pointUniforms.uTime.value=t;ambient.intensity=mode==='home'?.3:.025;moon.intensity=mode==='home'?.35:.012;
 if(mode==='playing'){
  if(freeMouse){yaw-=edgeLook.x*dt*1.6;pitch=THREE.MathUtils.clamp(pitch-edgeLook.y*dt*.8,-1.32,1.32)}
  elapsed+=dt;charge=Math.min(1,charge+dt/PULSE_RECHARGE);pulseAge+=dt;if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('visible')}
  const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-stick.y;
  const strafe=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+stick.x;const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?3.6:2.35)*dt/Math.max(1,Math.hypot(forward,strafe));
  if(keys.has('ArrowLeft')||keys.has('KeyQ'))yaw+=dt*1.6;if(keys.has('ArrowRight')||keys.has('KeyE'))yaw-=dt*1.6;
  const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*strafe)*speed,dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*strafe)*speed;
  if(walkable(maze,player.x+dx,player.z))player.x+=dx;if(walkable(maze,player.x,player.z+dz))player.z+=dz;
  const moved=Math.hypot(player.x-lastFoot.x,player.z-lastFoot.z);footstep+=moved;lastFoot.copy(player);if(footstep>.9){footstep=0;tone(75+Math.random()*25,.1,.018);reveal(1.1);walkedTrail.push({x:player.x,z:player.z});if(walkedTrail.length>5000)walkedTrail.splice(0,1000)}
  player.y=1.65+terrainHeight(player.x,player.z)+(moved>.001?Math.sin(t*10)*.025:Math.sin(t*1.4)*.008);camera.position.copy(player);camera.rotation.set(pitch,yaw,0);
  for(const s of signals){if(!s.found&&Math.hypot(player.x-s.x*CELL,player.z-s.z*CELL)<1.2){s.found=true;collected++;s.group.traverse(o=>{if(o.isMesh)o.visible=false});s.light.intensity=0;updateRelics();tone(620,.8,.06);toast(collected===3?'All signals recovered. Find the illuminated exit.':`Signal recovered · ${collected} of 3`,5);if(mapOpen)drawMap()}}
  if(Math.hypot(player.x-maze.exit.x*CELL,player.z-maze.exit.z*CELL)<1.2){if(collected===3)win();else if(toastTimer<=0)toast('The exit needs all three signals.',4)}
  $('timer').textContent=formatTime(elapsed);$('charge').style.width=`${charge*100}%`;$('scanText').textContent=charge>=.99?'Pulse ready':`Recharging ${Math.ceil((1-charge)*PULSE_RECHARGE)}s`;
  let deg=((yaw*-180/Math.PI)%360+360)%360;const dirs=['N','NE','E','SE','S','SW','W','NW'];$('bearing').textContent=`${dirs[Math.round(deg/45)%8]} · ${Math.round(deg)}°`;if(mapOpen)drawMap();
 }else if(mode==='home'){
  camera.position.set(player.x,1.75,player.z);camera.rotation.set(-.03+Math.sin(t*.12)*.015,yaw+.14+Math.sin(t*.1)*.1,0);pulseAge+=dt;
 }
 flashlight.update(dt,t,keys.has('KeyW')||keys.has('KeyS')||keys.has('KeyA')||keys.has('KeyD')||keys.has('ArrowUp')||keys.has('ArrowDown')||Math.hypot(stick.x,stick.y)>.1,mode);
 const direction=new THREE.Vector3();camera.getWorldDirection(direction);pointUniforms.uEye.value.copy(camera.position);pointUniforms.uDirection.value.copy(direction);pointUniforms.uPulse.value=pulseAge;forestSurfaces.visible=pulseAge<=PULSE_DURATION;nerveNetwork.setActive(pulseAge<=PULSE_DURATION);
 soundscape?.update({age:pulseAge,active:mode==='playing',position:camera.position,forward:direction});
 // Scans reveal a moving band on actual surfaces; ambient light stays dark.
 updateLandmarks(signals,gate,t,collected);areaDetails?.update(t,pulseAge);
 for(const p of particles){p.mesh.position.y+=Math.sin(t+p.phase)*dt*.05;p.mesh.material.opacity=.25+Math.sin(t*1.5+p.phase)*.2}
 renderer.render(scene,camera);
}
function graphicsFailure(){
 if(graphicsFailed)return;graphicsFailed=true;mode='error';keys.clear();soundscape?.pause();
 document.body.classList.remove('mouse-look');if(document.pointerLockElement)document.exitPointerLock();
 canvas.hidden=true;$('loading').hidden=false;$('loading').style.opacity=1;
 $('loading').innerHTML='<img src="icon.svg" alt="" width="58" height="76"><p>The forest lost its graphics connection.<br>Reload to try again.</p><button class="text-button" id="reloadGraphics">Reload the forest</button>';
 $('reloadGraphics').onclick=()=>location.reload();$('reloadGraphics').focus();
}
canvas.addEventListener('webglcontextlost',graphicsFailure);
renderer.debug.onShaderError=(gl,program)=>{console.error('Inner Roots: graphics program unavailable.',gl.getProgramInfoLog(program)||'The browser returned no diagnostic.');graphicsFailure()};
const linkedLevel=LEVELS.findIndex(level=>level.id===new URLSearchParams(location.search).get('maze'));if(linkedLevel>=0)levelIndex=linkedLevel;
makeWorld();refreshMenu();requestAnimationFrame(()=>{$('loading').style.opacity=0;setTimeout(()=>{if(!graphicsFailed)$('loading').hidden=true},550);frame()});
