import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'
import GUI from 'lil-gui'

// ENTITY eligible -> REPOS -> DONUT.
// Aucun nouveau rendu visible : mêmes objets, même scène, mêmes lumières, mêmes matériaux.
// Le GPGPU ne calcule que les nouvelles coordonnées des billes, dans le repère LOCAL d'Entity.
const entityBodies=[]
let entityGroup=null,controls=null
const originalGuiAdd=GUI.prototype.add
GUI.prototype.add=function(object,property,...args){
  if(['ECART','TAILLE_BILLES','V1','RELATION_GLOBALE','LIBERTE','CHEVAUCHEMENT','ROTATION','FREQUENCE_INVERSIONS','BRILLANCE','INTENSITE_LUMIERE','LUMIERE_AMBIANTE','CAMERA'].includes(property))controls=object
  return originalGuiAdd.call(this,object,property,...args)
}
const originalAdd=THREE.Object3D.prototype.add
THREE.Object3D.prototype.add=function(...objects){
  const r=originalAdd.apply(this,objects)
  for(const o of objects)if(o?.userData?.textureUnitScale&&entityBodies.length<200){entityBodies.push(o);entityGroup=this}
  return r
}
await import('./main-first-connection-panel.js')
THREE.Object3D.prototype.add=originalAdd
GUI.prototype.add=originalGuiAdd

// Entity éligible REPOS.
if(controls)Object.assign(controls,{ECART:28,TAILLE_BILLES:.90,V1:.75,RELATION_GLOBALE:43,LIBERTE:.15,CHEVAUCHEMENT:1.45,ROTATION:.11,FREQUENCE_INVERSIONS:12,BRILLANCE:.62,INTENSITE_LUMIERE:2.25,LUMIERE_AMBIANTE:1,CAMERA:280})

const GOLDEN=Math.PI*(3-Math.sqrt(5))
function shellPoint(i,n=100){const y=1-(i+.5)*2/n,r=Math.sqrt(Math.max(0,1-y*y)),a=i*GOLDEN+2.31;return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r).multiplyScalar(3.32*28).applyEuler(new THREE.Euler(.21,-.27,.16))}
function cloneMaterial(m){const c=m.clone();if(c.isMeshStandardMaterial){c.emissive.set(0);c.emissiveIntensity=0}return c}
function cloneBody(src){const c=src.clone(true);c.traverse(n=>{if(n.material)n.material=Array.isArray(n.material)?n.material.map(cloneMaterial):cloneMaterial(n.material)});return c}
const pool=entityBodies.slice(),added=[]
for(let i=0;i<100;i++){const c=cloneBody(pool[Math.floor(Math.random()*pool.length)]);c.position.copy(shellPoint(i));entityGroup.add(c);added.push(c)}
const marbles=[...entityBodies,...added]

// --- moteur historique exact ---
const WIDTH=20,HEIGHT=15,BIRDS=300
const REFERENCE_BIRDS=32*32,REFERENCE_BOUNDS=800
const BOUNDS_FACTOR=.51
const BOUNDS=REFERENCE_BOUNDS*Math.cbrt(BIRDS/REFERENCE_BIRDS)*BOUNDS_FACTOR
const REPOS={CENTRE:4.9,SEPARATION:30,ALIGNEMENT:1,COHESION:60,VITESSE:.35,CAMERA:840,TAILLE:2.2}
const DONUT={...REPOS,ALIGNEMENT:8}
const HOLD_ENTITY=5
const TRANSITION_REPOS=7
const HOLD_REPOS=8
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)}

const positionShader=`uniform float time;uniform float delta;void main(){vec2 uv=gl_FragCoord.xy/resolution.xy;vec4 p=texture2D(texturePosition,uv);vec3 v=texture2D(textureVelocity,uv).xyz;float phase=mod((p.w+delta+length(v.xz)*delta*3.+max(v.y,0.0)*delta*6.),62.83);gl_FragColor=vec4(p.xyz+v*delta*15.,phase);}`
const velocityShader=`uniform float time;uniform float testing;uniform float delta;uniform float separationDistance;uniform float alignmentDistance;uniform float cohesionDistance;uniform float freedomFactor;uniform float centralPull;uniform vec3 predator;const float width=resolution.x;const float height=resolution.y;const float PI=3.141592653589793;const float PI_2=PI*2.0;float zoneRadius=40.0;float zoneRadiusSquared=1600.0;float separationThresh=.45;float alignmentThresh=.65;const float UPPER_BOUNDS=BOUNDS;const float SPEED_LIMIT=9.0;void main(){zoneRadius=separationDistance+alignmentDistance+cohesionDistance;separationThresh=separationDistance/zoneRadius;alignmentThresh=(separationDistance+alignmentDistance)/zoneRadius;zoneRadiusSquared=zoneRadius*zoneRadius;vec2 uv=gl_FragCoord.xy/resolution.xy;vec3 birdPosition,birdVelocity;vec3 selfPosition=texture2D(texturePosition,uv).xyz;vec3 selfVelocity=texture2D(textureVelocity,uv).xyz;float dist,distSquared,f,percent;vec3 dir;vec3 velocity=selfVelocity;float limit=SPEED_LIMIT;dir=predator*UPPER_BOUNDS-selfPosition;dir.z=0.;dist=length(dir);distSquared=dist*dist;float preyRadius=150.;float preyRadiusSq=preyRadius*preyRadius;if(dist<preyRadius){f=(distSquared/preyRadiusSq-1.0)*delta*100.;velocity+=normalize(dir)*f;limit+=5.;}dir=selfPosition;dist=length(dir);dir.y*=2.5;if(dist>.0001)velocity-=normalize(dir)*delta*centralPull;for(float y=0.;y<height;y++)for(float x=0.;x<width;x++){vec2 ref=vec2(x+.5,y+.5)/resolution.xy;birdPosition=texture2D(texturePosition,ref).xyz;dir=birdPosition-selfPosition;dist=length(dir);if(dist<.0001)continue;distSquared=dist*dist;if(distSquared>zoneRadiusSquared)continue;percent=distSquared/zoneRadiusSquared;if(percent<separationThresh){f=(separationThresh/percent-1.)*delta;velocity-=normalize(dir)*f;}else if(percent<alignmentThresh){float td=alignmentThresh-separationThresh;float ap=(percent-separationThresh)/td;birdVelocity=texture2D(textureVelocity,ref).xyz;f=(.5-cos(ap*PI_2)*.5+.5)*delta;velocity+=normalize(birdVelocity)*f;}else{float td=1.-alignmentThresh;float ap=td==0.?1.:(percent-alignmentThresh)/td;f=(.5-(cos(ap*PI_2)*-.5+.5))*delta;velocity+=normalize(dir)*f;}}if(length(velocity)>limit)velocity=normalize(velocity)*limit;gl_FragColor=vec4(velocity,1.);}`

let active=false,donut=false,gpuRenderer=null,gpu=null,pv=null,vv=null,pu=null,vu=null,last=performance.now(),transitionStart=0
const pixels=new Float32Array(BIRDS*4),targetPositions=Array.from({length:BIRDS},()=>new THREE.Vector3())
let allowReposWrite=false

function lockMarblePosition(o){
  const p=o.position
  for(const name of ['set','copy','add','addScaledVector','sub','subVectors','lerp']){
    if(typeof p[name]!=='function')continue
    const original=p[name].bind(p)
    p[name]=function(...args){if(!active||allowReposWrite)return original(...args);return this}
  }
}

function startRepos(){
  active=true;transitionStart=performance.now();last=transitionStart

  // IMPORTANT : le moteur GPGPU travaille dans le MEME repère local que les billes.
  // On ne mélange plus des positions monde avec des positions locales.
  const startLocal=marbles.map(o=>o.position.clone())
  for(const o of marbles)lockMarblePosition(o)

  // On coupe seulement les forces de déplacement Entity. Rien ne change dans son rendu.
  if(controls){controls.V1=0;controls.ROTATION=0}

  // Renderer caché : calcul uniquement, jamais affiché.
  gpuRenderer=new THREE.WebGLRenderer({antialias:false,alpha:false})
  gpuRenderer.setSize(32,32,false)
  gpuRenderer.domElement.style.display='none'
  document.body.appendChild(gpuRenderer.domElement)
  gpu=new GPUComputationRenderer(WIDTH,HEIGHT,gpuRenderer)
  const tp=gpu.createTexture(),tv=gpu.createTexture(),pd=tp.image.data,vd=tv.image.data
  for(let i=0;i<BIRDS;i++){
    const p=startLocal[i]
    pd[i*4]=p.x;pd[i*4+1]=p.y;pd[i*4+2]=p.z;pd[i*4+3]=1
    // Départ calme pour éviter une cassure visuelle ; la vitesse du moteur reste bien .35.
    vd[i*4]=(Math.random()-.5)*.8
    vd[i*4+1]=(Math.random()-.5)*.8
    vd[i*4+2]=(Math.random()-.5)*.8
    vd[i*4+3]=1
  }
  vv=gpu.addVariable('textureVelocity',velocityShader,tv);pv=gpu.addVariable('texturePosition',positionShader,tp)
  gpu.setVariableDependencies(vv,[pv,vv]);gpu.setVariableDependencies(pv,[pv,vv])
  pu=pv.material.uniforms;vu=vv.material.uniforms
  pu.time={value:0};pu.delta={value:0};vu.time={value:1};vu.delta={value:0};vu.testing={value:1}
  vu.separationDistance={value:REPOS.SEPARATION};vu.alignmentDistance={value:REPOS.ALIGNEMENT};vu.cohesionDistance={value:REPOS.COHESION};vu.freedomFactor={value:.75};vu.centralPull={value:REPOS.CENTRE};vu.predator={value:new THREE.Vector3(10000,10000,0)}
  vv.material.defines.BOUNDS=BOUNDS.toFixed(2);vv.wrapS=vv.wrapT=pv.wrapS=pv.wrapT=THREE.RepeatWrapping
  const err=gpu.init();if(err)throw new Error(err)
}

const t0=performance.now()
function animateRepos(){
  requestAnimationFrame(animateRepos)
  if(!active&&performance.now()-t0>HOLD_ENTITY*1000)startRepos()
  if(!active)return

  const now=performance.now(),elapsed=(now-transitionStart)/1000
  let delta=Math.min((now-last)/1000,.05);last=now
  const k=smooth(elapsed/TRANSITION_REPOS)

  // REPOS : valeurs de curseurs exactes atteintes sans saut visuel.
  if(controls){
    controls.CAMERA=THREE.MathUtils.lerp(280,REPOS.CAMERA,k)
    controls.TAILLE_BILLES=THREE.MathUtils.lerp(.90,REPOS.TAILLE,k)
  }

  const simulationDelta=delta*REPOS.VITESSE
  pu.time.value=now;pu.delta.value=simulationDelta;vu.time.value=now;vu.delta.value=simulationDelta
  gpu.compute()
  gpuRenderer.readRenderTargetPixels(gpu.getCurrentRenderTarget(pv),0,0,WIDTH,HEIGHT,pixels)

  // La matière visible suit progressivement le murmure ; à k=0 elle ne bouge pas,
  // à k=1 elle suit exactement les coordonnées GPGPU.
  const follow=.02+.98*k
  allowReposWrite=true
  for(let i=0;i<BIRDS;i++){
    targetPositions[i].set(pixels[i*4],pixels[i*4+1],pixels[i*4+2])
    marbles[i].position.lerp(targetPositions[i],follow)
  }
  allowReposWrite=false

  // DONUT historique : après REPOS établi, SEUL ALIGNEMENT passe directement de 1 à 8.
  if(!donut&&elapsed>=TRANSITION_REPOS+HOLD_REPOS){
    donut=true
    vu.alignmentDistance.value=DONUT.ALIGNEMENT
  }
}
animateRepos()

const status=document.createElement('div')
Object.assign(status.style,{position:'fixed',left:'14px',bottom:'12px',zIndex:'100',color:'rgba(255,255,255,.62)',font:'12px Arial',pointerEvents:'none'})
document.body.appendChild(status)
function statusLoop(){
  requestAnimationFrame(statusLoop)
  if(!active){status.textContent='ENTITY éligible — préparation REPOS';return}
  status.textContent=donut
    ?'DONUT — BOUNDS .51 · CENTRE 4.9 · SEP 30 · ALIGN 8 · COH 60 · VITESSE .35 · CAMERA 840 · TAILLE 2.2'
    :'REPOS — BOUNDS .51 · CENTRE 4.9 · SEP 30 · ALIGN 1 · COH 60 · VITESSE .35 · CAMERA 840 · TAILLE 2.2'
}
statusLoop()
