import {CELL,random} from './maze.js?v=1.2.0-demo.4';

// Unequal time intervals and easing make the front hesitate, then surge.
export function edgeTravelTime(edge,progress){
 const p=Math.max(0,Math.min(1,progress))*6,i=Math.min(5,Math.floor(p)),f=p-i;
 const eased=f*.16+f*f*(3-2*f)*.84;
 return edge.knots[i]+(edge.knots[i+1]-edge.knots[i])*eased;
}

export function createNerveGraph(maze){
 const nodes=[],edges=[],byCell=new Map(),r=random(maze.seed+713);
 for(let z=0;z<maze.n;z++)for(let x=0;x<maze.n;x++)if(maze.grid[z][x]===0){
  const node={id:nodes.length,x,z,wx:x*CELL,wz:z*CELL,links:[]};
  nodes.push(node);byCell.set(`${x},${z}`,node);
 }
 for(const node of nodes)for(const [dx,dz]of [[1,0],[0,1]]){
  const other=byCell.get(`${node.x+dx},${node.z+dz}`);if(!other)continue;
  const edge={id:edges.length,a:node.id,b:other.id,length:CELL,speed:5+r()*11,seed:r(),hesitation:.04+Math.pow(r(),3)*.5};
  edge.time=CELL/edge.speed+edge.hesitation;
  const weights=Array.from({length:6},()=>.18+Math.pow(r(),2)*2.5),total=weights.reduce((a,b)=>a+b,0);
  edge.knots=[0];for(const weight of weights)edge.knots.push(edge.knots.at(-1)+weight/total*edge.time);
  edges.push(edge);node.links.push(edge);other.links.push(edge);
 }
 function nearest(x,z){let best=nodes[0],distance=Infinity;for(const node of nodes){const d=Math.hypot(x-node.wx,z-node.wz);if(d<distance){distance=d;best=node}}return best}
 function propagate(origin){
  const source=nearest(origin.x,origin.z),offset=Math.hypot(origin.x-source.wx,origin.z-source.wz);
  const times=new Float32Array(nodes.length).fill(Infinity),distances=new Float32Array(nodes.length).fill(Infinity),done=new Set();
  times[source.id]=offset/12;distances[source.id]=offset;
  for(let i=0;i<nodes.length;i++){
   let current=-1;for(let j=0;j<nodes.length;j++)if(!done.has(j)&&(current<0||times[j]<times[current]))current=j;
   if(current<0||!Number.isFinite(times[current]))break;done.add(current);
   for(const edge of nodes[current].links){const next=edge.a===current?edge.b:edge.a;times[next]=Math.min(times[next],times[current]+edge.time)}
  }
  const queue=[source.id];
  for(let i=0;i<queue.length;i++)for(const edge of nodes[queue[i]].links){
   const next=edge.a===queue[i]?edge.b:edge.a,d=distances[queue[i]]+edge.length;
   if(d<distances[next]-.001){distances[next]=d;queue.push(next)}
  }
  return {source,times,distances};
 }
 return {nodes,edges,nearest,propagate};
}
