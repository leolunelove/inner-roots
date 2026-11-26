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
 return {seed,n,grid,start,exit,targets,dist};
}
export function walkable(maze,x,z,radius=.27){for(const [dx,dz]of [[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]]){const gx=Math.floor((x+dx)/CELL+.5),gz=Math.floor((z+dz)/CELL+.5);if(maze.grid[gz]?.[gx]!==0)return false}return true}
export function pathBetween(maze,start,end){const q=[start],seen=new Map([[`${start.x},${start.z}`,null]]);for(let i=0;i<q.length;i++){const p=q[i],k=`${p.x},${p.z}`;if(p.x===end.x&&p.z===end.z){const out=[];let a=k;while(a){const [x,z]=a.split(',').map(Number);out.push({x,z});a=seen.get(a)}return out.reverse()}for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,z=p.z+dz,key=`${x},${z}`;if(maze.grid[z]?.[x]===0&&!seen.has(key)){seen.set(key,k);q.push({x,z})}}}return []}
