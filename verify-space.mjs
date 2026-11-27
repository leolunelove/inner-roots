import assert from 'node:assert/strict';
import {createMaze,pathBetween,walkable,sampleTrail,hedgeDensity,random,CELL} from './dist/maze.js';
import {LEVELS} from './dist/levels.js';

let samples=0;
for(const level of LEVELS)for(let variation=0;variation<25;variation++){
 const maze=createMaze(level.seed+variation,level.size),r=random(variation+91);
 const widths=maze.space.widths.flat().filter(Boolean);
 assert(Math.min(...widths)<1&&Math.max(...widths)>1.5,'Every maze has narrow and broad corridors');
 assert(maze.space.rooms.length>=2,'Clearings break up the corridors');
 assert(maze.loops.length>=1,'Every area contains a reconnecting route');
 let open=0,edges=0;
 for(let z=0;z<maze.n;z++)for(let x=0;x<maze.n;x++)if(!maze.grid[z][x]){open++;if(maze.grid[z]?.[x+1]===0)edges++;if(maze.grid[z+1]?.[x]===0)edges++}
 assert.equal(edges-open+1,maze.loops.length,'Each reconnection adds exactly one navigable cycle');
 for(const loop of maze.loops){assert.equal(maze.grid[loop.z][loop.x],0);assert(maze.dist[loop.z][loop.x]>=0,'New lanes are connected to the start')}
 assert(maze.space.shapes.some(s=>Math.abs(s.ax-s.bx)>.02&&Math.abs(s.az-s.bz)>.02),'Physical trails bend between navigation nodes');
 for(let z=0;z<maze.n;z++)for(let x=0;x<maze.n;x++)if(maze.grid[z][x])assert(!walkable(maze,x*CELL,z*CELL),'A widened lane cannot open the centre of a closed wall');
 let current=maze.start;
 for(const destination of [...maze.targets,maze.exit]){
  const path=pathBetween(maze,current,destination);
  for(let i=1;i<path.length;i++)for(let step=0;step<=40;step++){
   const t=step/40,x=(path[i-1].x+(path[i].x-path[i-1].x)*t)*CELL,z=(path[i-1].z+(path[i].z-path[i-1].z)*t)*CELL;
   assert(walkable(maze,x,z),'The full player body fits through every route and width transition');samples++;
  }
  current=destination;
 }
 for(const room of maze.space.rooms)for(let i=0;i<24;i++){
  const a=i/24*Math.PI*2;assert(walkable(maze,room.x*CELL+Math.cos(a)*1.7,room.z*CELL+Math.sin(a)*1.7),'A clearing offers genuinely open movement');
 }
 let hedgeSamples=0,treeSamples=0;
 for(let i=0;i<300;i++){
  const x=r()*maze.n*CELL-CELL/2,z=r()*maze.n*CELL-CELL/2;
  let expected=-CELL;
  for(const s of maze.space.shapes){
   const dx=s.bx-s.ax,dz=s.bz-s.az,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-s.ax)*dx+(z-s.az)*dz)/l)):0;
   const radius=s.wa+(s.wb-s.wa)*t*t*(3-2*t);
   expected=Math.max(expected,radius-Math.hypot(x-s.ax-dx*t,z-s.az-dz*t));
  }
  assert(Math.abs(Math.max(-2,sampleTrail(maze,x,z).clearance)-Math.max(-2,expected))<1e-6,'Spatial lookup preserves boundaries and nearby terrain heights');
  const cover=hedgeDensity(maze,x,z);if(cover>.55)hedgeSamples++;if(cover<.35)treeSamples++;
 }
 assert(hedgeSamples>10&&treeSamples>10,'Both hedge and tree regions exist');
}
console.log(`Passed 75 varied maze layouts and ${samples} full-body route samples, open glades, wall integrity and spatial-boundary checks.`);
