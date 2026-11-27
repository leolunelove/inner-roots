import * as THREE from './vendor/three.module.js';
import {random} from './maze.js?v=1.3.0-demo.1';

// Linear light intensity, projected by the real spotlight onto receiving surfaces.
// An off-centre filament, uneven reflector and weak spill avoid a filled light disc.
function reflectorPattern(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(512,512);
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const u=(x+.5)/256-1,v=(y+.5)/256-1;
  const shiftedX=u-.035,shiftedY=v+.025;
  const radius=Math.hypot(u,v),angle=Math.atan2(v,u);
  const warp=1+.08*Math.sin(angle*3+.6)+.04*Math.sin(angle*7-1.2);
  const core=Math.exp(-2.4*((shiftedX/.26)**2+(shiftedY/.22)**2)*warp);
  const spill=.12*Math.exp(-3.1*(radius/.78)**2);
  const reflector=.038*Math.exp(-(((radius-.34)/.13)**2))*(1+.22*Math.sin(angle*5));
  const imperfection=.90+.055*Math.sin(u*21+v*7)+.045*Math.sin(v*17-u*9);
  const edge=1-THREE.MathUtils.smoothstep(radius,.7,.99);
  const i=(y*512+x)*4;
  pixels.data[i]=Math.min(255,255*(core*.78+spill*.83+reflector*.9)*imperfection*edge);
  pixels.data[i+1]=Math.min(255,255*(core*.73+spill*.93+reflector*.85)*imperfection*edge);
  pixels.data[i+2]=Math.min(255,255*(core*.61+spill+reflector*.78)*imperfection*edge);
  pixels.data[i+3]=255;
 }
 ctx.putImageData(pixels,0,0);
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.NoColorSpace;
 texture.minFilter=texture.magFilter=THREE.LinearFilter;
 texture.generateMipmaps=false;
 return texture;
}

function scuffedPlastic(){
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;
 const ctx=canvas.getContext('2d'),r=random(121);
 ctx.fillStyle='#34392f';ctx.fillRect(0,0,128,256);
 for(let i=0;i<900;i++){
  const c=30+Math.floor(r()*50);ctx.strokeStyle=`rgba(${c},${c+3},${c-4},.18)`;
  const x=r()*128,y=r()*256;ctx.lineWidth=.3+r()*.7;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(r()-.5)*2,y+r()*12);ctx.stroke();
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;
}

export function createFlashlight(scene,camera){
 const light=new THREE.SpotLight('#fff5e3',340,11.5,.59,.95,2);
 light.map=reflectorPattern();light.castShadow=true;
 light.shadow.mapSize.set(1024,1024);light.shadow.bias=-.00025;
 light.shadow.normalBias=.018;light.shadow.camera.near=.12;light.shadow.camera.far=15;
 scene.add(light,light.target);

 // Only the cropped top of the held torch enters the view, at the lower right.
 const held=new THREE.Group();camera.add(held);scene.add(camera);
 const plastic=new THREE.MeshStandardMaterial({map:scuffedPlastic(),color:'#9b9f90',roughness:.86,metalness:.08});
 const rim=new THREE.MeshStandardMaterial({color:'#4b4c42',roughness:.5,metalness:.55});
 const rubber=new THREE.MeshStandardMaterial({color:'#151913',roughness:.95});
 function cylinder(top,bottom,length,z,material){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,length,24),material);
  mesh.rotation.x=-Math.PI/2;mesh.position.z=z;held.add(mesh);return mesh;
 }
 cylinder(.031,.034,.26,-.13,plastic);
 cylinder(.05,.032,.075,-.2975,plastic);
 cylinder(.052,.052,.012,-.337,rim);
 cylinder(.035,.035,.022,.005,rubber);
 for(let i=0;i<8;i++){
  const grip=new THREE.Mesh(new THREE.TorusGeometry(.033,.002,5,24),rubber);
  grip.position.z=-.055-i*.023;held.add(grip);
 }
 const button=new THREE.Mesh(new THREE.BoxGeometry(.017,.009,.033),rubber);
 button.position.set(-.008,.033,-.135);held.add(button);
 const lens=new THREE.Mesh(new THREE.CircleGeometry(.046,24),new THREE.MeshStandardMaterial({color:'#777d64',roughness:.15,metalness:.45}));
 lens.rotation.y=Math.PI;lens.position.z=-.344;held.add(lens);

 // This reaches the nearby torch body only, not the surrounding forest.
 const bodyFill=new THREE.PointLight('#c8c5ad',.28,.65,2);
 bodyFill.position.set(.24,-.14,-.45);camera.add(bodyFill);
 const forward=new THREE.Vector3(0,0,-1),aim=new THREE.Vector3(),desired=new THREE.Vector3();
 const localAim=new THREE.Vector3(),inverse=new THREE.Quaternion(),lensOffset=new THREE.Vector3();
 let initialized=false,stride=0,activity=0;
 return {
  reset(){initialized=false;activity=0;stride=0},
  update(dt,time,moving,mode){
   const playing=mode==='playing';held.visible=playing;bodyFill.intensity=playing?.28:0;
   activity=THREE.MathUtils.damp(activity,playing&&moving?1:0,8,dt);
   stride+=dt*(moving?9:1.5);
   const handX=Math.sin(stride)*.009*activity+Math.sin(time*.81)*.0018;
   const handY=Math.cos(stride*2)*.006*activity+Math.sin(time*1.07)*.0012;
   desired.set(.012+handX,-.10+handY,-1).normalize().applyQuaternion(camera.quaternion);
   if(!initialized||mode==='home'){aim.copy(desired);initialized=true}
   else aim.lerp(desired,1-Math.exp(-dt*14)).normalize();
   held.position.set((camera.aspect<1?.20:.30)+handX,-.28+handY,-.30);
   inverse.copy(camera.quaternion).invert();localAim.copy(aim).applyQuaternion(inverse);
   held.quaternion.setFromUnitVectors(forward,localAim);
   lensOffset.set(0,0,-.344).applyQuaternion(held.quaternion).add(held.position).applyQuaternion(camera.quaternion);
   light.position.copy(camera.position).add(lensOffset);
   light.target.position.copy(light.position).addScaledVector(aim,10);
  }
 };
}
