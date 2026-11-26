import * as THREE from './vendor/three.module.js';
import {CELL,random} from './maze.js';
import {ARRIVAL_WINDOW,PULSE_DURATION} from './pulse-timing.js';
import {createNerveGraph,edgeTravelTime} from './nerve-graph.js';
import {forestAtlas} from './forest.js';
import {scanFieldGLSL} from './scan-field.js';
import {treeMotionGLSL} from './tree-motion.js';

export function createNervousSystem(world,maze,height,uniforms,forest){
 const {trunks,reactions}=forest,treeRoots=[];let currentTree=-1;
 const graph=createNerveGraph(maze),r=random(maze.seed+1093),size=maze.n*CELL;
 const veinCanvas=document.createElement('canvas');veinCanvas.width=veinCanvas.height=1024;
 const veinContext=veinCanvas.getContext('2d'),pixelsPerMetre=1024/size;
 veinContext.fillStyle='#000';veinContext.fillRect(0,0,1024,1024);veinContext.lineCap=veinContext.lineJoin='round';
 const positions=[],across=[],ownerA=[],ownerB=[],offsetA=[],offsetB=[],distanceA=[],distanceB=[],treeOwners=[];
 function vertex(point,widthCoordinate,a,b,ta,tb,da,db){
  positions.push(point.x,point.y,point.z);treeOwners.push(currentTree);across.push(widthCoordinate);
  ownerA.push(a);ownerB.push(b);offsetA.push(ta);offsetB.push(tb);distanceA.push(da);distanceB.push(db);
 }
 function strand(points,records,width=.08,normals=null,taper=false){
  const widthAt=t=>Math.max(.002,width*(.79+.16*Math.sin(t*5.2+points[0].x)+.09*Math.sin(t*11.3+points[0].z))*(taper?(1-THREE.MathUtils.smoothstep(t,.1,1)):.95));
  if(!normals){
   // Draw a soft buried mask, not luminous geometry above the soil.
   for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1],radius=widthAt(i/(points.length-1))*pixelsPerMetre;
    veinContext.strokeStyle='rgba(255,255,255,.75)';veinContext.shadowColor='rgba(255,255,255,.52)';veinContext.shadowBlur=radius*1.7;
    veinContext.lineWidth=Math.max(.35,radius*1.5);veinContext.beginPath();veinContext.moveTo((a.x+CELL/2)*pixelsPerMetre,(a.z+CELL/2)*pixelsPerMetre);veinContext.lineTo((b.x+CELL/2)*pixelsPerMetre,(b.z+CELL/2)*pixelsPerMetre);veinContext.stroke();
   }
   return;
  }
  const rows=[];
  for(let i=0;i<points.length;i++){
   const tangent=points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(i-1,0)]).normalize();
   const normal=normals[i],w=widthAt(i/(points.length-1)),side=new THREE.Vector3().crossVectors(tangent,normal).normalize();
   rows.push([-1,0,1].map(coordinate=>points[i].clone().addScaledVector(side,w*coordinate).addScaledVector(normal,-Math.pow(w*coordinate,2)/.44)));
  }
  for(let i=0;i<points.length-1;i++)for(let column=0;column<2;column++)for(const [row,col]of [[i,column],[i,column+1],[i+1,column],[i+1,column],[i,column+1],[i+1,column+1]])vertex(rows[row][col],col-1,...records[row]);
 }
 function groundPoint(x,z){return new THREE.Vector3(x,height(x,z)+.018,z)}
 for(const edge of graph.edges){
  const a=graph.nodes[edge.a],b=graph.nodes[edge.b],dx=b.wx-a.wx,dz=b.wz-a.wz,px=-dz/CELL,pz=dx/CELL;
  for(let vein=0;vein<1;vein++){
   const points=[],records=[],phase=edge.seed*6.28+vein*1.4;
   for(let i=0;i<=56;i++){
    const t=i/56,sway=Math.sin(t*Math.PI)*(.28*Math.sin(t*5.6+phase)+.10*Math.sin(t*13.2+phase*.7));
    points.push(groundPoint(a.wx+dx*t+px*sway,a.wz+dz*t+pz*sway));
    records.push([edge.a,edge.b,edgeTravelTime(edge,t),edge.time-edgeTravelTime(edge,t),t*CELL,(1-t)*CELL]);
   }
   strand(points,records,.105+r()*.045);
   // Small forks spread from the main nerves into the soil at different angles.
   for(let branch=0;branch<4;branch++){
    const t=.14+r()*.72,start=points[Math.round(t*56)],side=r()>.5?1:-1,length=.4+r()*1.05;
    const fork=[],times=[];
    for(let i=0;i<=24;i++){
     const u=i/24,x=start.x+px*side*length*u+dx/CELL*Math.sin(u*2.7)*.15,z=start.z+pz*side*length*u+dz/CELL*Math.sin(u*2.7)*.15;
     fork.push(groundPoint(x,z));times.push([edge.a,edge.b,edgeTravelTime(edge,t)+u*length/3.5,edge.time-edgeTravelTime(edge,t)+u*length/3.5,t*CELL+u*length,(1-t)*CELL+u*length]);
    }
    strand(fork,times,.035+r()*.03,null,true);
   }
  }
 }
 // Connect path nerves to actual tree bases, then climb the ridged bark.
 for(let tree=0;tree<trunks.length;tree++){
  const matrix=trunks[tree],centre=new THREE.Vector3().setFromMatrixPosition(matrix),node=graph.nearest(centre.x,centre.z);
  const base=height(centre.x,centre.z),distance=Math.hypot(node.wx-centre.x,node.wz-centre.z),speed=tree%2?4+(tree*.618%1)*3:4+r()*3;
  treeRoots.push({node:node.id,distance,delay:distance/speed});
  if(tree%2)continue;
  currentTree=tree;
  const roots=[],times=[];
  for(let i=0;i<=20;i++){
   const t=i/20,sway=Math.sin(t*Math.PI)*.19;
   roots.push(groundPoint(THREE.MathUtils.lerp(node.wx,centre.x,t)+sway,THREE.MathUtils.lerp(node.wz,centre.z,t)-sway));
   times.push([node.id,node.id,t*distance/speed,t*distance/speed,t*distance,t*distance]);
  }
  strand(roots,times,.075,null,true);
  const scaleY=new THREE.Vector3().setFromMatrixScale(matrix).y;
  for(let branch=0;branch<3;branch++){
   const points=[],normals=[],records=[],angle=r()*6.28,climb=3.5+r()*3.5,climbSpeed=2.4+r()*2.2;
   for(let i=0;i<=64;i++){
    const t=i/64,worldY=base+climb*t,localY=THREE.MathUtils.clamp((worldY-centre.y)/scaleY,-.5,.5);
    const a=angle+t*(branch-1)*1.1+Math.sin(t*8+angle)*.07;
    const radius=THREE.MathUtils.lerp(.34,.16,localY+.5),ridge=1+Math.sin(a*11+localY*9)*.08+Math.sin(a*7-localY*13)*.04;
    const normal=new THREE.Vector3(Math.cos(a),0,Math.sin(a)).transformDirection(matrix);
    const p=new THREE.Vector3(Math.cos(a)*radius*ridge+Math.sin(localY*4)*.045,localY,Math.sin(a)*radius*ridge+Math.sin(localY*5+1)*.04).applyMatrix4(matrix).addScaledVector(normal,.004);
    points.push(p);normals.push(normal);
    const delay=distance/speed+climb*t/climbSpeed+branch*.07;
    records.push([node.id,node.id,delay,delay,distance,distance]);
   }
   strand(points,records,.045+branch*.008,normals,true);
  }
 }
 const geometry=new THREE.BufferGeometry(),arrivals=new Float32Array(across.length).fill(20),strengths=new Float32Array(across.length);
 geometry.setAttribute('aTreeId',new THREE.Float32BufferAttribute(treeOwners,1));
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('aAcross',new THREE.Float32BufferAttribute(across,1));
 geometry.setAttribute('aArrival',new THREE.BufferAttribute(arrivals,1));geometry.setAttribute('aStrength',new THREE.BufferAttribute(strengths,1));
 const material=new THREE.ShaderMaterial({uniforms:{...uniforms,uSoilAtlas:{value:forestAtlas}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
  vertexShader:`uniform float uPulse;attribute float aTreeId;${treeMotionGLSL}attribute float aAcross;attribute float aArrival;attribute float aStrength;varying float vAcross;varying float vArrival;varying float vStrength;varying vec3 vWorld;void main(){vAcross=aAcross;vArrival=aArrival;vStrength=aStrength;vWorld=position+treeDisplacement(position,aTreeId,uPulse);gl_Position=projectionMatrix*modelViewMatrix*vec4(vWorld,1.);}`,
  fragmentShader:`uniform float uPulse;uniform vec3 uOrigin;uniform vec3 uEye;uniform sampler2D uSoilAtlas;varying float vAcross;varying float vArrival;varying float vStrength;varying vec3 vWorld;${scanFieldGLSL}
   void main(){if(uPulse<0.||uPulse>${PULSE_DURATION.toFixed(1)}||vStrength<.001)discard;float local=uPulse-vArrival;
    float arrived=smoothstep(-.09,.13,local),wake=1.-smoothstep(3.5,7.,local),head=traceBeat(local,traceNoise(vWorld*.3));
    float life=1.-smoothstep(${(PULSE_DURATION-1).toFixed(1)},${PULSE_DURATION.toFixed(1)},uPulse);float profile=exp(-pow(abs(vAcross)*(2.5-head*.75),2.));
    vec3 bark=texture2D(uSoilAtlas,fract(vec2(vWorld.x+vWorld.z,vWorld.y*.34))*.493+vec2(.5035,.5035)).rgb;
    float textureMask=.22+.78*smoothstep(.02,.23,dot(bark,vec3(.3,.5,.2)));
    float clumps=.42+.58*traceNoise(vWorld*22.);TraceField film=traceField(vWorld,uOrigin,uPulse);
    float buried=mix(.20,1.,film.ink);vec3 tissue=uVeinTint*.66*(wake*.14+head*1.2);
    float fog=exp(-distance(vWorld,uEye)*.038);gl_FragColor=vec4(tissue*textureMask*clumps,arrived*wake*life*vStrength*profile*buried*fog);
   }`}); material.userData.unique=true;world.add(new THREE.Mesh(geometry,material));

 // Cache each ground texel's attachment to the nearest branching route.
 const resolution=192,data=new Uint8Array(resolution*resolution*4),attachments=[];
 for(let z=0;z<resolution;z++)for(let x=0;x<resolution;x++){
  const wx=(x+.5)/resolution*size-CELL/2,wz=(z+.5)/resolution*size-CELL/2;
  let best=Infinity,selected=graph.edges[0],progress=0;
  for(const edge of graph.edges){const a=graph.nodes[edge.a],b=graph.nodes[edge.b],dx=b.wx-a.wx,dz=b.wz-a.wz,t=THREE.MathUtils.clamp(((wx-a.wx)*dx+(wz-a.wz)*dz)/(CELL*CELL),0,1),distance=(wx-a.wx-t*dx)**2+(wz-a.wz-t*dz)**2;if(distance<best){best=distance;selected=edge;progress=t}}
  const a=graph.nodes[selected.a],b=graph.nodes[selected.b],base=height(THREE.MathUtils.lerp(a.wx,b.wx,progress),THREE.MathUtils.lerp(a.wz,b.wz,progress));
  attachments.push({edge:selected,t:progress,d:Math.sqrt(best),base});
 }
 const veinMap=new THREE.CanvasTexture(veinCanvas);veinMap.flipY=false;veinMap.colorSpace=THREE.NoColorSpace;veinMap.minFilter=THREE.LinearMipmapLinearFilter;veinMap.magFilter=THREE.LinearFilter;
 uniforms.uVeinMap.value=veinMap;
 const map=new THREE.DataTexture(data,resolution,resolution,THREE.RGBAFormat);map.minFilter=map.magFilter=THREE.LinearFilter;map.colorSpace=THREE.NoColorSpace;map.needsUpdate=true;
 uniforms.uNerveMap.value=map;uniforms.uForestSize.value=size;
 return {
  pulse(origin){
   const {times,distances}=graph.propagate(origin);
   treeRoots.forEach(({node,distance,delay},tree)=>reactions.reach(tree,times[node]+delay,1-THREE.MathUtils.smoothstep(distances[node]+distance,14.5,17.5)));
   reactions.commit();
   for(let i=0;i<arrivals.length;i++){
    arrivals[i]=Math.min(times[ownerA[i]]+offsetA[i],times[ownerB[i]]+offsetB[i]);
    const distance=Math.min(distances[ownerA[i]]+distanceA[i],distances[ownerB[i]]+distanceB[i]);
    strengths[i]=1-THREE.MathUtils.smoothstep(distance,14.5,17.5);
   }
   geometry.attributes.aArrival.needsUpdate=true;geometry.attributes.aStrength.needsUpdate=true;
   for(let i=0;i<attachments.length;i++){
    const {edge,t,d,base}=attachments[i],arrival=Math.min(times[edge.a]+edgeTravelTime(edge,t),times[edge.b]+edge.time-edgeTravelTime(edge,t))+d/5;
    const distance=Math.min(distances[edge.a]+t*CELL,distances[edge.b]+(1-t)*CELL)+d;
    data[i*4]=Math.min(255,arrival/ARRIVAL_WINDOW*255);data[i*4+1]=THREE.MathUtils.clamp((base+.25)/4*255,0,255);
    data[i*4+2]=edge.seed*255;data[i*4+3]=(1-THREE.MathUtils.smoothstep(distance,14.5,17.5))*255;
   }
   map.needsUpdate=true;
   const charted=[];
   for(const node of graph.nodes)if(distances[node.id]<=16){charted.push(node);for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]])if(maze.grid[node.z+dz]?.[node.x+dx]===1)charted.push({x:node.x+dx,z:node.z+dz})}
   const liquid=graph.nodes.filter(node=>distances[node.id]<16).map(node=>({x:node.wx,y:height(node.wx,node.wz),z:node.wz,arrival:times[node.id],seed:(node.id*.618+.31)%1,strength:1-THREE.MathUtils.smoothstep(distances[node.id],12,17.5)}));
   return {charted,trees:reactions.soundCues(),liquid};
  },
  dispose(){map.dispose();veinMap.dispose();reactions.dispose()}
 };
}
