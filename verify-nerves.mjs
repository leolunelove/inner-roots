import assert from 'node:assert/strict';
import {createMaze,pathBetween,CELL} from './dist/maze.js';
import {createNerveGraph,edgeTravelTime} from './dist/nerve-graph.js';
import {PULSE_DURATION,PULSE_RECHARGE,ARRIVAL_WINDOW} from './dist/pulse-timing.js';

let unequalArrivals=false;
for(let seed=1;seed<=100;seed++){
 const maze=createMaze(seed),graph=createNerveGraph(maze);
 assert.equal(graph.nodes.length,maze.grid.flat().filter(v=>v===0).length);
 assert.equal(graph.edges.length,graph.nodes.length-1,'Perfect maze stays a connected branching tree');
 for(const edge of graph.edges){
  const a=graph.nodes[edge.a],b=graph.nodes[edge.b];assert.equal(Math.abs(a.x-b.x)+Math.abs(a.z-b.z),1,'Nerves connect adjacent walkable cells');
  assert.equal(edgeTravelTime(edge,0),0);
  assert(Math.abs(edgeTravelTime(edge,1)-edge.time)<1e-6,'Both ends meet the graph arrival time');
  let last=0;for(let step=1;step<=100;step++){const t=edgeTravelTime(edge,step/100);assert(t>=last,'Surges never reverse the travelling front');last=t;}
  assert(edge.hesitation>=.04&&edge.hesitation<=.54);
 }
 for(const source of [maze.start,maze.exit]){
  const result=graph.propagate({x:source.x*CELL,z:source.z*CELL});
  assert.equal(result.source.x,source.x);assert.equal(result.source.z,source.z);
  const groups=new Map();
  for(const node of graph.nodes){
   const expected=(pathBetween(maze,source,node).length-1)*CELL;
   assert(Math.abs(result.distances[node.id]-expected)<.001,'Range follows the navigable route, not straight-line proximity');
   assert(Number.isFinite(result.times[node.id]));
   const steps=expected/CELL;
   assert(result.times[node.id]>=expected/16+steps*.04-.001&&result.times[node.id]<=expected/5+steps*.54+.001,'Propagation includes bounded branch hesitations');
   if(expected<=17.5){assert(result.times[node.id]<ARRIVAL_WINDOW,'Reached routes fit the arrival texture');assert(result.times[node.id]+7.5<PULSE_DURATION,'The slow return finishes before the global fade');}
   const key=Math.round(expected/CELL),previous=groups.get(key);
   if(previous!==undefined&&Math.abs(previous-result.times[node.id])>.01)unequalArrivals=true;
   groups.set(key,result.times[node.id]);
  }
 }
}
assert(unequalArrivals,'Equal-distance branches can arrive at different times');
assert(PULSE_RECHARGE>PULSE_DURATION,'Recharge cannot interrupt the liquid return');
console.log('Passed 100 nerve graphs, route distances, monotonic surges, staggered arrivals and complete liquid-return timing.');
