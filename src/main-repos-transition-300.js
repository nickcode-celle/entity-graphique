import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'
import GUI from 'lil-gui'

// ENTITY -> REPOS murmuration -> DONUT murmuration
// Moteur récupéré du prototype historique GPGPU Three.js utilisé avec les billes blanches.
// REPOS : BOUNDS .51 / CENTRE 4.9 / SEPARATION 30 / ALIGNEMENT 1 / COHESION 60
// DONUT : même murmuration, saut direct ALIGNEMENT 1 -> 8.

const bodies=[]
let entityGroup=null
let controls=null

const originalGuiAdd=GUI.prototype.add
GUI.prototype.add=function(object,property,...args){
  if(['ECART','TAILLE_BILLES','V1','RELATION_GLOBALE','LIBERTE','CHEVAUCHEMENT','ROTATION','FREQUENCE_INVERSIONS','BRILLANCE','INTENSITE_LUMIERE','LUMIERE_AMBIANTE','CAMERA'].includes(property)) controls=object
  return originalGuiAdd.call(this,object,property,...args)
}

const originalAdd=THREE.Object3D.prototype.add
THREE.Object3D.prototype.add=function(...objects){
  const result=originalAdd.apply(this,objects)
  for(const o of objects){
    if(o?.userData?.textureUnitScale&&bodies.length<200){bodies.push(o);entityGroup=this}
  }
  return result
}

await import('./main-first-connection-panel.js')
THREE.Object3D.prototype.add=originalAdd
GUI.prototype.add=originalGuiAdd

if(controls) Object.assign(controls,{
  ECART:28,
  TAILLE_BILLES:.90,
  V1:.75,
  RELATION_GLOBALE:43,
  LIBERTE:.15,
  CHEVAUCHEMENT:1.45,
  ROTATION:.11,
  FREQUENCE_INVERSIONS:12,
  BRILLANCE:.62,
  INTENSITE_LUMIERE:2.25,
  LUMIERE_AMBIANTE:1,
  CAMERA:280
})

const rnd=(a,b)=>THREE.MathUtils.lerp(a,b,Math.random())
const randomUnit=()=>new THREE.Vector3(Math.random()*2-1,Math.random()*2-1,Math.random()*2-1).normalize()

function cloneMaterial(m){
  const c=m.clone()
  if(c.isMeshStandardMaterial){c.emissive.set(0);c.emissiveIntensity=0}
  return c
}
function cloneBody(src){
  const c=src.clone(true)
  c.traverse(n=>{
    if(n.material)n.material=Array.isArray(n.material)?n.material.map(cloneMaterial):cloneMaterial(n.material)
    if(n.isMesh){n.castShadow=true;n.receiveShadow=true}
  })
  return c
}

// DONUT est accessible à 500 billes : on conserve la matière graphique d'Entity.
const sourcePool=bodies.slice()
for(let i=0;i<300;i++){
  const c=cloneBody(sourcePool[Math.floor(Math.random()*sourcePool.length)])
  c.userData.__donut500=true
  c.position.copy(randomUnit().multiplyScalar(rnd(72,98)))
  entityGroup.add(c)
  bodies.push(c)
}

// ---- MOTEUR HISTORIQUE GPGPU ----
// Source récupérée : prototype Three.js GPGPU, commit fc06cec57d2eb71639e3db4be4548c5359cbadc2.
// 20 x 25 = 500 agents. BASE_BOUNDS est recalculé selon la même règle de densité que le prototype.
const WIDTH=20
const HEIGHT=25
const BIRDS=WIDTH*HEIGHT
const REFERENCE_BIRDS=32*32
const REFERENCE_BOUNDS=800
const BASE_BOUNDS=REFERENCE_BOUNDS*Math.cbrt(BIRDS/REFERENCE_BIRDS)
const BOUNDS_FACTOR=.51
const BOUNDS=BASE_BOUNDS*BOUNDS_FACTOR
const BOUNDS_HALF=BOUNDS/2

const positionShader=`
uniform float time; uniform float delta;
void main(){
 vec2 uv=gl_FragCoord.xy/resolution.xy; vec4 p=texture2D(texturePosition,uv); vec3 v=texture2D(textureVelocity,uv).xyz;
 float phase=mod((p.w+delta+length(v.xz)*delta*3.+max(v.y,0.0)*delta*6.),62.83);
 gl_FragColor=vec4(p.xyz+v*delta*15.,phase);
}`

const velocityShader=`
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

let computeRenderer=null
let gpuCompute=null
let positionVariable=null
let velocityVariable=null
let pu=null
let vu=null
let pixels=null
let murmurationReady=false
let readbackFailed=false

function initHistoricalMurmuration(){
  if(murmurationReady)return

  // Renderer uniquement destiné au calcul GPU : rien n'est ajouté à l'écran.
  computeRenderer=new THREE.WebGLRenderer({antialias:false,alpha:true})
  computeRenderer.setPixelRatio(1)
  computeRenderer.setSize(WIDTH,HEIGHT,false)

  gpuCompute=new GPUComputationRenderer(WIDTH,HEIGHT,computeRenderer)
  const dtPosition=gpuCompute.createTexture()
  const dtVelocity=gpuCompute.createTexture()

  // La simulation démarre exactement depuis les positions visibles des mêmes billes.
  for(let i=0;i<BIRDS;i++){
    const k=i*4
    const p=bodies[i].position
    dtPosition.image.data[k]=THREE.MathUtils.clamp(p.x,-BOUNDS_HALF,BOUNDS_HALF)
    dtPosition.image.data[k+1]=THREE.MathUtils.clamp(p.y,-BOUNDS_HALF,BOUNDS_HALF)
    dtPosition.image.data[k+2]=THREE.MathUtils.clamp(p.z,-BOUNDS_HALF,BOUNDS_HALF)
    dtPosition.image.data[k+3]=1
    dtVelocity.image.data[k]=(Math.random()-.5)*10
    dtVelocity.image.data[k+1]=(Math.random()-.5)*10
    dtVelocity.image.data[k+2]=(Math.random()-.5)*10
    dtVelocity.image.data[k+3]=1
  }

  velocityVariable=gpuCompute.addVariable('textureVelocity',velocityShader,dtVelocity)
  positionVariable=gpuCompute.addVariable('texturePosition',positionShader,dtPosition)
  gpuCompute.setVariableDependencies(velocityVariable,[positionVariable,velocityVariable])
  gpuCompute.setVariableDependencies(positionVariable,[positionVariable,velocityVariable])

  pu=positionVariable.material.uniforms
  vu=velocityVariable.material.uniforms
  pu.time={value:0}
  pu.delta={value:0}
  vu.time={value:1}
  vu.delta={value:0}
  vu.testing={value:1}
  vu.separationDistance={value:30}
  vu.alignmentDistance={value:1}
  vu.cohesionDistance={value:60}
  vu.freedomFactor={value:.75}
  vu.centralPull={value:4.9}
  // Predator désactivé, comme lorsque le pointeur est hors de la zone d'influence.
  vu.predator={value:new THREE.Vector3(10000,10000,0)}
  velocityVariable.material.defines.BOUNDS=BOUNDS.toFixed(2)
  velocityVariable.wrapS=velocityVariable.wrapT=positionVariable.wrapS=positionVariable.wrapT=THREE.RepeatWrapping

  const err=gpuCompute.init()
  if(err!==null)throw new Error(err)

  pixels=new Float32Array(BIRDS*4)
  murmurationReady=true
}

const NORMAL_HOLD=4
const REPOS_HOLD=5
const DONUT_START=NORMAL_HOLD+REPOS_HOLD
const HISTORICAL_SPEED=.35
const clock=new THREE.Clock()
const started=performance.now()/1000

function updateBodiesFromGpu(){
  if(readbackFailed)return
  try{
    const target=gpuCompute.getCurrentRenderTarget(positionVariable)
    computeRenderer.readRenderTargetPixels(target,0,0,WIDTH,HEIGHT,pixels)
    for(let i=0;i<BIRDS;i++){
      const k=i*4
      bodies[i].position.set(pixels[k],pixels[k+1],pixels[k+2])
    }
  }catch(error){
    readbackFailed=true
    console.error('ENTITY — lecture positions GPGPU impossible',error)
  }
}

function animate(){
  requestAnimationFrame(animate)
  const dt=Math.min(clock.getDelta(),.035)
  const t=performance.now()/1000-started
  if(t<NORMAL_HOLD)return

  if(!murmurationReady)initHistoricalMurmuration()

  // La structure quotidienne d'Entity cesse de piloter la matière ; les mêmes billes
  // sont désormais pilotées par le moteur historique de murmuration.
  if(controls){controls.V1=0;controls.ROTATION=0}

  const donut=t>=DONUT_START
  vu.separationDistance.value=30
  vu.cohesionDistance.value=60
  vu.centralPull.value=4.9
  // Recette historique : REPOS=1 puis saut DIRECT à 8 pour faire émerger DONUT.
  vu.alignmentDistance.value=donut?8:1

  const ramp=THREE.MathUtils.smoothstep(t,NORMAL_HOLD,NORMAL_HOLD+1.15)
  const simulationDelta=dt*HISTORICAL_SPEED*ramp
  const now=performance.now()
  pu.time.value=now
  pu.delta.value=simulationDelta
  vu.time.value=now
  vu.delta.value=simulationDelta

  gpuCompute.compute()
  updateBodiesFromGpu()
}
animate()

const label=[...document.querySelectorAll('div')].find(el=>el.textContent?.startsWith('ENTITY — Première connexion'))
if(label)label.textContent='ENTITY → REPOS GPGPU historique → DONUT GPGPU historique · 500 billes · ALIGNEMENT 1→8'
const title=document.querySelector('.lil-gui.root > .title')
if(title)title.textContent='ENTITY — REPOS → DONUT · MOTEUR HISTORIQUE'
