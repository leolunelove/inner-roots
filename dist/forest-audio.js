import {random} from './maze.js';
import {PULSE_DURATION,LIQUID_SLOWDOWN,TREE_CONTRACTION_DELAY,TREE_HEIGHT_DELAY,TREE_ECHO_BASE,TREE_ECHO_SPREAD} from './pulse-timing.js';

const lengths={creak:.96,crack:.19,wet:3.6,wind:4};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Friction, damped wood resonances and tiny suction pockets; no external samples.
export function synthesizeForestTexture(kind,seed,sampleRate){
 const r=random(seed),length=Math.round(lengths[kind]*sampleRate),samples=new Float32Array(length);
 let soft=0,brown=0,y1=0,y2=0,z1=0,z2=0;
 const pockets=[];
 for(let at=.15;at<lengths.wet;at+=.17+r()*.24)pockets.push({at,span:.10+r()*.20,freq:105+r()*180,phase:r()*6.28});
 for(let i=0;i<length;i++){
  const t=i/sampleRate,noise=r()*2-1;
  soft+=.11*(noise-soft);brown=(brown+noise*.018)/1.018;
  let value;
  if(kind==='creak'){
   const slip=Math.pow(Math.max(0,Math.sin(t*66+Math.sin(t*19)*1.9+seed)),5);
   const excitation=noise*(.06+slip*.94);
   const f=112-t*28+Math.sin(t*17+seed)*9,res=Math.exp(-Math.PI*22/sampleRate);
   const mode=2*res*Math.cos(2*Math.PI*f/sampleRate)*y1-res*res*y2+(1-res)*excitation;
   y2=y1;y1=mode;
   const res2=Math.exp(-Math.PI*95/sampleRate),mode2=2*res2*Math.cos(2*Math.PI*(330+Math.sin(t*11)*54)/sampleRate)*z1-res2*res2*z2+(1-res2)*excitation;
   z2=z1;z1=mode2;value=mode*.7+mode2*.45+soft*slip*.065;
  }else if(kind==='crack'){
   const splinter=Math.exp(-t*62)+.44*Math.exp(-Math.pow((t-.047)/.012,2))+.25*Math.exp(-Math.pow((t-.091)/.018,2));
   const res=Math.exp(-Math.PI*95/sampleRate),mode=2*res*Math.cos(2*Math.PI*240/sampleRate)*y1-res*res*y2+(1-res)*noise*splinter;
   y2=y1;y1=mode;value=soft*splinter*.55+mode*.8;
  }else if(kind==='wet'){
   const drag=.45+.22*Math.sin(t*3.1+Math.sin(t*5.7))+.12*Math.sin(t*13+seed);
   let suction=0;
   for(const pocket of pockets){const dt=t-pocket.at;if(dt<0||dt>pocket.span*4)continue;
    const envelope=(1-Math.exp(-dt*100))*Math.exp(-dt/pocket.span*2.5);
    suction+=Math.sin(pocket.phase+2*Math.PI*pocket.freq*(dt*.55+pocket.span*.45*(1-Math.exp(-dt/pocket.span))))*envelope;
   }
   value=soft*drag*.8+brown*.14+suction*.042;
  }else value=brown;
  const attack=kind==='crack'?.004:kind==='creak'?.035:.22,release=kind==='wet'?.65:.10;
  const envelope=kind==='wind'?1:Math.sin(clamp(t/attack,0,1)*Math.PI/2)**2*Math.sin(clamp((length-1-i)/sampleRate/release,0,1)*Math.PI/2)**2;
  samples[i]=value*envelope;
 }
 if(kind==='wind'){const seam=samples.at(-1)-samples[0];for(let i=0;i<length;i++)samples[i]-=seam*i/(length-1)}
 // Preserve silent ends and keep every source comfortably below full scale.
 let peak=0;for(const value of samples)peak=Math.max(peak,Math.abs(value));
 const scale=(kind==='wind'?.3:.7)/Math.max(.001,peak);
 for(let i=0;i<length;i++)samples[i]*=scale;
 return samples;
}

export function buildForestSoundEvents(scan,origin){
 const distance=cue=>Math.hypot(cue.x-origin.x,cue.z-origin.z),events=[];
 const selected=[];
 for(const tree of [...scan.trees].filter(t=>t.strength>.12&&distance(t)<14).sort((a,b)=>distance(a)-distance(b))){
  if(selected.some(t=>Math.hypot(t.x-tree.x,t.z-tree.z)<1.6))continue;
  selected.push(tree);if(selected.length===5)break;
 }
 const add=(kind,cue,at,gain,rate=1,variant=0)=>{
  const duration=lengths[kind]/rate;
  if(at<0||at>=PULSE_DURATION||gain<.001)return;
  events.push({kind,x:cue.x,y:cue.y+(kind==='creak'?1.8:.08),z:cue.z,at,gain:gain*cue.strength,rate,variant,duration:Math.min(duration,PULSE_DURATION-at),seed:cue.seed});
 };
 selected.forEach((tree,i)=>{
  const variant=Math.floor(tree.seed*4);
  add('crack',tree,tree.arrival+TREE_CONTRACTION_DELAY-.025,.025,1+tree.seed*.12,variant);
  add('creak',tree,tree.arrival+TREE_HEIGHT_DELAY*1.8,.043,.9+tree.seed*.16,variant);
  if(i<3)add('creak',tree,tree.arrival+TREE_ECHO_BASE+tree.seed*TREE_ECHO_SPREAD+TREE_HEIGHT_DELAY*1.8-.1,.018,.84+tree.seed*.12,(variant+1)%4);
 });
 const pools=[];
 for(const pool of [...scan.liquid].filter(p=>p.strength>.15&&distance(p)<13).sort((a,b)=>distance(a)-distance(b))){
  if(pools.some(p=>Math.hypot(p.x-pool.x,p.z-pool.z)<4))continue;
  pools.push(pool);if(pools.length===3)break;
 }
 pools.forEach(pool=>{
  const variant=Math.floor(pool.seed*3);
  add('wet',pool,pool.arrival+.28*LIQUID_SLOWDOWN,.036,1,variant);
  add('wet',pool,pool.arrival+2*LIQUID_SLOWDOWN,.031,.9,(variant+1)%3);
 });
 return events.sort((a,b)=>a.at-b.at);
}

export function createForestSoundscape(context){
 const master=context.createGain(),limiter=context.createDynamicsCompressor(),effects=context.createGain(),interfaceBus=context.createGain();
 master.gain.value=0;effects.gain.value=1;interfaceBus.gain.value=.6;
 limiter.threshold.value=-23;limiter.knee.value=15;limiter.ratio.value=5;limiter.attack.value=.012;limiter.release.value=.3;
 effects.connect(master);interfaceBus.connect(master);master.connect(limiter).connect(context.destination);
 const bank={};
 for(const kind of Object.keys(lengths))bank[kind]=Array.from({length:kind==='wind'?1:kind==='wet'?3:4},(_,i)=>{
  const samples=synthesizeForestTexture(kind,2137+i*733+kind.length*91,context.sampleRate),buffer=context.createBuffer(1,samples.length,context.sampleRate);
  buffer.copyToChannel(samples,0);return buffer;
 });
 const wind=context.createBufferSource(),windFilter=context.createBiquadFilter(),windGain=context.createGain();
 wind.buffer=bank.wind[0];wind.loop=true;windFilter.type='lowpass';windFilter.frequency.value=420;windGain.gain.value=0;
 wind.connect(windFilter).connect(windGain).connect(master);wind.start();
 const voices=new Map(),metrics={started:0,maxVoices:0};let events=[],enabled=false;
 function stopVoice(voice){
  if(voice.stopping)return;voice.stopping=true;
  const now=context.currentTime;voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setTargetAtTime(0,now,.012);
  voice.source.stop(now+.065);
 }
 function silence(){for(const voice of voices.values())stopVoice(voice);voices.clear()}
 function play(event,offset){
  const now=context.currentTime,source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),panner=context.createPanner();
  source.buffer=bank[event.kind][event.variant%bank[event.kind].length];source.playbackRate.value=event.rate;
  filter.type='lowpass';filter.frequency.value=event.kind==='wet'?(event.rate<1?780:1150):event.kind==='crack'?1250:1550;
  panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=3;panner.maxDistance=22;panner.rolloffFactor=1.25;
  panner.positionX.value=event.x;panner.positionY.value=event.y;panner.positionZ.value=event.z;
  const remaining=event.duration-offset,level=event.gain;
  gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(level,now+Math.min(.025,remaining/3));
  gain.gain.setValueAtTime(level,now+Math.max(.025,remaining-.07));gain.gain.linearRampToValueAtTime(0,now+remaining);
  source.connect(filter).connect(gain).connect(panner).connect(effects);
  const voice={source,gain,panner,filter,stopping:false};voices.set(event,voice);
  source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();panner.disconnect();if(!voice.stopping)event.finished=true;if(voices.get(event)===voice)voices.delete(event)};
  source.start(now,offset*event.rate);source.stop(now+remaining+.002);
  metrics.started++;metrics.maxVoices=Math.max(metrics.maxVoices,voices.size);
 }
 return {
  interfaceBus,metrics,
  setEnabled(value){enabled=value;master.gain.setTargetAtTime(value?.65:0,context.currentTime,.035);if(!value)silence()},
  pulse(scan,origin){silence();events=buildForestSoundEvents(scan,origin)},
  reset(){silence();events=[]},
  pause(){silence();windGain.gain.setTargetAtTime(0,context.currentTime,.08)},
  update({age,active,position,forward}){
   const listener=context.listener,now=context.currentTime;
   for(const [name,value]of [['positionX',position.x],['positionY',position.y],['positionZ',position.z],['forwardX',forward.x],['forwardY',forward.y],['forwardZ',forward.z],['upX',0],['upY',1],['upZ',0]])listener[name].setTargetAtTime(value,now,.025);
   windGain.gain.setTargetAtTime(enabled&&active?.027:0,now,.15);
   if(!enabled||!active){silence();return}
   for(const [event,voice]of voices)if(age>=event.at+event.duration)stopVoice(voice);
   for(const event of events){
    const offset=age-event.at;
    if(offset<0||offset>=event.duration-.035||event.finished||voices.has(event)||voices.size>=8)continue;
    // Resume from the current phase after pause/mute; never replay old transients.
    if(event.kind==='crack'&&offset>.065)continue;
    play(event,offset);
   }
  }
 };
}
