import * as THREE from './vendor/three.module.js';
import {CELL,random} from './maze.js?v=1.2.0-demo.4';

// The relics and the way out belong to the same root system as the forest.
// Merge their static pieces by material, so the extra silhouette costs little.
function joined(parts,material,parent,shadows=true){
 const attributes={position:[],normal:[],uv:[]};
 for(const source of parts){
  const geometry=source.index?source.toNonIndexed():source;
  for(const name of Object.keys(attributes)){
   const values=geometry.getAttribute(name).array;
   for(let i=0;i<values.length;i++)attributes[name].push(values[i]);
  }
  if(geometry!==source)geometry.dispose();source.dispose();
 }
 const geometry=new THREE.BufferGeometry();
 for(const [name,values]of Object.entries(attributes))geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,name==='uv'?2:3));
 const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=shadows;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

function placed(geometry,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){
 const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(sx,sy,sz));
 return geometry.applyMatrix4(matrix);
}

function stone(r){
 const geometry=new THREE.IcosahedronGeometry(1,1),position=geometry.attributes.position;
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
  // Position-based wear keeps duplicated face vertices joined.
  const wear=1+.07*Math.sin(x*13+y*6)+.05*Math.sin(z*11-y*9);
  position.setXYZ(i,x*wear,y*wear,z*wear);
 }
 geometry.computeVertexNormals();return geometry;
}

function root(points,radius,segments=16,endScale=.38){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),geometry=new THREE.TubeGeometry(curve,segments,radius,7,false),position=geometry.attributes.position;
 const centre=new THREE.Vector3(),vertex=new THREE.Vector3();
 for(let row=0;row<=segments;row++){
  const t=row/segments,scale=THREE.MathUtils.lerp(1,endScale,t)*(1+.045*Math.sin(t*23));curve.getPointAt(t,centre);
  for(let side=0;side<=7;side++){
   const i=row*8+side;vertex.fromBufferAttribute(position,i).sub(centre).multiplyScalar(scale).add(centre);position.setXYZ(i,vertex.x,vertex.y,vertex.z);
  }
 }
 geometry.computeVertexNormals();return geometry;
}

function unique(material){material.userData.unique=true;return material}

export function createSignals(world,maze,height,materials,theme){
 const r=random((theme.seed||maze.seed)+901);
 return maze.targets.map((target,index)=>{
  const group=new THREE.Group(),stones=[],roots=[],cracks=[];
  group.position.set(target.x*CELL,height(target.x*CELL,target.z*CELL),target.z*CELL);group.rotation.y=r()*Math.PI*2;world.add(group);
  // Two broken faces leave a narrow hollow around a living seed.
  stones.push(placed(stone(r),-.205,.71,.005,.185,.77,.265,.035,-.13,-.055));
  stones.push(placed(stone(r),.18,.61,-.015,.16,.65,.25,-.08,.18,.07));
  stones.push(placed(stone(r),-.01,.13,.015,.45,.18,.37,.03,r(),.08));
  for(let i=0;i<7;i++){
   const angle=r()*Math.PI*2,distance=.36+r()*.23,s=.055+r()*.095;
   stones.push(placed(stone(r),Math.cos(angle)*distance,.035,Math.sin(angle)*distance,s*1.4,s*.6,s,r(),r(),r()));
  }
  for(let i=0;i<5;i++){
   const angle=i/5*Math.PI*2+.35,side=Math.cos(angle),back=Math.sin(angle);
   roots.push(root([[side*.74,.015,back*.68],[side*.43,.06,back*.38],[side*.27,.27,back*.25],[side*.23,.64,back*.22],[side*.15,.93+r()*.32,back*.2]],.055+r()*.015,19,.22));
  }
  roots.push(root([[-.27,.22,.22],[-.19,.45,.28],[.12,.62,.25],[.22,.89,.13],[.19,1.19,-.05]],.044,20,.3));
  roots.push(root([[.27,.17,-.19],[.19,.52,-.26],[-.12,.76,-.25],[-.2,1.09,-.14]],.034,17,.3));
  joined(stones,materials.rock,group);joined(roots,materials.root,group);

  const warmth=new THREE.Color('#f2c88b');if(theme.id==='cinder')warmth.set('#efae73');
  const seedMaterial=unique(new THREE.MeshStandardMaterial({color:'#715034',emissive:warmth,emissiveIntensity:1.5,roughness:.43,metalness:0}));
  const core=new THREE.Mesh(new THREE.SphereGeometry(1,12,9),seedMaterial);core.position.set(-.005,1.025,.015);core.scale.set(.065,.115,.057);core.rotation.z=-.16;group.add(core);
  const fissureMaterial=unique(new THREE.MeshBasicMaterial({color:warmth,transparent:true,opacity:.58,depthWrite:false}));
  cracks.push(root([[.006,.77,.245],[-.018,.87,.238],[.012,.97,.21],[.002,1.12,.18],[-.025,1.22,.16]],.009,20,.3));
  cracks.push(root([[.014,.94,.23],[.075,.99,.25],[.12,1.06,.225]],.006,10,.1));
  cracks.push(root([[-.01,.87,-.245],[.018,.98,-.24],[-.008,1.1,-.2]],.008,13,.25));
  const ring=joined(cracks,fissureMaterial,group,false);
  const light=new THREE.PointLight(warmth,.5,3.2,2);light.position.copy(core.position);group.add(light);
  return {...target,group,core,ring,light,found:false,index};
 });
}

export function createGate(world,maze,height,materials,theme){
 const gate=new THREE.Group(),timbers=[],roots=[],stones=[],r=random((theme.seed||maze.seed)+1409);
 gate.position.set(maze.exit.x*CELL,height(maze.exit.x*CELL,maze.exit.z*CELL),maze.exit.z*CELL);
 // Face the incoming corridor, including exits reached from the side.
 const approaches=[[-1,0],[1,0],[0,-1],[0,1]].filter(([dx,dz])=>maze.grid[maze.exit.z+dz]?.[maze.exit.x+dx]===0);
 approaches.sort((a,b)=>maze.dist[maze.exit.z+a[1]][maze.exit.x+a[0]]-maze.dist[maze.exit.z+b[1]][maze.exit.x+b[0]]);
 if(approaches[0]?.[0])gate.rotation.y=Math.PI/2;
 world.add(gate);
 timbers.push(root([[-1.04,-.12,.02],[-1.01,.6,.055],[-.91,1.31,-.035],[-.99,2.02,.08],[-.72,2.64,.03],[-.44,2.87,-.015]],.2,28,.49));
 timbers.push(root([[1.06,-.11,-.03],[1.02,.57,.03],[.94,1.27,.09],[1.03,2.04,.015],[.76,2.59,-.08],[.55,2.82,-.04]],.17,27,.49));
 timbers.push(root([[-1.01,2.35,.05],[-.64,2.57,-.025],[-.12,2.68,.035],[.41,2.6,-.035],[.92,2.45,.02],[1.14,2.35,-.03]],.145,25,.32));
 timbers.push(root([[-.99,1.88,.04],[-1.24,2.07,.01],[-1.4,2.42,-.06]],.075,13,.12));
 timbers.push(root([[.95,1.66,.08],[1.25,1.88,.015],[1.35,2.08,-.03]],.055,13,.1));
 for(const side of [-1,1]){
  roots.push(root([[side*1.01,.05,.22],[side*.93,.54,.2],[side*1.05,1.04,.12],[side*.86,1.5,-.02],[side*.99,1.96,-.08],[side*.76,2.51,.04]],.066,28,.18));
  for(let i=0;i<3;i++){
   const z=(i-1)*.4;
   roots.push(root([[side*1.03,.32,.03],[side*1.16,.08,z],[side*1.43,.025,z*1.6],[side*1.64,.005,z*1.85]],.07,13,.1));
  }
 }
 roots.push(root([[-1.02,2.39,.16],[-.49,2.63,.16],[.05,2.55,.18],[.58,2.59,.13],[.97,2.37,.12]],.043,25,.4));
 for(let i=0;i<11;i++){
  const side=i%2?-1:1,s=.07+r()*.17;
  stones.push(placed(stone(r),side*(.94+r()*.42),.035,(r()-.5)*1.1,s*1.2,s*.55,s,r(),r()*3,r()));
 }
 joined(timbers,materials.bark,gate);joined(roots,materials.root,gate);joined(stones,materials.rock,gate);

 const veilMaterial=unique(new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:true,
  uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{uTime:{value:0},uOpen:{value:0},uTint:{value:new THREE.Color(theme.scan).lerp(new THREE.Color('#e4d5ac'),.45)}}]),
  vertexShader:`varying vec2 vUv;
   #include <fog_pars_vertex>
   void main(){vUv=uv;vec3 p=position;p.z+=sin(uv.x*13.+uv.y*3.)*.035;vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
   }`,
  fragmentShader:`uniform float uTime;uniform float uOpen;uniform vec3 uTint;varying vec2 vUv;
   #include <fog_pars_fragment>
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(a),hash(a+vec2(1.,0.)),f.x),mix(hash(a+vec2(0.,1.)),hash(a+vec2(1.,1.)),f.x),f.y);}
   void main(){
    float drift=uTime*.035,warp=noise(vec2(vUv.y*4.-drift,vUv.x*2.))*1.7;
    float strands=pow(.5+.5*sin(vUv.x*38.+warp),7.);
    float grain=noise(vec2(vUv.x*15.,vUv.y*5.+drift));
    float sides=smoothstep(0.,.16,vUv.x)*(1.-smoothstep(.84,1.,vUv.x));
    float ends=smoothstep(0.,.1,vUv.y)*(1.-smoothstep(.73,1.,vUv.y));
    float alpha=sides*ends*(.15+strands*.5+grain*.26)*(.028+uOpen*.22);
    gl_FragColor=vec4(uTint,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
   }`
 }));
 const portal=new THREE.Mesh(new THREE.PlaneGeometry(1.76,2.52,12,12),veilMaterial);portal.position.set(0,1.28,-.075);gate.add(portal);
 const light=new THREE.PointLight(new THREE.Color(theme.scan).lerp(new THREE.Color('#e8d9ac'),.5),.18,7.5,1.7);light.position.set(0,1.7,.05);gate.add(light);
 gate.userData.portal=portal;gate.userData.light=light;gate.userData.open=0;return gate;
}

export function updateLandmarks(signals,gate,t,collected){
 for(const signal of signals){
  if(signal.found)continue;
  const breath=Math.sin(t*1.13+signal.index*2.7)*.5+.5,flutter=Math.sin(t*3.7+signal.index)*.025;
  signal.core.material.emissiveIntensity=1.35+breath*.28;
  signal.ring.material.opacity=.44+breath*.13;
  signal.light.intensity=.42+breath*.08+flutter;
 }
 if(!gate)return;
 const state=gate.userData,dt=Math.min(.1,Math.max(0,t-(state.lastTime??t)));state.lastTime=t;
 state.open=THREE.MathUtils.lerp(state.open,collected>=3?1:0,1-Math.exp(-dt*1.7));
 state.portal.material.uniforms.uTime.value=t;state.portal.material.uniforms.uOpen.value=state.open;
 state.light.intensity=.18+state.open*(7.3+Math.sin(t*.8)*.24);
}
