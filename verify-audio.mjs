import assert from 'node:assert/strict';
import {synthesizeForestTexture,buildForestSoundEvents} from './dist/forest-audio.js';
import {PULSE_DURATION,LIQUID_SLOWDOWN} from './dist/pulse-timing.js';

for(const rate of [24000,44100,48000])for(const kind of ['creak','crack','wet','wind'])for(const seed of [17,42,2001]){
 const samples=synthesizeForestTexture(kind,seed,rate);let peak=0,power=0;
 for(const value of samples){assert(Number.isFinite(value));peak=Math.max(peak,Math.abs(value));power+=value*value;}
 assert(peak<=.701,'Sources leave headroom before quiet mixing');
 assert(Math.sqrt(power/samples.length)>.015,'Every texture contains an audible signal');
 if(kind==='wind')assert(Math.abs(samples[0]-samples.at(-1))<1e-6,'Ambient loop has a continuous seam');
 else{assert(samples[0]===0);assert(samples.at(-1)===0,'Texture boundaries cannot click');}
}
const origin={x:0,y:1.65,z:0},trees=Array.from({length:40},(_,i)=>({x:i%7*2.5-7,y:0,z:Math.floor(i/7)*3+2,arrival:i*.09,seed:(i*.618+.17)%1,strength:i%4?1:0}));
const liquid=[{x:0,y:0,z:0,arrival:0,seed:.2,strength:1},{x:7.4,y:0,z:0,arrival:1.2,seed:.7,strength:.8}];
const events=buildForestSoundEvents({trees,liquid},origin);
assert(events.filter(e=>e.kind==='crack').length<=5,'A dense forest cannot produce a wall of cracking');
for(const event of events){
 assert(event.gain>0&&event.gain<=.043);
 assert(event.at>=0&&event.at+event.duration<=PULSE_DURATION+.001,'Sound ends with its visual pulse');
 if(event.kind!=='wet')assert(trees.some(t=>t.strength>0&&t.x===event.x&&t.z===event.z),'Only reached trees make sounds');
}
for(const pool of liquid){const crawl=events.find(e=>e.kind==='wet'&&e.rate<1&&e.x===pool.x&&e.z===pool.z);assert(crawl);assert.equal(crawl.at,pool.arrival+2*LIQUID_SLOWDOWN,'Wet return follows the liquid timeline');}
assert.deepEqual(buildForestSoundEvents({trees:[],liquid:[]},origin),[]);
console.log('Passed texture headroom, silent boundaries, loop seams, reached-tree selection and liquid/audio timing at three sample rates.');
