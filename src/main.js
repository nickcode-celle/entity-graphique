import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'
import GUI from 'lil-gui'
import './style.css'

const WIDTH = 40
const HEIGHT = 25
const BIRDS = WIDTH * HEIGHT
const REFERENCE_BIRDS = 32 * 32
const REFERENCE_BOUNDS = 800
const BASE_BOUNDS = REFERENCE_BOUNDS * Math.cbrt(BIRDS / REFERENCE_BIRDS)
const initialFactor = Number(new URLSearchParams(location.search).get('bounds')) || 1
const BOUNDS_FACTOR = THREE.MathUtils.clamp(initialFactor, 0.02, 1)
const BOUNDS = BASE_BOUNDS * BOUNDS_FACTOR
const BOUNDS_HALF = BOUNDS / 2

const app = document.querySelector('#app')
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
app.appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x16181b)
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 1, 4000)
camera.position.z = 850
let mouseX = 10000, mouseY = 10000, windowHalfX = innerWidth/2, windowHalfY = innerHeight/2, last = performance.now()
let movementSpeed = 1

const positionShader = `
uniform float time; uniform float delta;
void main(){
 vec2 uv=gl_FragCoord.xy/resolution.xy; vec4 p=texture2D(texturePosition,uv); vec3 v=texture2D(textureVelocity,uv).xyz;
 float phase=mod((p.w+delta+length(v.xz)*delta*3.+max(v.y,0.0)*delta*6.),62.83);
 gl_FragColor=vec4(p.xyz+v*delta*15.,phase);
}`

const velocityShader = `
uniform float time; uniform float testing; uniform float delta;
uniform float separationDistance; uniform float alignmentDistance; uniform float cohesionDistance; uniform float freedomFactor; uniform float centralPull; uniform vec3 predator;
const float width=resolution.x; const float height=resolution.y; const float PI=3.141592653589793; const float PI_2=PI*2.0;
float zoneRadius=40.0; float zoneRadiusSquared=1600.0; float separationThresh=.45; float alignmentThresh=.65;
const float UPPER_BOUNDS=BOUNDS; const float LOWER_BOUNDS=-UPPER_BOUNDS; const float SPEED_LIMIT=9.0;
void main(){
 zoneRadius=separationDistance+alignmentDistance+cohesionDistance; separationThresh=separationDistance/zoneRadius; alignmentThresh=(separationDistance+alignmentDistance)/zoneRadius; zoneRadiusSquared=zoneRadius*zoneRadius;
 vec2 uv=gl_FragCoord.xy/resolution.xy; vec3 birdPosition,birdVelocity; vec3 selfPosition=texture2D(texturePosition,uv).xyz; vec3 selfVelocity=texture2D(textureVelocity,uv).xyz;
 float dist,distSquared,f,percent; vec3 dir; vec3 velocity=selfVelocity; float limit=SPEED_LIMIT;
 dir=predator*UPPER_BOUNDS-selfPosition; dir.z=0.; dist=length(dir); distSquared=dist*dist; float preyRadius=150.; float preyRadiusSq=preyRadius*preyRadius;
 if(dist<preyRadius){f=(distSquared/preyRadiusSq-1.0)*delta*100.; velocity+=normalize(dir)*f; limit+=5.;}
 dir=selfPosition; dist=length(dir); dir.y*=2.5; velocity-=normalize(dir)*delta*centralPull;
 for(float y=0.;y<height;y++) for(float x=0.;x<width;x++){
   vec2 ref=vec2(x+.5,y+.5)/resolution.xy; birdPosition=texture2D(texturePosition,ref).xyz; dir=birdPosition-selfPosition; dist=length(dir); if(dist<.0001) continue;
   distSquared=dist*dist; if(distSquared>zoneRadiusSquared) continue; percent=distSquared/zoneRadiusSquared;
   if(percent<separationThresh){f=(separationThresh/percent-1.)*delta; velocity-=normalize(dir)*f;}
   else if(percent<alignmentThresh){float td=alignmentThresh-separationThresh; float ap=(percent-separationThresh)/td; birdVelocity=texture2D(textureVelocity,ref).xyz; f=(.5-cos(ap*PI_2)*.5+.5)*delta; velocity+=normalize(birdVelocity)*f;}
   else {float td=1.-alignmentThresh; float ap=td==0.?1.:(percent-alignmentThresh)/td; f=(.5-(cos(ap*PI_2)*-.5+.5))*delta; velocity+=normalize(dir)*f;}
 }
 if(length(velocity)>limit) velocity=normalize(velocity)*limit; gl_FragColor=vec4(velocity,1.);
}`

const gpuCompute=new GPUComputationRenderer(WIDTH,HEIGHT,renderer)
const dtPosition=gpuCompute.createTexture(), dtVelocity=gpuCompute.createTexture()
for(let k=0;k<dtPosition.image.data.length;k+=4){dtPosition.image.data[k]=Math.random()*BOUNDS-BOUNDS_HALF;dtPosition.image.data[k+1]=Math.random()*BOUNDS-BOUNDS_HALF;dtPosition.image.data[k+2]=Math.random()*BOUNDS-BOUNDS_HALF;dtPosition.image.data[k+3]=1}
for(let k=0;k<dtVelocity.image.data.length;k+=4){dtVelocity.image.data[k]=(Math.random()-.5)*10;dtVelocity.image.data[k+1]=(Math.random()-.5)*10;dtVelocity.image.data[k+2]=(Math.random()-.5)*10;dtVelocity.image.data[k+3]=1}
const velocityVariable=gpuCompute.addVariable('textureVelocity',velocityShader,dtVelocity), positionVariable=gpuCompute.addVariable('texturePosition',positionShader,dtPosition)
gpuCompute.setVariableDependencies(velocityVariable,[positionVariable,velocityVariable]);gpuCompute.setVariableDependencies(positionVariable,[positionVariable,velocityVariable])
const pu=positionVariable.material.uniforms, vu=velocityVariable.material.uniforms
pu.time={value:0};pu.delta={value:0};vu.time={value:1};vu.delta={value:0};vu.testing={value:1};vu.separationDistance={value:20};vu.alignmentDistance={value:20};vu.cohesionDistance={value:20};vu.freedomFactor={value:.75};vu.centralPull={value:5};vu.predator={value:new THREE.Vector3()};velocityVariable.material.defines.BOUNDS=BOUNDS.toFixed(2)
velocityVariable.wrapS=velocityVariable.wrapT=positionVariable.wrapS=positionVariable.wrapT=THREE.RepeatWrapping
const err=gpuCompute.init();if(err!==null)throw new Error(err)

const base=new THREE.SphereGeometry(3.2,16,12), geo=new THREE.InstancedBufferGeometry();geo.index=base.index;geo.setAttribute('position',base.getAttribute('position'));geo.setAttribute('normal',base.getAttribute('normal'));geo.setAttribute('uv',base.getAttribute('uv'));geo.instanceCount=BIRDS
const refs=new Float32Array(BIRDS*2);for(let i=0;i<BIRDS;i++){refs[i*2]=(i%WIDTH+.5)/WIDTH;refs[i*2+1]=(Math.floor(i/WIDTH)+.5)/HEIGHT}geo.setAttribute('reference',new THREE.InstancedBufferAttribute(refs,2))
const su={texturePosition:{value:null},marbleScale:{value:1}}
const mat=new THREE.ShaderMaterial({uniforms:su,vertexShader:`attribute vec2 reference;uniform sampler2D texturePosition;uniform float marbleScale;varying vec3 vNormal;varying float vDepth;void main(){vec3 c=texture2D(texturePosition,reference).xyz;vec3 w=c+position*marbleScale;vNormal=normalize(normalMatrix*normal);vDepth=w.z;gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}`,fragmentShader:`varying vec3 vNormal;varying float vDepth;void main(){vec3 l=normalize(vec3(.4,.7,.6));float d=.42+max(dot(vNormal,l),0.)*.58;float z=clamp((vDepth+400.)/800.,0.,1.);gl_FragColor=vec4(vec3(d*mix(.68,1.,z)),1.);}`})
scene.add(new THREE.Mesh(geo,mat))

const label=document.createElement('div');label.textContent=`1000 billes — BOUNDS ${(BOUNDS_FACTOR*100).toFixed(0)}%`;Object.assign(label.style,{position:'fixed',left:'14px',bottom:'12px',color:'rgba(255,255,255,.55)',font:'12px Arial',pointerEvents:'none'});document.body.appendChild(label)

const controls={BOUNDS:BOUNDS_FACTOR,CENTRE:5,SEPARATION:20,ALIGNEMENT:20,COHESION:20,CAMERA:850,TAILLE:1,VITESSE:1}
const gui=new GUI({title:'ENTITY'})
gui.add(controls,'BOUNDS',.02,1,.01).name('BOUNDS').onFinishChange(value=>{const u=new URL(location.href);u.searchParams.set('bounds',value.toFixed(2));location.href=u.toString()})
gui.add(controls,'CENTRE',0,30,.1).name('CENTRE').onChange(value=>{vu.centralPull.value=value})
const physics=gui.addFolder('PHYSIQUE — TEST')
physics.add(controls,'SEPARATION',1,60,1).name('SEPARATION').onChange(value=>{vu.separationDistance.value=value})
physics.add(controls,'ALIGNEMENT',1,60,1).name('ALIGNEMENT').onChange(value=>{vu.alignmentDistance.value=value})
physics.add(controls,'COHESION',1,60,1).name('COHESION').onChange(value=>{vu.cohesionDistance.value=value})
physics.close()
gui.add(controls,'CAMERA',500,1600,10).name('CAMERA').onChange(value=>{camera.position.z=value})
gui.add(controls,'TAILLE',.25,3,.05).name('TAILLE BILLES').onChange(value=>{su.marbleScale.value=value})
gui.add(controls,'VITESSE',.1,3,.05).name('VITESSE').onChange(value=>{movementSpeed=value})

renderer.domElement.addEventListener('pointermove',e=>{if(e.isPrimary===false)return;mouseX=e.clientX-windowHalfX;mouseY=e.clientY-windowHalfY})
addEventListener('resize',()=>{windowHalfX=innerWidth/2;windowHalfY=innerHeight/2;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})
function animate(){requestAnimationFrame(animate);const now=performance.now();let delta=(now-last)/1000;if(delta>1)delta=1;last=now;const simulationDelta=delta*movementSpeed;pu.time.value=now;pu.delta.value=simulationDelta;vu.time.value=now;vu.delta.value=simulationDelta;vu.predator.value.set(.5*mouseX/windowHalfX,-.5*mouseY/windowHalfY,0);mouseX=mouseY=10000;gpuCompute.compute();su.texturePosition.value=gpuCompute.getCurrentRenderTarget(positionVariable).texture;renderer.render(scene,camera)}
animate()
