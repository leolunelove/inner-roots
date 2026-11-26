import * as THREE from './vendor/three.module.js';
import {random,CELL} from './maze.js';
import {scanFieldGLSL} from './scan-field.js';
import {treeMotionGLSL,applyTreeMotionShader,createTreeReactions} from './tree-motion.js';

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
const leafTexture=new THREE.CanvasTexture(leafCanvas);leafTexture.colorSpace=THREE.SRGBColorSpace;

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
    float mossMix=smoothstep(.22,2.3,vForestWorld.y)*(.6+.2*forestNoise(vForestWorld*1.7));
    vec2 soilUV=vec2(.5)+(fract(vForestWorld.xz*.36)-.5)*.20;
    vec4 packedSoil=forestSample(soilUV,vec2(0.,.5))*vec4(.78,.75,.69,1.);
    vec4 trail=mix(litter,packedSoil,vTrailWear*.85);
    float damp=.5+.5*forestNoise(vForestWorld*.43);
    trail.rgb*=1.-vTrailWear*damp*.17;
    vec4 forestAlbedo=mix(trail,moss,mossMix);`:kind===1?`vec4 forestAlbedo=forestSample(vec2(vMapUv.x*1.5,vForestWorld.y*.34),vec2(.5,.5));`:kind===3?`vec4 forestAlbedo=forestSample(vec2(vMapUv.y*.8,vMapUv.x*2.8),vec2(.5,.5));`:`vec4 forestAlbedo=forestTriplanar(vForestWorld*.58,vec2(.5,0.));`;
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
 material.customProgramCacheKey=()=>`forest-buried-veins-liquid-demo-v10-${kind}-${treeMotion}`;
 return material;
}

export function createForestMaterials(uniforms){
 const terrain=revealMaterial(new THREE.MeshStandardMaterial({map:atlas,color:'#e5dece',vertexColors:true,roughness:.94}),uniforms,0);
 const bark=revealMaterial(new THREE.MeshStandardMaterial({map:atlas,color:'#b9b5a6',roughness:1}),uniforms,1);
 const root=revealMaterial(new THREE.MeshStandardMaterial({map:atlas,color:'#756044',roughness:1}),uniforms,3);
 const rock=revealMaterial(new THREE.MeshStandardMaterial({map:atlas,color:'#aaa793',roughness:.95}),uniforms,2);
 const foliage=revealMaterial(new THREE.MeshStandardMaterial({map:leafTexture,vertexColors:true,alphaTest:.36,side:THREE.DoubleSide,roughness:.84}),uniforms);
 const canopy=revealMaterial(new THREE.MeshStandardMaterial({map:leafTexture,alphaTest:.36,side:THREE.DoubleSide,roughness:.9,color:'#819269'}),uniforms);
 const twig=revealMaterial(new THREE.MeshStandardMaterial({color:'#4e3e2d',roughness:1}),uniforms);
 const water=revealMaterial(new THREE.MeshStandardMaterial({color:'#456a68',transparent:true,opacity:.34,roughness:.17,metalness:.3,depthWrite:false}),uniforms,-2);
 return {terrain,bark,root,rock,foliage,canopy,twig,water};
}

function instance(world,geometry,material,matrices,shadows=false,motion=null){
 if(!matrices.length)return;
 if(motion){
  if(geometry.hasAttribute('aTreeId'))geometry=geometry.clone();
  geometry.setAttribute('aTreeId',new THREE.InstancedBufferAttribute(new Float32Array(motion.ids),1));
  material=revealMaterial(material.clone(),motion.uniforms,motion.kind,true);material.userData.unique=true;
 }
 const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);
 matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
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
 const trailSegments=[];
 for(let z=0;z<maze.n;z++)for(let x=0;x<maze.n;x++){
  if(maze.grid[z][x])continue;
  if(maze.grid[z]?.[x+1]===0)trailSegments.push([x*CELL,z*CELL,(x+1)*CELL,z*CELL]);
  if(maze.grid[z+1]?.[x]===0)trailSegments.push([x*CELL,z*CELL,x*CELL,(z+1)*CELL]);
 }
 function trailWearAt(x,z){
  let best=Infinity;
  for(const [ax,az,bx,bz] of trailSegments){
   const dx=bx-ax,dz=bz-az,t=THREE.MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);
   best=Math.min(best,(x-ax-t*dx)**2+(z-az-t*dz)**2);
  }
  const drift=Math.sin(x*1.7+z*.6)*.12+Math.sin(z*2.4)*.08;
  return 1-THREE.MathUtils.smoothstep(Math.sqrt(best)+drift,.25,.85);
 }
 const terrain=new THREE.PlaneGeometry(extent,extent,300,300);
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
 const barkGeo=new THREE.CylinderGeometry(.16,.34,1,13,20);
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
   const tx=cx+(r()-.5)*2.4,tz=cz+(r()-.5)*2.4,base=height(tx,tz)-.65,h=theme.trunkMin+r()*theme.trunkRange,thick=.65+r()*.7;
   const tree=trunks.length;
   put(trunks,tx,base+h/2,tz,thick,h,thick,0,r()*6.28,0);
   for(let k=0;k<4;k++){
    const angle=r()*6.28,length=.5+r()*.65;
    const endX=tx+Math.cos(angle)*length,endZ=tz+Math.sin(angle)*length;
    const endY=height(endX,endZ)+.04;
    const direction=new THREE.Vector3(endX-tx,endY-base-.2,endZ-tz);
    o.position.set((tx+endX)/2,(base+.2+endY)/2,(tz+endZ)/2);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());o.scale.set(.25,direction.length(),.25);o.updateMatrix();roots.push(o.matrix.clone());rootOwners.push(tree);
   }
   for(let k=0;k<3;k++){
    const angle=r()*6.28,length=1.3+r()*2.2,by=base+h*(.52+r()*.3);
    put(branches,tx+Math.cos(angle)*length*.32,by,tz+Math.sin(angle)*length*.32,.2,length,.2,Math.cos(angle)*.9,r()*6.28,Math.sin(angle)*.9);branchOwners.push(tree);
    for(let u=0;u<theme.canopyCount;u++){
     const a=r()*6.28,rad=r()*2.4;
     put(canopy,tx+Math.cos(a)*rad,by+r()*1.4,tz+Math.sin(a)*rad,.13+r()*.13,.2+r()*.15,1,r()*3.14,r()*6.28,r()*3.14);canopyOwners.push(tree);
    }
   }
  }
  for(let j=0;j<3;j++){
   const rx=cx+(r()-.5)*3,rz=cz+(r()-.5)*3,scale=.18+r()*.5;
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

 // Curved fronds made from paired, veined leaflets rather than flat triangles.
 const fp=[],fn=[],fu=[],fc=[];const matrix=new THREE.Matrix4(),quaternion=new THREE.Quaternion();
 const leafPositions=leafGeo.attributes.position,leafUV=leafGeo.attributes.uv,indices=leafGeo.index;
 function leaflet(x,y,z,angle,tilt,w,len,color){
  quaternion.setFromEuler(new THREE.Euler(tilt,angle,0));matrix.compose(new THREE.Vector3(x,y,z),quaternion,new THREE.Vector3(w,len,1));
  for(let i=0;i<indices.count;i++){const k=indices.getX(i),v=new THREE.Vector3().fromBufferAttribute(leafPositions,k).applyMatrix4(matrix);fp.push(v.x,v.y,v.z);fu.push(leafUV.getX(k),leafUV.getY(k));fc.push(color.r,color.g,color.b)}
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
 const foliageGeo=new THREE.BufferGeometry();foliageGeo.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));foliageGeo.setAttribute('uv',new THREE.Float32BufferAttribute(fu,2));foliageGeo.setAttribute('color',new THREE.Float32BufferAttribute(fc,3));foliageGeo.computeVertexNormals();
 const fernMesh=new THREE.Mesh(foliageGeo,materials.foliage);fernMesh.receiveShadow=true;world.add(fernMesh);
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
 pointMaterial.userData.unique=true;world.add(new THREE.Points(pointGeo,pointMaterial));
 return {trunks,reactions};
}
