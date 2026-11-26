import assert from 'node:assert/strict';
import { createMaze, pathBetween, walkable, CELL } from './dist/maze.js';
let samples = 0;
for (let seed = 1; seed <= 300; seed++) {
  const maze = createMaze(seed);
  assert.equal(maze.targets.length, 3, `Three targets for seed ${seed}`);
  assert.equal(new Set(maze.targets.map(t => `${t.x},${t.z}`)).size, 3);
  assert(!maze.targets.some(p => p.x === maze.start.x && p.z === maze.start.z));
  assert(!walkable(maze, 0, 0), 'Walls block movement');
  let current = maze.start;
  const found = new Set();
  for (const target of [...maze.targets, maze.exit]) {
    const path = pathBetween(maze, current, target);
    assert(path.length, `Reachable destination for seed ${seed}`);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      for (let j = 0; j <= 20; j++) {
        const t = j / 20;
        const x = (a.x + (b.x - a.x) * t) * CELL;
        const z = (a.z + (b.z - a.z) * t) * CELL;
        assert(walkable(maze, x, z), `Traversable route for seed ${seed}`);
        maze.targets.forEach((signal, index) => {
          if (Math.hypot(x - signal.x * CELL, z - signal.z * CELL) < 1.2) found.add(index);
        });
        samples++;
      }
    }
    current = target;
  }
  assert.equal(found.size, 3, 'The complete route recovers every signal');
}
console.log(`Passed 300 complete maze routes and ${samples} collision / collection samples.`);
