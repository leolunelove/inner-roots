export function random(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
export const CELL=3.7;
export function createMaze(seed=4201,size=5){
 const rand=random(seed),n=size*2+1,grid=Array.from({length:n},()=>Array(n).fill(1));
 function carve(x,z){grid[z][x]=0;const dirs=[[2,0],[-2,0],[0,2],[0,-2]];for(let i=dirs.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[dirs[i],dirs[j]]=[dirs[j],dirs[i]]}for(const [dx,dz]of dirs){const nx=x+dx,nz=z+dz;if(nx>0&&nz>0&&nx<n-1&&nz<n-1&&grid[nz][nx]){grid[z+dz/2][x+dx/2]=0;carve(nx,nz)}}}carve(1,1);
 const start={x:1,z:1},dist=Array.from({length:n},()=>Array(n).fill(-1)),queue=[start];dist[1][1]=0;
 for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,z=p.z+dz;if(grid[z]?.[x]===0&&dist[z][x]<0){dist[z][x]=dist[p.z][p.x]+1;queue.push({x,z})}}}
 const sorted=queue.filter(p=>p.x%2&&p.z%2).sort((a,b)=>dist[b.z][b.x]-dist[a.z][a.x]);const exit=sorted[0];
 const dead=sorted.filter(p=>p!==exit&&[[1,0],[-1,0],[0,1],[0,-1]].filter(([x,z])=>grid[p.z+z]?.[p.x+x]===0).length===1);
 const targets=[];const near=queue.filter(p=>dist[p.z][p.x]>=4&&dist[p.z][p.x]<=7&&p.x%2&&p.z%2)[0];if(near)targets.push(near);
 for(const p of [...dead,...sorted]){if(targets.length===3)break;if(p!==exit&&dist[p.z][p.x]>=4&&!targets.some(t=>t.x===p.x&&t.z===p.z)&&targets.every(t=>Math.hypot(t.x-p.x,t.z-p.z)>3))targets.push(p)}
 const maze={seed,n,grid,start,exit,targets,dist};
 buildTrailSpace(maze);
 return maze;
}
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};

function buildTrailSpace(maze){
 const {n,grid,seed,dist}=maze,r=random(seed+3091),phase=r()*6.28,widths=Array.from({length:n},()=>Array(n).fill(0)),shapes=[];
 for(let z=0;z<n;z++)for(let x=0;x<n;x++)if(!grid[z][x]){
  const band=(Math.sin(x*.71+phase)+Math.cos(z*.63-phase*.7))*.5;
  widths[z][x]=.76+smooth(-.7,.7,band)*1.04;
 }
 widths[1][1]=1.2;
 for(let z=0;z<n;z++)for(let x=0;x<n;x++)if(!grid[z][x])for(const [dx,dz]of [[1,0],[0,1]])if(grid[z+dz]?.[x+dx]===0)shapes.push({ax:x*CELL,az:z*CELL,bx:(x+dx)*CELL,bz:(z+dz)*CELL,wa:widths[z][x],wb:widths[z+dz][x+dx]});
 const candidates=[];
 for(let z=1;z<n-1;z+=2)for(let x=1;x<n-1;x+=2)if(dist[z][x]>=4)candidates.push({x,z,priority:r()});
 candidates.sort((a,b)=>b.priority-a.priority);
 const rooms=[];
 // A first glade is encountered early; the others become landmarks deeper in.
 const early=candidates.filter(p=>dist[p.z][p.x]<=8).sort((a,b)=>dist[a.z][a.x]-dist[b.z][b.x])[0];
 for(const candidate of [early,...candidates]){
  if(!candidate||rooms.some(room=>Math.hypot(candidate.x-room.x,candidate.z-room.z)<4))continue;
  rooms.push({...candidate,radius:2.35+r()*.4});if(rooms.length===Math.max(2,Math.floor((n-1)/4)))break;
 }
 for(const room of rooms)shapes.push({ax:room.x*CELL,az:room.z*CELL,bx:room.x*CELL,bz:room.z*CELL,wa:room.radius,wb:room.radius,clearing:true});
 const bins=Array.from({length:n*n},()=>[]);
 shapes.forEach((shape,index)=>{
  const reach=Math.max(shape.wa,shape.wb)+CELL*.8;
  const minX=Math.max(0,Math.floor((Math.min(shape.ax,shape.bx)-reach)/CELL+.5)),maxX=Math.min(n-1,Math.floor((Math.max(shape.ax,shape.bx)+reach)/CELL+.5));
  const minZ=Math.max(0,Math.floor((Math.min(shape.az,shape.bz)-reach)/CELL+.5)),maxZ=Math.min(n-1,Math.floor((Math.max(shape.az,shape.bz)+reach)/CELL+.5));
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++)bins[z*n+x].push(index);
 });
 maze.space={shapes,bins,widths,rooms,phase};
}

export function sampleTrail(maze,x,z){
 const gx=Math.floor(x/CELL+.5),gz=Math.floor(z/CELL+.5);
 if(gx<0||gz<0||gx>=maze.n||gz>=maze.n)return {clearance:-CELL,distance:CELL,radius:0};
 let clearance=-CELL,distance=CELL,radius=0;
 for(const id of maze.space.bins[gz*maze.n+gx]){
  const shape=maze.space.shapes[id],dx=shape.bx-shape.ax,dz=shape.bz-shape.az,length=dx*dx+dz*dz;
  const t=length?Math.max(0,Math.min(1,((x-shape.ax)*dx+(z-shape.az)*dz)/length)):0;
  const ease=t*t*(3-2*t),width=shape.wa+(shape.wb-shape.wa)*ease,d=Math.hypot(x-shape.ax-t*dx,z-shape.az-t*dz),gap=width-d;
  if(gap>clearance){clearance=gap;distance=d;radius=width;}
 }
 return {clearance,distance,radius};
}
export function pathClearance(maze,x,z){return sampleTrail(maze,x,z).clearance}
export function hedgeDensity(maze,x,z){
 const phase=maze.space.phase;
 const field=(Math.sin(x*.24+phase)+Math.cos(z*.21-phase*.8)+Math.sin((x+z)*.11+phase)*.65)/2.65;
 const entrance=.95*Math.exp(-Math.pow((x-CELL+.9)/1.8,2)-Math.pow((z-CELL-2)/8,2));
 return Math.max(smooth(-.28,.4,field),entrance);
}
export function walkable(maze,x,z,radius=.27){
 for(const [dx,dz]of [[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]])if(pathClearance(maze,x+dx,z+dz)<0)return false;
 return true;
}
export function pathBetween(maze,start,end){const q=[start],seen=new Map([[`${start.x},${start.z}`,null]]);for(let i=0;i<q.length;i++){const p=q[i],k=`${p.x},${p.z}`;if(p.x===end.x&&p.z===end.z){const out=[];let a=k;while(a){const [x,z]=a.split(',').map(Number);out.push({x,z});a=seen.get(a)}return out.reverse()}for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,z=p.z+dz,key=`${x},${z}`;if(maze.grid[z]?.[x]===0&&!seen.has(key)){seen.set(key,k);q.push({x,z})}}}return []}
