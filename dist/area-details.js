import * as THREE from './vendor/three.module.js';
import {CELL,random,pathClearance} from './maze.js?v=1.3.0-demo.1';

// These are places within the maze, rather than obstacles added over its routes.
// All substantial silhouettes stay beyond the walking boundary. Shared meshes
// retain the same ink/reveal shading as the forest and are culled in small areas.
export function createAreaDetails(world,maze,height,materials,theme){
 const r=random(maze.seed+81037),tau=Math.PI*2,up=new THREE.Vector3(0,1,0);
 const group=new THREE.Group();group.name='Grove places';world.add(group);
 const batches=new Map(),landmarks=[],moving=[];
 const geometries={
  stone:new THREE.IcosahedronGeometry(1,1),
  timber:new THREE.CylinderGeometry(.85,1,1,9,4),
  branch:new THREE.CylinderGeometry(.3,1,1,6,1),
  slab:new THREE.BoxGeometry(1,1,1,1,1,1),
  leaf:new THREE.PlaneGeometry(1,1,1,2),
  ring:new THREE.TorusGeometry(1,.075,4,14),
  cap:new THREE.CircleGeometry(1,12),
  broken:brokenTrunk(),
 };
 const worn=geometries.stone.attributes.position;
 for(let i=0;i<worn.count;i++){
  const x=worn.getX(i),y=worn.getY(i),z=worn.getZ(i),wear=1+.065*Math.sin(x*8+y*7)+.055*Math.cos(z*11-y*4);
  worn.setXYZ(i,x*wear,y*wear,z*wear);
 }
 geometries.stone.computeVertexNormals();
 const color=new THREE.Color(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion(),euler=new THREE.Euler();
 function add(kind,material,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0,tint=1){
  const key=kind+'/'+material+'/'+Math.floor(x/18)+'/'+Math.floor(z/18);
  if(!batches.has(key))batches.set(key,{kind,material,transforms:[],colors:[]});
  position.set(x,y,z);scale.set(sx,sy,sz);rotation.setFromEuler(euler.set(rx,ry,rz));
  const batch=batches.get(key);batch.transforms.push(new THREE.Matrix4().compose(position,rotation,scale));
  batch.colors.push(color.setRGB(tint,tint,tint).clone());
 }
 function beam(kind,material,a,b,radius,endScale=1,tint=1){
  const direction=new THREE.Vector3().subVectors(b,a),length=direction.length();
  if(length<.001)return;
  position.copy(a).add(b).multiplyScalar(.5);rotation.setFromUnitVectors(up,direction.divideScalar(length));scale.set(radius,length,radius*endScale);
  const key=kind+'/'+material+'/'+Math.floor(position.x/18)+'/'+Math.floor(position.z/18);
  if(!batches.has(key))batches.set(key,{kind,material,transforms:[],colors:[]});
  const batch=batches.get(key);batch.transforms.push(new THREE.Matrix4().compose(position,rotation,scale));batch.colors.push(new THREE.Color(tint,tint,tint));
 }
 function ground(x,z,lift=0){return new THREE.Vector3(x,height(x,z)+lift,z)}
 function outside(x,z,radius=.2){
  if(x<0||z<0||x>(maze.n-1)*CELL||z>(maze.n-1)*CELL)return false;
  // Include the complete footprint, not only its centre.
  for(let i=0;i<8;i++)if(pathClearance(maze,x+Math.cos(i*tau/8)*radius,z+Math.sin(i*tau/8)*radius)>-.08)return false;
  return true;
 }
 function stone(x,z,sx,sy,sz,angle=0,tint=1){
  add('stone','rock',x,height(x,z)+sy*.64-.08,z,sx,sy,sz,(r()-.5)*.2,angle,(r()-.5)*.16,tint);
 }
 function roots(x,z,size=1,count=5){
  for(let i=0;i<count;i++){
   const a=i/count*tau+r()*.3,span=(.7+r()*.7)*size;
   const p0=ground(x,z,.32*size),p1=ground(x+Math.cos(a)*span*.4,z+Math.sin(a)*span*.4,.1*size);
   const p2=ground(x+Math.cos(a)*span,z+Math.sin(a)*span,.025);
   beam('branch','root',p0,p1,.085*size);beam('branch','root',p1,p2,.045*size);
   if(i%2===0){const fork=ground(p1.x+Math.cos(a+.55)*span*.6,p1.z+Math.sin(a+.55)*span*.6,.02);beam('branch','root',p1,fork,.027*size)}
  }
 }
 function fern(x,z,size=1){
  const y=height(x,z),phase=r()*tau;
  for(let f=0;f<6;f++){
   const a=f/6*tau+phase,len=(.5+r()*.25)*size;
   for(let j=1;j<=5;j++){
    const t=j/6,reach=t*len,h=Math.sin(t*Math.PI*.8)*len*.65,blade=(1-t)*.24*size+.025;
    for(const side of [-1,1]){
     const angle=a+side*.8,bx=x+Math.cos(a)*reach+Math.cos(angle)*blade*.32,bz=z+Math.sin(a)*reach+Math.sin(angle)*blade*.32;
     add('leaf','foliage',bx,y+h,bz,blade*.48,blade,1,-Math.PI*.37,Math.PI*.5-angle,side*.14,.65+r()*.3);
    }
   }
  }
 }
 function mushrooms(x,z,size=1){
  for(let i=0;i<5;i++){
   const a=r()*tau,d=r()*.3*size,px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d,s=(.035+r()*.05)*size,y=height(px,pz);
   beam('branch','root',new THREE.Vector3(px,y,pz),new THREE.Vector3(px,y+s*2,pz),s*.15,1,.9);
   add('stone','root',px,y+s*1.9,pz,s,s*.24,s,(r()-.5)*.2,r()*tau,0,1.25);
  }
 }
 function fallenLog(x,z,angle,length=2.5,radius=.2,charred=false){
  const dx=Math.cos(angle)*length/2,dz=Math.sin(angle)*length/2;
  for(let i=0;i<=8;i++)if(!outside(x-dx+dx*2*i/8,z-dz+dz*2*i/8,radius+.06))return false;
  const a=ground(x-dx,z-dz,radius*.68),b=ground(x+dx,z+dz,radius*.8);
  beam('timber','bark',a,b,radius,1,charred?.72:1);
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),b.clone().sub(a).normalize());
  const orient=new THREE.Euler().setFromQuaternion(q),end=b.clone().addScaledVector(b.clone().sub(a).normalize(),.012);
  add('cap','root',end.x,end.y,end.z,radius*.83,radius*.83,1,orient.x,orient.y,orient.z,charred?.42:1.25);
  for(const ring of [.46,.75])add('ring','bark',end.x,end.y,end.z,radius*ring,radius*ring,radius*.3,orient.x,orient.y,orient.z,charred?.8:.7);
  for(let i=0;i<3;i++){
   const t=.18+r()*.65,base=a.clone().lerp(b,t),side=i%2?-1:1;
   const tip=base.clone().add(new THREE.Vector3(-Math.sin(angle)*side*(.3+r()*.35),.15+r()*.22,Math.cos(angle)*side*(.3+r()*.35)));
   if(outside(tip.x,tip.z,.09))beam('branch','bark',base,tip,radius*.31,1,charred?.7:1);
  }
  if(!charred)mushrooms(x,z,.9);
  return true;
 }
 function reeds(x,z,size=1,animate=false){
  const y=height(x,z),phase=r()*tau;
  for(let i=0;i<8;i++){
   const a=i/8*tau+phase,d=r()*.2*size,px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d,h=(.55+r()*.65)*size;
   const base=new THREE.Vector3(px,height(px,pz),pz),tip=base.clone().add(new THREE.Vector3(Math.cos(a)*.16*size,h,Math.sin(a)*.16*size));
   beam('branch','twig',base,tip,.011*size,1,.85+r()*.3);
   const top=tip.clone().add(new THREE.Vector3(Math.cos(a)*.015,.12*size,Math.sin(a)*.015));
   if(i%3===0)beam('timber','root',tip,top,.026*size,1,.65);
   for(let j=0;j<2;j++){
    const center=base.clone().lerp(tip,.32+j*.22),leafAngle=a+(j?1:-1)*.5;
    center.add(new THREE.Vector3(Math.cos(leafAngle)*.13*size,.12*size,Math.sin(leafAngle)*.13*size));
    add('leaf','foliage',center.x,center.y,center.z,.055*size,.43*size,1,-.75,Math.PI*.5-leafAngle,.3,.6+r()*.35);
   }
  }
  if(animate){
   // One loose frond per landmark carries a barely perceptible slow sway.
   const frond=new THREE.Group();frond.position.set(x,y,z);group.add(frond);
   const leaf=new THREE.Mesh(geometries.leaf,materials.foliage);leaf.position.set(.1,.45*size,0);leaf.rotation.set(-.25,phase,-.24);leaf.scale.set(.045*size,.8*size,1);frond.add(leaf);
   moving.push({object:frond,phase,amplitude:.012+r()*.008});
  }
 }
 function marker(x,z,size=1,angle=0){
  stone(x,z,.26*size,.75*size,.2*size,angle,.82);
  add('slab','rock',x,height(x,z)+.6*size,z,.43*size,.13*size,.27*size,0,angle,.09,.72);
  for(let i=0;i<3;i++){
   const a=angle+i*2.1,px=x+Math.cos(a)*.38*size,pz=z+Math.sin(a)*.38*size;
   stone(px,pz,.18*size,.1*size,.23*size,a,.78);
  }
 }
 function hollowPlace(x,z,index,angle){
  const s=index===0?1.1:.9+r()*.25;
  if(index===1){
   add('broken','bark',x,height(x,z)-.08,z,.52,1.25,.49,.08,angle,.05,.95);
   for(const side of [-1,1])fallenLog(x+Math.cos(angle)*.45,z+Math.sin(angle)*.45,angle+side*.58,2.3,.26);
  }else if(index===2){
   for(let i=-1;i<=1;i++){
    const px=x+Math.cos(angle+Math.PI/2)*i*.46,pz=z+Math.sin(angle+Math.PI/2)*i*.46;
    if(outside(px,pz,.3))stone(px,pz,.24,.73+(i===0?.28:0),.25,angle+i*.17,.85+i*.1);
   }
  }else{
   stone(x,z,.55*s,.34*s,.49*s,angle,.84);
   stone(x-.13,z+.05,.34*s,.78*s,.27*s,angle+.3,.92);
   stone(x+.21,z-.08,.23*s,.59*s,.25*s,angle-.2,1.08);
  }
  roots(x,z,1.22*s,7);
  for(let i=0;i<5;i++){
   const a=angle+i*1.21,d=.75+r()*.25,px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d;
   if(outside(px,pz,.25))fern(px,pz,.7+r()*.25);
  }
  mushrooms(x+.34,z-.25,1.3);
 }
 function drownedPlace(x,z,index,angle){
  const c=Math.cos(angle),s=Math.sin(angle);
  // A broken flood wall and two surviving mooring posts imply an old route.
  const span=index===2?4:2;
  for(let i=-span;i<=span;i++){
   const px=x+c*i*.34,pz=z+s*i*.34;if(!outside(px,pz,.25))continue;
   stone(px,pz,.25,.18+r()*.1,.22,angle,.8);
   if(i%2===0)add('slab','rock',px,height(px,pz)+.37,pz,.43,.18,.4,.06,angle,.07,.76);
  }
  marker(x,z,index===1?1.45:1.1,angle);
  for(const side of [-1,1]){
   const px=x+c*side*.85,pz=z+s*side*.85;if(!outside(px,pz,.18))continue;
   const base=ground(px,pz,-.08),tip=base.clone().add(new THREE.Vector3(s*.07,.72+r()*.25,c*.06));
   beam('timber','bark',base,tip,.095,1,.85);
   for(let k=0;k<3;k++){
    const p=base.clone().lerp(tip,.35+k*.065);add('ring','root',p.x,p.y,p.z,.106,.106,.08,Math.PI/2,0,0,.6);
   }
  }
  for(let i=0;i<4;i++){
   const a=angle+i*1.5,px=x+Math.cos(a)*(.8+r()*.3),pz=z+Math.sin(a)*(.8+r()*.3);
   if(outside(px,pz,.18))reeds(px,pz,.85+r()*.25,i===0);
  }
 }
 function cinderPlace(x,z,index,angle){
  const y=height(x,z),size=.85+r()*.3;
  add('broken','bark',x,y-.1,z,.55*size,(index===3?.9:1.9)*size,.51*size,.035,angle,-.04,.73);
  // Inner broken splinters make the open crown read as hollow, not a cut cylinder.
  for(let i=0;i<7;i++){
   const a=i/7*tau+angle,rad=.36*size,p=ground(x+Math.cos(a)*rad,z+Math.sin(a)*rad,.48*size);
   beam('branch','bark',p,p.clone().add(new THREE.Vector3(Math.cos(a)*.06,(index===3?.4:1)+r()*.8,Math.sin(a)*.06)),.09*size,1,.7);
  }
  roots(x,z,1.2,6);
  for(let i=0;i<(index===3?15:8);i++){
   const a=angle+i*(index===3?.41:.72),d=(index===3?1.35:.77)+r()*.25,px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d;
   if(outside(px,pz,.16))stone(px,pz,.12+r()*.13,.07+r()*.07,.16,a,.7+r()*.2);
  }
 }
 const names=theme.id==='drowned'?['The Old Mooring','Floodmark Reach','The Sinking Wall','Reedwatch']:
  theme.id==='cinder'?['The Split Crown','Charcoal Hollow','The Last Watch','Ashfall Ring']:
  ['The Root Cairn','The Sleeping Giant','The Listening Stones','The Elder Fold'];
 const places=maze.space.rooms.slice().sort((a,b)=>maze.dist[a.z][a.x]-maze.dist[b.z][b.x]);
 for(let index=0;index<places.length;index++){
  const room=places[index],cx=room.x*CELL,cz=room.z*CELL;
  let chosen=null;
  // Choose an enclosed shoulder of each glade, away from every joining path.
  for(let i=0;i<28;i++){
   const a=i/28*tau+maze.space.phase,d=room.radius+.98,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;
   if(!outside(x,z,.82))continue;
   const score=-Math.abs(height(x,z)-height(cx,cz))*.65-pathClearance(maze,x,z)*.18;
   if(!chosen||score>chosen.score)chosen={x,z,a,score};
  }
  if(!chosen)continue;
  const {x,z,a}=chosen;
  if(theme.id==='drowned')drownedPlace(x,z,index,a+Math.PI/2);
  else if(theme.id==='cinder')cinderPlace(x,z,index,a);
  else hollowPlace(x,z,index,a);
  landmarks.push({x,z,name:names[index%names.length],kind:theme.id==='drowned'?'ruin':theme.id==='cinder'?'snag':'cairn',cellX:room.x,cellZ:room.z});
 }

 // Compose small recurring shoulder details along passages. The stable seed
 // and a minimum separation prevent an even line of decorative props.
 const occupied=[];
 for(const trail of maze.space.shapes){
  if(trail.clearing||r()>.27)continue;
  const dx=trail.bx-trail.ax,dz=trail.bz-trail.az,len=Math.hypot(dx,dz);if(len<.2)continue;
  const t=.25+r()*.5,side=r()>.5?1:-1,rad=THREE.MathUtils.lerp(trail.wa,trail.wb,t)+.38+r()*.45;
  const x=THREE.MathUtils.lerp(trail.ax,trail.bx,t)-dz/len*rad*side,z=THREE.MathUtils.lerp(trail.az,trail.bz,t)+dx/len*rad*side;
  if(!outside(x,z,.22)||occupied.some(p=>Math.hypot(p.x-x,p.z-z)<2.3))continue;
  occupied.push({x,z});const angle=Math.atan2(dz,dx);
  if(theme.id==='drowned'){
   reeds(x,z,.75+r()*.4);if(r()<.3)marker(x,z,.55+r()*.3,angle);
   if(r()<.2)fallenLog(x,z,angle,1.2+r()*.9,.1);
  }else if(theme.id==='cinder'){
   if(r()<.45)fallenLog(x,z,angle+(r()-.5)*.15,1.3+r()*1.8,.12+r()*.09,true);
   else{
    if(!outside(x,z,.45))continue;
    const h=.6+r()*1.1;add('broken','bark',x,height(x,z)-.07,z,.14+r()*.13,h,.16,.04,angle,.08,.65);
    roots(x,z,.45,3);
   }
   for(let i=0;i<3;i++){const px=x+(r()-.5)*.7,pz=z+(r()-.5)*.7;if(outside(px,pz,.1))stone(px,pz,.07+r()*.1,.05,.1,r()*tau,.7)}
  }else{
   fern(x,z,.65+r()*.4);
   if(r()<.38)fallenLog(x,z,angle+(r()-.5)*.2,1.4+r()*1.5,.15+r()*.11);
   else if(r()<.5&&outside(x,z,.5))stone(x,z,.26+r()*.2,.18+r()*.2,.3,r()*tau,.8+r()*.2);
  }
 }
 for(const {kind,material,transforms,colors}of batches.values()){
  const mesh=new THREE.InstancedMesh(geometries[kind],materials[material],transforms.length);mesh.name='Area '+kind;
  transforms.forEach((matrix,i)=>{mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,colors[i])});
  mesh.castShadow=kind!=='leaf'&&kind!=='ring'&&kind!=='cap';mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);
 }
 // Dispose unused shapes too; the normal world teardown owns the used meshes.
 const used=new Set([...batches.values()].map(batch=>batch.kind));if(moving.length)used.add('leaf');
 for(const [kind,geometry]of Object.entries(geometries))if(!used.has(kind))geometry.dispose();
 batches.clear();occupied.length=0;
 return {landmarks,update(time){for(const item of moving){item.object.rotation.z=Math.sin(time*.31+item.phase)*item.amplitude;item.object.rotation.x=Math.sin(time*.19+item.phase*1.3)*item.amplitude*.4}}};
}

function brokenTrunk(){
 const sides=11,positions=[],normals=[],uvs=[],indices=[];
 // A dark inner shell and irregular split lip, with no flat top cap.
 for(let shell=0;shell<2;shell++)for(let row=0;row<3;row++)for(let i=0;i<=sides;i++){
  const a=(i%sides)/sides*Math.PI*2,rough=1+.08*Math.sin(a*3.1)+.05*Math.cos(a*5.3);
  const radius=(shell?.68:1)*rough*(row===0?1.18:row===1?.92:.84);
  const y=row===0?0:row===1?.55:.81+.19*(.5+.5*Math.sin(a*7.7+1.2));
  positions.push(Math.cos(a)*radius,y,Math.sin(a)*radius);normals.push(Math.cos(a)*(shell?-1:1),0,Math.sin(a)*(shell?-1:1));uvs.push(i/sides,y);
 }
 const stride=sides+1,section=stride*3;
 for(let shell=0;shell<2;shell++)for(let row=0;row<2;row++)for(let i=0;i<sides;i++){
  const a=shell*section+row*stride+i,b=a+1,c=a+stride,d=c+1;
  if(shell)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d);
 }
 for(let i=0;i<sides;i++){const a=stride*2+i,b=a+1,c=a+section,d=c+1;indices.push(a,c,b,b,c,d)}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
