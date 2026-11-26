import {PULSE_DURATION,ARRIVAL_WINDOW,LIQUID_SLOWDOWN} from './pulse-timing.js?v=1.1.0-demo.1';
// Route-driven exposure under a viscous surface film. Rounded lobes, beads and
// connecting necks replace the earlier sharp finger mask.
export const scanFieldGLSL=`
 uniform sampler2D uNerveMap;
 uniform sampler2D uVeinMap;
 uniform float uForestSize;
 uniform vec3 uVeinTint;
 uniform vec3 uScanTint;
 struct TraceField { float reveal; float ink; float activity; float head; float grain; float edge; };
 float traceHash(vec3 p){p=fract(p*.3183099+vec3(.13,.37,.71));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
 float traceNoise(vec3 p){
  vec3 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(traceHash(cell),traceHash(cell+vec3(1,0,0)),f.x),mix(traceHash(cell+vec3(0,1,0)),traceHash(cell+vec3(1,1,0)),f.x),f.y),mix(mix(traceHash(cell+vec3(0,0,1)),traceHash(cell+vec3(1,0,1)),f.x),mix(traceHash(cell+vec3(0,1,1)),traceHash(cell+vec3(1,1,1)),f.x),f.y),f.z);
 }
 float traceBeat(float local,float seed){
  float first=exp(-pow(local/(.19+seed*.16),2.));
  float second=.82*exp(-pow((local-(.85+seed*.9))/.28,2.));
  float third=.55*exp(-pow((local-(2.4+seed*1.4))/.42,2.));
  return max(first,max(second,third))*smoothstep(-.12,.03,local);
 }
 TraceField traceField(vec3 p,vec3 origin,float age){
  TraceField field=TraceField(0.,1.,0.,0.,0.,0.);
  if(age<0.||age>${PULSE_DURATION.toFixed(1)})return field;
  vec2 uv=(p.xz+vec2(1.85))/uForestSize;vec4 route=texture2D(uNerveMap,uv);
  if(route.a<.001)return field;
  float local=age-route.r*${ARRIVAL_WINDOW.toFixed(1)};
  float h=max(0.,p.y-(route.g*4.-.25));
  float broad=traceNoise(vec3(p.x*.85,0.,p.z*.85));
  float lateral=(p.x*.81+p.z*.59)*1.65+(broad-.5)*.45;
  float cell=floor(lateral),within=fract(lateral)-.5;
  float seed=traceHash(vec3(cell,route.b*17.,7.));
  float cap=sqrt(max(0.,1.-pow(within/(.28+seed*.16),2.)));
  float liquid=local/${LIQUID_SLOWDOWN.toFixed(2)};
  float viscosity=.075*sin(liquid*2.4+seed*3.);
  float drain=3.7-liquid*4.9+cap*(.55+seed*.85)+broad*.35+viscosity;
  float open=smoothstep(drain-.18,drain+.21,h);
  // Rounded beads accelerate into the lower pool, with thinner viscous necks.
  float t=max(0.,liquid),dropY=5.15+seed*.7-(1.8+seed)*t-2.8*t*t;
  float radius=.075+seed*.095;
  float x=within/1.65+sin(h*2.1+seed*8.)*.012;
  float bead=1.-smoothstep(.84,1.12,length(vec2(x/radius,(h-dropY)/(radius*1.65))));
  float neck=(1.-smoothstep(radius*.19,radius*.43,abs(x)))*smoothstep(drain-.1,drain+.1,h)*(1.-smoothstep(dropY-.08,dropY+.08,h));
  float falling=smoothstep(.28,.5,liquid)*(1.-smoothstep(1.45,1.85,liquid));
  float drainingInk=max(1.-open,max(bead,neck*.92)*falling);
  float rise=pow(max(0.,liquid-2.),1.25)*5.4+cap*(.45+seed*.7)+broad*.28;
  float returning=smoothstep(2.,2.28,liquid);
  float clear=mix(1.,smoothstep(rise-.18,rise+.22,h),returning);
  float life=(1.-smoothstep(${(PULSE_DURATION-1).toFixed(1)},${PULSE_DURATION.toFixed(1)},age))*route.a;
  field.activity=smoothstep(-.05,.18,local)*(1.-smoothstep(3.35,3.9,liquid))*life;
  field.ink=(1.-drainingInk)*clear;
  field.reveal=(.65+.35*exp(-pow((local-.9)/.5,2.)))*field.activity;
  field.head=traceBeat(local,route.b)*life;
  field.grain=traceHash(floor(p*90.));
  field.edge=4.*field.ink*(1.-field.ink);
  return field;
 }
`;
