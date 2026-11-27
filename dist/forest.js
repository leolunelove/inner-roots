import * as THREE from './vendor/three.module.js';
import {random,CELL,sampleTrail,pathClearance,hedgeDensity} from './maze.js?v=1.2.0-demo.4';
import {scanFieldGLSL} from './scan-field.js?v=1.2.0-demo.4';
import {treeMotionGLSL,applyTreeMotionShader,createTreeReactions} from './tree-motion.js?v=1.2.0-demo.4';

const atlas=new THREE.TextureLoader().load('./assets/forest-materials-v2.png');
atlas.colorSpace=THREE.SRGBColorSpace;
atlas.anisotropy=8;
export {atlas as forestAtlas};
const leafCanvas=document.createElement('canvas');
leafCanvas.width=128;leafCanvas.height=256;
const lc=leafCanvas.getContext('2d');
const gradient=lc.createLinearGradient(22,0,110,0);
gradient.addColorStop(0,'#4d633b');gradient.addColorStop(.46,'#a6b477');gradient.addColorStop(.51,'#728b4e');gradient.addColorStop(1,'#3e5733');
lc.fillStyle=gradient;lc.beginPath();lc.moveTo(64,4);lc.bezierCurveTo(3,68,5,172,64,249);lc.bezierCurveTo(113,164,125,71,64,4);lc.fill();
lc.strokeStyle='#b2bd8580';lc.lineWidth=1.4;lc.beginPath();lc.moveTo(64,245);lc.quadraticCurveTo(56,116,64,8);lc.stroke();
for(let i=1;i<13;i++){const y=22+i*16,w=Math.sin(y/256*Math.PI)*43;lc.lineWidth=.6;lc.beginPath();lc.moveTo(62,y+17);lc.quadraticCurveTo(62-w*.6,y+8,62-w,y-10);lc.moveTo(62,y+17);lc.quadraticCurveTo(62+w*.6,y+8,62+w,y-10);lc.stroke()}
// Fine mottling and imperfect edges keep close leaves from reading as plastic.
lc.globalCompositeOperation='source-atop';
const leafRandom=random(581);
for(let i=0;i<1900;i++){
 lc.fillStyle=i%3?'rgba(18,31,12,.09)':'rgba(210,205,151,.10)';
 lc.fillRect(leafRandom()*128,leafRandom()*256,.4+leafRandom()*1.7,.5+leafRandom()*2.6);
}
lc.globalCompositeOperation='source-over';
const leafTexture=new THREE.CanvasTexture(leafCanvas);leafTexture.colorSpace=THREE.SRGBColorSpace;
// A twig with several small leaves, rather than one oversized leaf per card.
const sprigCanvas=document.createElement('canvas');sprigCanvas.width=sprigCanvas.height=256;
const sc=sprigCanvas.getContext('2d'),sprigRandom=random(8471);
sc.strokeStyle='#68604a';sc.lineWidth=1.5;
sc.beginPath();sc.moveTo(124,255);sc.bezierCurveTo(145,171,103,84,137,9);sc.stroke();
// Staggered lateral shoots and unequal leaf sizes avoid a repeated chevron.
for(let i=0;i<12;i++){
 const side=i%2?-1:1,y=231-i*17+(sprigRandom()-.5)*14,x=126+Math.sin(y*.024)*9;
 const angle=side*(.65+sprigRandom()*.65),length=45+sprigRandom()*36,width=23+sprigRandom()*17;
 const tipX=x+Math.sin(angle)*length*.43,tipY=y-Math.cos(angle)*length*.43;
 sc.beginPath();sc.moveTo(x,y);sc.quadraticCurveTo(x+side*10,y-7,tipX,tipY);sc.stroke();
 sc.save();sc.translate(tipX,tipY);sc.rotate(angle+(sprigRandom()-.5)*.55);
 sc.drawImage(leafCanvas,-width/2,-length*.9,width,length);sc.restore();
}
const sprigPixels=sc.getImageData(0,0,256,256);
for(let i=0;i<sprigPixels.data.length;i+=4){
 const d=sprigPixels.data,luma=d[i]*.3+d[i+1]*.5+d[i+2]*.2;
 d[i]=d[i]*.3+luma*.68;d[i+1]=d[i+1]*.3+luma*.7;d[i+2]=d[i+2]*.3+luma*.52;
}
sc.putImageData(sprigPixels,0,0);
const sprigTexture=new THREE.CanvasTexture(sprigCanvas);sprigTexture.colorSpace=THREE.SRGBColorSpace;sprigTexture.anisotropy=4;
// Layered shadowed leaves fill the shrub interior, including at grazing angles.
const hedgeCanvas=document.createElement('canvas');hedgeCanvas.width=hedgeCanvas.height=512;
const hc=hedgeCanvas.getContext('2d'),hr=random(3197);
hc.fillStyle='#19251a';hc.fillRect(0,0,512,512);
for(let i=0;i<1600;i++){
 const x=hr()*512,y=hr()*512,w=12+hr()*16,len=22+hr()*32;
 hc.save();hc.translate(x,y);hc.rotate(hr()*Math.PI*2);hc.globalAlpha=.6+hr()*.4;
 hc.shadowColor='#040b06';hc.shadowBlur=3;hc.shadowOffsetY=2;
 hc.drawImage(leafCanvas,-w/2,-len/2,w,len);hc.restore();
}
const hedgeTexture=new THREE.CanvasTexture(hedgeCanvas);hedgeTexture.colorSpace=THREE.SRGBColorSpace;hedgeTexture.anisotropy=4;


function revealMaterial(material,uniforms,kind=-1,treeMotion=false){
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  if(treeMotion)applyTreeMotionShader(shader,uniforms);
  const trailVarying=kind===0?'attribute float aTrailWear; varying float vTrailWear;\n':'';
  shader.vertexShader=trailVarying+'varying vec3 vForestWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   vec4 forestPosition=vec4(transformed,1.0);
   #ifdef USE_INSTANCING
    forestPosition=instanceMatrix*forestPosition;
   #endif
   vForestWorld=(modelMatrix*forestPosition).xyz;
   ${kind===0?'vTrailWear=aTrailWear;':''}`);
  shader.fragmentShader=`
   varying vec3 vForestWorld;
   ${kind===0?'varying float vTrailWear;':''}
   uniform float uPreview;uniform vec3 uEye;uniform vec3 uDirection;
   uniform float uPulse;uniform vec3 uOrigin;uniform float uTime;
   ${scanFieldGLSL}
   float forestNoise(vec3 p){return sin(p.x*1.73+sin(p.z*2.13))*sin(p.z*1.27+p.y*.63);}
   `+shader.fragmentShader;
  if(kind>=0)shader.fragmentShader=shader.fragmentShader.replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\n'+`vec4 forestSample(vec2 uv,vec2 quadrant){return texture2D(map,fract(uv)*.493+quadrant+.0035);}
   vec4 forestTriplanar(vec3 p,vec2 q){vec3 n=abs(normalize(cross(dFdx(p),dFdy(p))));n=pow(n,vec3(5.));n/=max(n.x+n.y+n.z,.001);return forestSample(p.zy,q)*n.x+forestSample(p.xz,q)*n.y+forestSample(p.xy,q)*n.z;}`);
  // Atlas sampling stays inside each tile, including when the material repeats.
  if(kind>=0){
   let sampling=kind===0?`vec4 litter=forestTriplanar(vForestWorld*.43,vec2(0.,.5));
    vec4 moss=forestTriplanar(vForestWorld*.51,vec2(0.));
    float mossMix=smoothstep(.12,1.4,vForestWorld.y)*(.64+.22*forestNoise(vForestWorld*1.7))*(1.-vTrailWear*.8);
    vec2 soilUV=vec2(.5)+(fract(vForestWorld.xz*.36)-.5)*.20;
    vec4 packedSoil=mix(forestSample(soilUV,vec2(0.,.5)),forestSample(soilUV.yx+vec2(.19,.31),vec2(0.,.5)),.35)*vec4(.78,.75,.69,1.);
    vec4 trail=mix(litter,packedSoil,vTrailWear*.85);
    float damp=.5+.5*forestNoise(vForestWorld*.43);
    trail.rgb*=1.-vTrailWear*damp*.17;
    vec4 forestAlbedo=mix(trail,moss,mossMix);`:kind===4?`vec4 forestAlbedo=forestTriplanar(vForestWorld*2.1,vec2(0.));`:kind===1?`vec4 forestAlbedo=forestSample(vec2(vMapUv.x*1.5,vForestWorld.y*.34),vec2(.5,.5));`:kind===3?`vec4 forestAlbedo=forestSample(vec2(vMapUv.y*.8,vMapUv.x*2.8),vec2(.5,.5));`:`vec4 forestAlbedo=forestTriplanar(vForestWorld*.58,vec2(.5,0.));`;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',sampling+'\ndiffuseColor*=forestAlbedo;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    float forestRelief=dot(forestAlbedo.rgb,vec3(.3,.5,.2))*(1.-wetInk*.94);
    normal=normalize(normal-vec3(dFdx(forestRelief)*3.5,dFdy(forestRelief)*3.5,0.));`);
  }
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   ${kind===0?'roughnessFactor=mix(.97,.64,vTrailWear*.7);':''}
   TraceField trace=traceField(vForestWorld,uOrigin,uPulse);
   vec3 uncoatedAlbedo=diffuseColor.rgb;
   float wetInk=(1.-trace.ink)*trace.activity;
   roughnessFactor=mix(roughnessFactor,.075+trace.grain*.04,wetInk);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.003,.006,.004),wetInk*.99);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   float meniscus=wetInk*.025+trace.edge*trace.activity*.045;
   normal=normalize(normal-vec3(dFdx(meniscus)*9.,dFdy(meniscus)*9.,0.));
  `);
  if(kind===-2)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>\n normal=normalize(normal+vec3(sin(vForestWorld.x*9.+uTime*.6)*.07,sin(vForestWorld.z*12.-uTime*.4)*.06,0.));`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   float rake=.42+.58*max(0.,dot(normal,normalize(vec3(-.2,.65,1.))));
   vec3 exposed=outgoingLight+diffuseColor.rgb*rake*uScanTint*.9;
   float film=mix(.012,1.,pow(trace.ink,1.55));
   vec3 wetReflection=(reflectedLight.directSpecular+reflectedLight.indirectSpecular)*wetInk*.9;
   outgoingLight=mix(outgoingLight,exposed*film+wetReflection,trace.activity);
   float skim=pow(1.-abs(dot(normal,normalize(vViewPosition))),2.);
   outgoingLight+=uScanTint*.032*trace.edge*trace.activity*(.35+skim);
   ${kind===0?`vec2 veinUV=(vForestWorld.xz+vec2(1.85))/uForestSize;
    float buriedVein=texture2D(uVeinMap,veinUV).r;
    float swelling=pow(buriedVein,max(.32,.82-trace.head*.45));
    float tissue=(.22+trace.head*2.7)*trace.activity*mix(.6,1.,trace.ink);
    outgoingLight+=(uncoatedAlbedo*2.6+vec3(.055))*uVeinTint*swelling*tissue;
   `:''}
   #include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=>`forest-buried-veins-liquid-demo-v12-${kind}-${treeMotion}`;
 return material;
}

export function createForestMaterials(uniforms){
 const terrain=revealMaterial(new THREE.MeshStandardMaterial({map:atlas,color:'#e5dece',vertexColors:true,roughness:.94}),uniforms,0);
 const bark=revealMaterial(new THREE.MeshStandardMaterial({map:atlas,color:'#b9b5a6',roughness:1}),uniforms,1);
 const root=revealMaterial(new THREE.MeshStandardMaterial({map:atlas,color:'#756044',roughness:1}),uniforms,3);
 const rock=revealMaterial(new THREE.MeshStandardMaterial({map:atlas,color:'#aaa793',roughness:.95}),uniforms,2);
 const foliage=revealMaterial(new THREE.MeshStandardMaterial({map:leafTexture,alphaTest:.36,side:THREE.DoubleSide,roughness:.84}),uniforms);
 const canopy=revealMaterial(new THREE.MeshStandardMaterial({map:leafTexture,alphaTest:.36,side:THREE.DoubleSide,roughness:.9,color:'#819269'}),uniforms);
 const twig=revealMaterial(new THREE.MeshStandardMaterial({color:'#4e3e2d',roughness:1}),uniforms);
 const water=revealMaterial(new THREE.MeshStandardMaterial({color:'#456a68',transparent:true,opacity:.34,roughness:.17,metalness:.3,depthWrite:false}),uniforms,-2);
 const hedge=revealMaterial(new THREE.MeshStandardMaterial({map:hedgeTexture,color:'#78915c',roughness:.96}),uniforms,4);
 const hedgeLeaf=revealMaterial(new THREE.MeshStandardMaterial({map:sprigTexture,alphaTest:.4,side:THREE.DoubleSide,color:'#829c66',roughness:.9}),uniforms);
 return {terrain,bark,root,rock,foliage,canopy,twig,water,hedge,hedgeLeaf};
}

function instance(world,geometry,material,matrices,shadows=false,motion=null,partition=true){
 // Bound each grove section separately so the view and flashlight shadow camera
 // can cull the rest of a large maze instead of drawing every tree and leaf.
 if(partition&&matrices.length>200){
  const cells=new Map();
  matrices.forEach((matrix,i)=>{
   const key=`${Math.floor(matrix.elements[12]/9)},${Math.floor(matrix.elements[14]/9)}`;
   if(!cells.has(key))cells.set(key,{matrices:[],ids:[]});
   const cell=cells.get(key);cell.matrices.push(matrix);if(motion)cell.ids.push(motion.ids[i]);
  });
  const group=new THREE.Group();world.add(group);
  for(const cell of cells.values())instance(group,geometry,material,cell.matrices,shadows,motion?{...motion,ids:cell.ids}:null,false);
  return group;
 }
 if(!matrices.length)return;
 if(motion){
  if(geometry.hasAttribute('aTreeId'))geometry=geometry.clone();
  geometry.setAttribute('aTreeId',new THREE.InstancedBufferAttribute(new Float32Array(motion.ids),1));
  material=revealMaterial(material.clone(),motion.uniforms,motion.kind,true);material.userData.unique=true;
 }
 const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);
 matrices.forEach((matrix,i)=>{mesh.setMatrixAt(i,matrix);if(matrix.forestColor)mesh.setColorAt(i,matrix.forestColor)});
 if(motion&&shadows){
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:material.map,alphaTest:material.alphaTest,side:material.side});
  depth.onBeforeCompile=shader=>applyTreeMotionShader(shader,motion.uniforms);
  depth.customProgramCacheKey=()=>`tree-reaction-depth-v1`;
  mesh.customDepthMaterial=depth;
 }
 mesh.castShadow=shadows;mesh.receiveShadow=true;world.add(mesh);return mesh;
}

export function buildForest(world,maze,height,materials,uniforms,theme){
 const r=random(maze.seed+53),extent=maze.n*CELL,half=extent/2-CELL/2;
 function trailWearAt(x,z){
  const sample=sampleTrail(maze,x,z),across=sample.distance/Math.max(.01,sample.radius);
  return 1-THREE.MathUtils.smoothstep(across,.18,.8);
 }
 const terrain=new THREE.PlaneGeometry(extent,extent,240,240);
 terrain.rotateX(-Math.PI/2);terrain.translate(half,0,half);
 const pos=terrain.attributes.position,colors=[],wear=[];
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),z=pos.getZ(i),h=height(x,z);pos.setY(i,h);
  const variation=.85+.12*Math.sin(x*.47+z*.72)+r()*.05;
  colors.push(variation,variation,variation);wear.push(trailWearAt(x,z));
 }
 terrain.setAttribute('aTrailWear',new THREE.Float32BufferAttribute(wear,1));
 terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();
 const floor=new THREE.Mesh(terrain,materials.terrain);floor.castShadow=true;floor.receiveShadow=true;world.add(floor);

 const trunks=[],branches=[],roots=[],rocks=[],canopy=[],twigs=[],branchOwners=[],rootOwners=[],canopyOwners=[];
 const barkGeo=new THREE.CylinderGeometry(.16,.34,1,11,12);
 const bp=barkGeo.attributes.position;
 for(let i=0;i<bp.count;i++){
  const x=bp.getX(i),y=bp.getY(i),z=bp.getZ(i),a=Math.atan2(z,x);
  const ridge=1+Math.sin(a*11+y*9)*.08+Math.sin(a*7-y*13)*.04;
  bp.setXYZ(i,x*ridge+Math.sin(y*4)*.045,y,z*ridge+Math.sin(y*5+1)*.04);
 }
 barkGeo.computeVertexNormals();
 const rockGeo=new THREE.IcosahedronGeometry(1,2),rp=rockGeo.attributes.position;
 for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),v=1+.16*Math.sin(x*5.3+z*3.1)+.1*Math.sin(y*7.7-x*2);rp.setXYZ(i,x*v,y*v,z*v)}rockGeo.computeVertexNormals();
 const o=new THREE.Object3D();
 const put=(list,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0)=>{o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.rotation.set(rx,ry,rz);o.updateMatrix();list.push(o.matrix.clone())};
 for(let z=0;z<maze.n;z++)for(let x=0;x<maze.n;x++){
  if(!maze.grid[z][x])continue;
  const cx=x*CELL,cz=z*CELL;
  for(let j=0;j<theme.treesPerCell;j++){
   const tx=cx+(r()-.5)*2.4,tz=cz+(r()-.5)*2.4,base=height(tx,tz)-.25,h=theme.trunkMin+r()*theme.trunkRange;
   const thick=.68+r()*.72+(r()>.87?.65:0);
   if(pathClearance(maze,tx,tz)>-.52)continue;
   if(hedgeDensity(maze,tx,tz)>.65&&j>0)continue;
   const tree=trunks.length,axis=new THREE.Vector3((r()-.5)*.11,1,(r()-.5)*.11).normalize();
   const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
   rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),r()*Math.PI*2));
   const bottom=new THREE.Vector3(tx,base,tz),centre=bottom.clone().addScaledVector(axis,h/2);
   const trunk=new THREE.Matrix4().compose(centre,rotation,new THREE.Vector3(thick,h,thick));trunks.push(trunk);
   const segment=(list,owners,start,end,width,endWidth=width)=>{
    const direction=end.clone().sub(start);o.position.copy(start).add(end).multiplyScalar(.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
    o.scale.set(width,direction.length(),endWidth);o.updateMatrix();list.push(o.matrix.clone());owners.push(tree);
   };
   // Unequal, weight-bearing buttresses emerge from the buried trunk base.
   for(let k=0;k<5;k++){
    const angle=k/5*Math.PI*2+r()*.7,length=(.55+r()*.9)*Math.sqrt(thick);
    const endX=tx+Math.cos(angle)*length,endZ=tz+Math.sin(angle)*length;
    const start=bottom.clone().addScaledVector(axis,.22+r()*.4);
    const end=new THREE.Vector3(endX,height(endX,endZ)+.015,endZ);
    // Root geometry tapers toward its +Y end, away from the trunk.
    const mid=start.clone().lerp(end,.5);mid.y=height(mid.x,mid.z)+.06;
    segment(roots,rootOwners,start,mid,.8+r()*.4,.65);
    segment(roots,rootOwners,mid,end,.22,.18);
   }
   for(let k=0;k<4;k++){
    const angle=k*2.4+r()*1.5,length=(1.25+r()*2.15)*Math.sqrt(thick),fraction=.43+k*.105+r()*.08;
    const start=new THREE.Vector3(0,fraction-.5,0).applyMatrix4(trunk);
    const end=start.clone().add(new THREE.Vector3(Math.cos(angle)*length,.5+r()*1.5,Math.sin(angle)*length));
    segment(branches,branchOwners,start,end,.26+r()*.22);
    // Forked ends give each crown an asymmetrical, connected silhouette.
    for(let fork=0;fork<2;fork++){
     const joint=start.clone().lerp(end,.58+fork*.22),a=angle+(fork?-.7:.8);
     const tip=joint.clone().add(new THREE.Vector3(Math.cos(a)*length*.62,.4+r()*.8,Math.sin(a)*length*.62));
     segment(branches,branchOwners,joint,tip,.10+r()*.09);
     for(let u=0;u<Math.round(theme.canopyCount*.58);u++){
      const spread=r()**.6,a=r()*6.28;
      put(canopy,tip.x+Math.cos(a)*spread*1.05,tip.y+(r()-.5)*.8,tip.z+Math.sin(a)*spread*1.05,.23+r()*.18,.28+r()*.20,1,-.4-r()*1.8,r()*6.28,r()*1.2);canopyOwners.push(tree);
     }
    }
   }
  }
  for(let j=0;j<3;j++){
   const rx=cx+(r()-.5)*3,rz=cz+(r()-.5)*3,scale=.18+r()*.5;
   if(pathClearance(maze,rx,rz)>-scale*1.4)continue;
   put(rocks,rx,height(rx,rz)-scale*.35,rz,scale*1.2,scale*.75,scale,r()*3,r()*3,r()*3);
  }
 }
 const reactions=createTreeReactions(trunks,height,uniforms);
 instance(world,barkGeo,materials.bark,trunks,true,{ids:trunks.map((_,i)=>i),uniforms,kind:1});
 instance(world,barkGeo,materials.bark,branches,true,{ids:branchOwners,uniforms,kind:1});
 instance(world,new THREE.CylinderGeometry(.035,.16,1,7),materials.root,roots,false,{ids:rootOwners,uniforms,kind:3});
 // Small stone clusters collect on the trail shoulders, leaving the centre clear.
 for(let i=0;i<900;i++){
  const x=r()*extent-CELL/2,z=r()*extent-CELL/2,h=height(x,z);
  if(h>.55||trailWearAt(x,z)>.7)continue;
  const count=2+Math.floor(r()*4);
  for(let j=0;j<count;j++){
   const px=x+(r()-.5)*.4,pz=z+(r()-.5)*.4,scale=.025+r()*.105;
   put(rocks,px,height(px,pz)+scale*.12,pz,scale*1.3,scale*.6,scale,r()*3,r()*3,r()*3);
  }
 }
 instance(world,rockGeo,materials.rock,rocks,true);
 // Low, exposed roots follow the ground across selected stretches of trail.
 // They are visual surface detail; the walking lane stays unobstructed.
 for(let z=1;z<maze.n-1;z++)for(let x=1;x<maze.n-1;x++){
  if(maze.grid[z][x]||r()>.42||(x===1&&z===1))continue;
  const sides=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dz])=>maze.grid[z+dz]?.[x+dx]===1);
  if(!sides.length)continue;
  const [dx,dz]=sides[Math.floor(r()*sides.length)],cx=x*CELL,cz=z*CELL;
  const points=[],length=1.6+r()*1.1,sway=(r()-.5)*.65;
  for(let j=0;j<9;j++){
   const t=j/8,along=1.65-length*t,across=Math.sin(t*Math.PI)*sway;
   const px=cx+dx*along-dz*across,pz=cz+dz*along+dx*across;
   points.push(new THREE.Vector3(px,height(px,pz)+.025+Math.sin(t*Math.PI)*.035,pz));
  }
  const root=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.035+r()*.03,6,false),materials.root);
  root.castShadow=true;root.receiveShadow=true;world.add(root);
 }

 if(theme.id==='drowned'){
  const water=new THREE.Mesh(new THREE.PlaneGeometry(extent,extent),materials.water);water.rotation.x=-Math.PI/2;water.position.set(half,.048,half);water.receiveShadow=true;world.add(water);
  const reeds=[],heads=[];
  for(let i=0;i<1200;i++){
   const x=r()*extent-CELL/2,z=r()*extent-CELL/2,h=height(x,z),wear=trailWearAt(x,z);
   if(h>.35||wear>.5||wear<.03)continue;
   const stemHeight=.45+r()*.85;
   put(reeds,x,h+stemHeight/2,z,.01,stemHeight,.01,(r()-.5)*.16,r()*6.28,(r()-.5)*.2);
   put(heads,x,h+stemHeight,z,.025,.11,.025,0,r()*6.28,0);
  }
  instance(world,new THREE.CylinderGeometry(.6,1,1,4),materials.twig,reeds);
  instance(world,new THREE.CylinderGeometry(.7,1,1,5),materials.root,heads);
 }
 const leafGeo=new THREE.PlaneGeometry(1,1,2,3);
 const lp=leafGeo.attributes.position;
 for(let i=0;i<lp.count;i++)lp.setZ(i,Math.sin((lp.getY(i)+.5)*Math.PI)*.08+Math.abs(lp.getX(i))*.13);
 leafGeo.computeVertexNormals();instance(world,leafGeo,materials.canopy,canopy,false,{ids:canopyOwners,uniforms,kind:-1});

 // Hedges follow the very same boundary used by collision and the earth banks.
 // Opaque twig/leaf masses close the gaps; small veined leaves break the edge.
 const hedges=[],hedgeLeaves=[],hedgeStems=[];
 const hedgeGeo=new THREE.SphereGeometry(1,9,7),hp=hedgeGeo.attributes.position;
 for(let i=0;i<hp.count;i++){
  const x=hp.getX(i),y=hp.getY(i),z=hp.getZ(i),bump=1+.10*Math.sin(x*17+z*11)+.05*Math.sin(y*23-x*9);
  hp.setXYZ(i,x*bump,y*bump,z*bump);
 }
 hedgeGeo.computeVertexNormals();
 for(let z=-CELL/2+.3;z<extent-CELL/2;z+=.65)for(let x=-CELL/2+.3;x<extent-CELL/2;x+=.65){
  const cover=hedgeDensity(maze,x,z),gap=pathClearance(maze,x,z);
  if(cover<.55||gap>-.22||gap<-.72)continue;
  const base=height(x,z),top=1.4+r()*.65,bulk=.34+r()*.1,lean=(r()-.5)*.19;
  for(let lobe=0;lobe<3;lobe++){
   const cy=base+.32+lobe*(top-.52)/2,cx=x+lean*lobe,cz=z+Math.sin(lobe*2+x)*.07;
   const rx=bulk*(lobe===2?.84:1),ry=.46+r()*.09;
   // Recessed dark cores fill the interior; all foliage sits outside their surface.
   put(hedges,cx,cy,cz,rx*.62,ry*.7,rx*.62,0,r()*6.28,0);
   const count=theme.id==='cinder'?20:45;
   for(let j=0;j<count;j++){
    const angle=j*2.39996+r()*.55,v=-.85+r()*1.7,shell=Math.sqrt(1-v*v),leaf=.23+r()*.13;
    put(hedgeLeaves,cx+Math.cos(angle)*rx*shell,cy+v*ry,cz+Math.sin(angle)*rx*shell,leaf,leaf*1.16,1,(r()-.5)*1.2,Math.PI/2-angle,(r()-.5)*4.2);
   }
  }
  put(hedgeStems,x,base+top*.45,z,.025,top*.9,.025,lean,r()*6.28,lean);
  for(let j=0;j<3;j++)put(hedgeStems,x+lean,base+.45+j*.33,z,.012,.6,.012,.6+r()*.7,r()*6.28,.4);
 }
 const hedgeMesh=instance(world,hedgeGeo,materials.hedge,hedges,true);
 if(hedgeMesh)hedgeMesh.traverse(mesh=>{if(mesh.isInstancedMesh)for(let i=0;i<mesh.count;i++)mesh.setColorAt(i,new THREE.Color().setScalar(.53+r()*.23))});
 const hedgeFoliage=instance(world,new THREE.PlaneGeometry(1,1),materials.hedgeLeaf,hedgeLeaves);
 if(hedgeFoliage)hedgeFoliage.traverse(mesh=>{if(mesh.isInstancedMesh)for(let i=0;i<mesh.count;i++)mesh.setColorAt(i,new THREE.Color().setScalar(.70+r()*.40))});
 instance(world,new THREE.CylinderGeometry(.35,1,1,5),materials.twig,hedgeStems);


 // Curved fronds made from paired, veined leaflets rather than flat triangles.
 const leaflets=[],matrix=new THREE.Matrix4(),quaternion=new THREE.Quaternion();
 function leaflet(x,y,z,angle,tilt,w,len,color){
  quaternion.setFromEuler(new THREE.Euler(tilt,angle,0));matrix.compose(new THREE.Vector3(x,y,z),quaternion,new THREE.Vector3(w,len,1));
  const transform=matrix.clone();transform.forestColor=color;leaflets.push(transform);
 }
 for(let i=0;i<theme.fernCount;i++){
  const x=r()*extent-CELL/2,z=r()*extent-CELL/2,h=height(x,z);
  if(h<.18||h>2.4)continue;
  const fronds=4+Math.floor(r()*3),plantScale=.6+r()*.8;
  for(let f=0;f<fronds;f++){
   const angle=f/fronds*6.28+r()*.3,len=(.4+r()*.4)*plantScale;
   const color=new THREE.Color('#6c8147').lerp(new THREE.Color('#a6ab6b'),r()*.7);
   for(let j=1;j<11;j++){
    const t=j/11,px=x+Math.cos(angle)*len*t,pz=z+Math.sin(angle)*len*t,py=h+.06+Math.sin(t*2.4)*len*.65;
    const leafLen=(1-t)*.15*plantScale+.018;
    for(const side of [-1,1]){
     const a=angle+side*1.1;
     leaflet(px+Math.cos(a)*leafLen*.34,py,pz+Math.sin(a)*leafLen*.34,-a,-1.25,.032*plantScale*(1-t)+.008,leafLen,color);
    }
   }
  }
 }
 // Small fallen leaves and snapped twigs break up the trail's surface.
 for(let i=0;i<theme.litterCount;i++){
  const x=r()*extent-CELL/2,z=r()*extent-CELL/2,h=height(x,z);
  if(h>.5||(trailWearAt(x,z)>.6&&r()>.13))continue;
  const color=new THREE.Color('#68503b').lerp(new THREE.Color('#cba274'),r());
  leaflet(x,h+.025,z,r()*6.28,-Math.PI/2,.05+r()*.09,.10+r()*.15,color);
  if(i%4===0)put(twigs,x,h+.04,z,.012,.18+r()*.4,.012,Math.PI/2,r()*6.28,r());
 }
 // Share one curved leaf and cull patches instead of expanding every leaflet
 // into 36 vertices. This also keeps normals consistent under nonuniform scale.
 const foliageGeo=leafGeo.clone();foliageGeo.deleteAttribute('aTreeId');
 instance(world,foliageGeo,materials.foliage,leaflets);
 instance(world,new THREE.CylinderGeometry(1,1,1,4),materials.twig,twigs);

 // Fine surface points add the granular scan character without floating glow dots.
 const pp=[],pc=[],ps=[],pointOwners=[];
 for(let i=0;i<110000;i++){
  const x=r()*extent-CELL/2,z=r()*extent-CELL/2,h=height(x,z);
  pp.push(x,h+.012,z);pointOwners.push(-1);const v=.27+r()*.27;pc.push(v,v*.94,v*.8);ps.push(.004+r()*.008);
 }
 const barkPosition=barkGeo.attributes.position,barkNormal=barkGeo.attributes.normal,barkIndex=barkGeo.index;
 const pa=new THREE.Vector3(),pb=new THREE.Vector3(),pcv=new THREE.Vector3(),sample=new THREE.Vector3(),sampleNormal=new THREE.Vector3();
 for(const [tree,matrix] of trunks.entries()){
  const normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix);
  for(let i=0;i<200;i++){
   const face=Math.floor(r()*barkIndex.count/3)*3;
   const ia=barkIndex.getX(face),ib=barkIndex.getX(face+1),ic=barkIndex.getX(face+2);
   let u=r(),v=r();if(u+v>1){u=1-u;v=1-v}
   pa.fromBufferAttribute(barkPosition,ia);pb.fromBufferAttribute(barkPosition,ib);pcv.fromBufferAttribute(barkPosition,ic);
   sample.copy(pa).multiplyScalar(1-u-v).addScaledVector(pb,u).addScaledVector(pcv,v).applyMatrix4(matrix);
   sampleNormal.fromBufferAttribute(barkNormal,ia).applyNormalMatrix(normalMatrix);
   sample.addScaledVector(sampleNormal,.006);
   pp.push(sample.x,sample.y,sample.z);pointOwners.push(tree);const value=.25+r()*.18;pc.push(value*.94,value,value*.91);ps.push(.006+r()*.008);
  }
 }
 const pointGeo=new THREE.BufferGeometry();pointGeo.setAttribute('position',new THREE.Float32BufferAttribute(pp,3));pointGeo.setAttribute('color',new THREE.Float32BufferAttribute(pc,3));pointGeo.setAttribute('aSize',new THREE.Float32BufferAttribute(ps,1));pointGeo.setAttribute('aTreeId',new THREE.Float32BufferAttribute(pointOwners,1));
 const pointMaterial=new THREE.ShaderMaterial({uniforms,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`attribute float aSize;attribute float aTreeId;uniform float uPulse;${treeMotionGLSL}varying vec3 vColor;varying vec3 vWorld;void main(){vColor=color;vWorld=position+treeDisplacement(position,aTreeId,uPulse);vec4 mv=modelViewMatrix*vec4(vWorld,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*700./-mv.z,.8,2.8);}`,
  fragmentShader:`uniform float uPulse;uniform vec3 uOrigin;uniform vec3 uEye;varying vec3 vColor;varying vec3 vWorld;${scanFieldGLSL}
  void main(){float dotRadius=length(gl_PointCoord-.5);if(dotRadius>.5)discard;TraceField trace=traceField(vWorld,uOrigin,uPulse);
   float brightness=trace.head*.16+trace.reveal*trace.ink*.045;
   float mist=exp(-distance(vWorld,uEye)*.045);float alpha=brightness*(1.-smoothstep(.12,.5,dotRadius))*mist;
   vec3 tint=mix(vColor,uVeinTint,.72);gl_FragColor=vec4(tint*1.4,alpha);
  }`});
 pointMaterial.userData.unique=true;const surfacePoints=new THREE.Points(pointGeo,pointMaterial);world.add(surfacePoints);
 return {trunks,reactions,surfacePoints};
}
