import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LEVELS} from './dist/levels.js';
import {createMaze,pathBetween,walkable,CELL} from './dist/maze.js';
const layouts=new Set();
for(const level of LEVELS){
 const maze=createMaze(level.seed,level.size);layouts.add(JSON.stringify(maze.grid));assert.equal(maze.targets.length,3);
 let current=maze.start;
 for(const target of [...maze.targets,maze.exit]){
  const path=pathBetween(maze,current,target);assert(path.length);
  for(let i=1;i<path.length;i++)for(let step=0;step<=20;step++){
   const t=step/20;assert(walkable(maze,(path[i-1].x+(path[i].x-path[i-1].x)*t)*CELL,(path[i-1].z+(path[i].z-path[i-1].z)*t)*CELL));
  }
  current=target;
 }
}
assert.equal(layouts.size,3,'The demo contains three different maze layouts');
assert.equal(new Set(LEVELS.map(level=>level.vein)).size,3);
assert.equal(LEVELS[1].id,'drowned');assert.equal(LEVELS[2].canopyCount,0);
const html=readFileSync('dist/index.html','utf8');
for(const id of ['home','start','infoButton','infoPanel','closeInfo','pauseMenu','winMenu','winTitle','winEyebrow','winFootnote','next'])assert(html.includes(`id="${id}"`),`Demo control ${id} exists`);
assert.equal((html.match(/data-level=/g)||[]).length,3);
assert(!html.includes('Hollow Trace'));
console.log('Passed all three fixed demo routes, distinct layouts/themes, stripped Cinder canopy and menu/ending controls.');
