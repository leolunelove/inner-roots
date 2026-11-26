import * as THREE from './vendor/three.module.js';
import {PULSE_DURATION,TREE_CONTRACTION_DELAY,TREE_HEIGHT_DELAY,TREE_ECHO_BASE,TREE_ECHO_SPREAD} from './pulse-timing.js?v=1.1.0-demo.1';

// Shared by bark, attached veins, canopy, surface points and shadow depth.
export const treeMotionGLSL=`
 uniform sampler2D uTreeMap;
 uniform float uTreeCount;
 vec3 treeDisplacement(vec3 p,float id,float age){
  if(id<0.||age<0.||age>${PULSE_DURATION.toFixed(1)})return vec3(0.);
  float row=(id+.5)/uTreeCount;
  vec4 root=texture2D(uTreeMap,vec2(.25,row));
  vec4 response=texture2D(uTreeMap,vec2(.75,row));
  float h=max(0.,p.y-root.y),local=age-root.w-h*${TREE_HEIGHT_DELAY};
  if(local<0.||local>4.5||response.y<.001)return vec3(0.);
  float seed=response.x;
  float contraction=exp(-pow((local-${TREE_CONTRACTION_DELAY})/.075,2.))-.38*exp(-pow((local-.34)/.16,2.));
  float echoTime=${TREE_ECHO_BASE}+seed*${TREE_ECHO_SPREAD};
  float echo=.52*exp(-pow((local-echoTime)/.10,2.))-.17*exp(-pow((local-echoTime-.23)/.22,2.));
  float tremor=.14*exp(-pow((local-2.65-seed*.4)/.28,2.))*sin(local*22.+seed*7.);
  float anchored=pow(clamp(h/6.,0.,1.),1.35);
  float tension=(contraction+echo+tremor)*anchored*response.y*(.045+seed*.02);
  float angle=seed*6.28318;
  return vec3(cos(angle),-.09,sin(angle))*tension;
 }
`;

export function applyTreeMotionShader(shader,uniforms){
 Object.assign(shader.uniforms,uniforms);
 shader.vertexShader=`attribute float aTreeId;uniform float uPulse;${treeMotionGLSL}\n`+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  #ifdef USE_INSTANCING
   mat3 treeBasis=mat3(modelMatrix*instanceMatrix);
   vec3 treeWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;
   vec3 treeDelta=treeDisplacement(treeWorld,aTreeId,uPulse);
   // The generated instances use orthogonal rotation/scale bases.
   transformed+=vec3(dot(treeDelta,treeBasis[0])/dot(treeBasis[0],treeBasis[0]),dot(treeDelta,treeBasis[1])/dot(treeBasis[1],treeBasis[1]),dot(treeDelta,treeBasis[2])/dot(treeBasis[2],treeBasis[2]));
  #endif`);
}

export function createTreeReactions(trunks,height,uniforms){
 const data=new Float32Array(trunks.length*8),p=new THREE.Vector3();
 trunks.forEach((matrix,i)=>{
  p.setFromMatrixPosition(matrix);const offset=i*8;
  data.set([p.x,height(p.x,p.z),p.z,100,(i*.61803398875+.17)%1,0,0,0],offset);
 });
 const map=new THREE.DataTexture(data,2,trunks.length,THREE.RGBAFormat,THREE.FloatType);
 map.minFilter=map.magFilter=THREE.NearestFilter;map.needsUpdate=true;
 uniforms.uTreeMap.value=map;uniforms.uTreeCount.value=trunks.length;
 return {
  reach(tree,arrival,strength){data[tree*8+3]=arrival;data[tree*8+5]=strength},
  commit(){map.needsUpdate=true},
  soundCues(){return trunks.map((_,i)=>({x:data[i*8],y:data[i*8+1],z:data[i*8+2],arrival:data[i*8+3],seed:data[i*8+4],strength:data[i*8+5]})).filter(tree=>tree.strength>.03)},
  dispose(){map.dispose()}
 };
}
