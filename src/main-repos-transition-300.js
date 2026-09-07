import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'
import GUI from 'lil-gui'

// Entity eligible -> REPOS historique.
// Entity garde son renderer intact. Au déclenchement, un second canvas indépendant
// prend le relais avec le moteur GPGPU historique et ses propres caméra/échelle/physique.

const entityBodies=[]
let entityGroup=null
let controls=null

const originalGuiAdd=GUI.prototype.add
GUI.prototype.add=function(object,property,...args){
  if(['ECART','TAILLE_BILLES','V1','RELATION_GLOBALE','LIBERTE','CHEVAUCHEMENT','ROTATION','FREQUENCE_INVERSIONS','BRILLANCE','INTENSITE_LUMIERE','LUMIERE_AMBIANTE','CAMERA'].includes(property))controls=object
  return originalGuiAdd.call(this,object,property,...args)
}
const originalAdd=THREE.Object3D.prototype.add
THREE.Object3D.prototype.add=function(...objects){
  const result=originalAdd.apply(this,objects)
  for(const o of objects)if(o?.userData?.textureUnitScale&&entityBodies.length<200){entityBodies.push(o);entityGroup=this}
  return result
}

await import('./main-first-connection-panel.js')
THREE.Object3D.prototype.add=originalAdd
GUI.prototype.add=originalGuiAdd

if(controls)Object.assign(controls,{ECART:28,TAILLE_BILLES:.90,V1:.75,RELATION_GLOBALE:43,LIBERTE:.15,CHEVAUCHEMENT:1.45,ROTATION:.11,FREQUENCE_INVERSIONS:12,BRILLANCE:.62,INTENSITE_LUMIERE:2.25,LUMIERE_AMBIANTE:1,CAMERA:280})

const GOLDEN=Math.PI*(3-Math.sqrt(5))
function shellPoint(i,n=100){
  const y=1-(i+.5)*2/n,r=Math.sqrt(Math.max(0,1-y*y)),a=i*GOLDEN+2.31
  return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r).multiplyScalar(3.32*28).applyEuler(new THREE.Euler(.21,-.27,.16))
}
function cloneMaterial(m){const c=m.clone();if(c.isMeshStandardMaterial){c.emissive.set(0);c.emissiveIntensity=0}return c}
function cloneBody(src){const c=src.clone(true);c.traverse(n=>{if(n.material)n.material=Array.isArray(n.material)?n.material.map(cloneMaterial):cloneMaterial(n.material)});return c}

// 300 billes : seuil d'éligibilité REPOS.
const pool=entityBodies.slice(),added=[]
for(let i=0;i<100;i++){
  const c=cloneBody(pool[Math.floor(Math.random()*pool.length)])
  c.position.copy(shellPoint(i))
  entityGroup.add(c)
  added.push(c)
}
const visibleEntity=[...entityBodies,...added]
const domains={PERSONNALITE:42,RELATION:43,GOUTS:41,OPINIONS_VALEURS:44,CONNAISSANCES:42,MONDE_PROPRE:43,HISTOIRE_VECUE:36,CAPACITES:28};void domains

// --- REPOS historique : moteur exact ---
const WIDTH=20,HEIGHT=15,BIRDS=WIDTH*HEIGHT
const REFERENCE_BIRDS=32*32
const REFERENCE_BOUNDS=800
const BASE_BOUNDS=REFERENCE_BOUNDS*Math.cbrt(BIRDS/REFERENCE_BIRDS)
const BOUNDS_FACTOR=.51
const BOUNDS=BASE_BOUNDS*BOUNDS_FACTOR
const SPEED=.35
const CENTRE=4.9
const SEPARATION=30
const ALIGNEMENT=1
const COHESION=60
const CAMERA=840
const TAILLE=2.2

const positionShader=`
uniform float time;uniform float delta;
void main(){
 vec2 uv=gl_FragCoord.xy/resolution.xy;vec4 p=texture2D(texturePosition,uv);vec3 v=texture2D(textureVelocity,uv).xyz;
 float phase=mod((p.w+delta+length(v.xz)*delta*3.+max(v.y,0.0)*delta*6.),62.83);
 gl_FragColor=vec4(p.xyz+v*delta*15.,phase);
}`
const velocityShader=`
uniform float time;uniform float testing;uniform float delta;
uniform float separationDistance;uniform float alignmentDistance;uniform float cohesionDistance;uniform float freedomFactor;uniform float centralPull;uniform vec3 predator;
const float width=resolution.x;const float height=resolution.y;const float PI=3.141592653589793;const float PI_2=PI*2.0;
float zoneRadius=40.0;float zoneRadiusSquared=1600.0;float separationThresh=.45;float alignmentThresh=.65;
const float UPPER_BOUNDS=BOUNDS;const float LOWER_BOUNDS=-UPPER_BOUNDS;const float SPEED_LIMIT=9.0;
void main(){
 zoneRadius=separationDistance+alignmentDistance+cohesionDistance;
 separationThresh=separationDistance/zoneRadius;
 alignmentThresh=(separationDistance+alignmentDistance)/zoneRadius;
 zoneRadiusSquared=zoneRadius*zoneRadius;
 vec2 uv=gl_FragCoord.xy/resolution.xy;vec3 birdPosition,birdVelocity;
 vec3 selfPosition=texture2D(texturePosition,uv).xyz;vec3 selfVelocity=texture2D(textureVelocity,uv).xyz;
 float dist,distSquared,f,percent;vec3 dir;vec3 velocity=selfVelocity;float limit=SPEED_LIMIT;
 dir=predator*UPPER_BOUNDS-selfPosition;dir.z=0.;dist=length(dir);distSquared=dist*dist;
 float preyRadius=150.;float preyRadiusSq=preyRadius*preyRadius;
 if(dist<preyRadius){f=(distSquared/preyRadiusSq-1.0)*delta*100.;velocity+=normalize(dir)*f;limit+=5.;}
 dir=selfPosition;dist=length(dir);dir.y*=2.5;velocity-=normalize(dir)*delta*centralPull;
 for(float y=0.;y<height;y++)for(float x=0.;x<width;x++){
   vec2 ref=vec2(x+.5,y+.5)/resolution.xy;birdPosition=texture2D(texturePosition,ref).xyz;
   dir=birdPosition-selfPosition;dist=length(dir);if(dist<.0001)continue;
   distSquared=dist*dist;if(distSquared>zoneRadiusSquared)continue;percent=distSquared/zoneRadiusSquared;
   if(percent<separationThresh){f=(separationThresh/percent-1.)*delta;velocity-=normalize(dir)*f;}
   else if(percent<alignmentThresh){float td=alignmentThresh-separationThresh;float ap=(percent-separationThresh)/td;birdVelocity=texture2D(textureVelocity,ref).xyz;f=(.5-cos(ap*PI_2)*.5+.5)*delta;velocity+=normalize(birdVelocity)*f;}
   else{float td=1.-alignmentThresh;float ap=td==0.?1.:(percent-alignmentThresh)/td;f=(.5-(cos(ap*PI_2)*-.5+.5))*delta;velocity+=normalize(dir)*f;}
 }
 if(length(velocity)>limit)velocity=normalize(velocity)*limit;
 gl_FragColor=vec4(velocity,1.);
}`

let active=false
let renderer=null,scene=null,camera=null,gpu=null,pv=null,vv=null,pu=null,vu=null,material=null
let last=performance.now(),mouseX=10000,mouseY=10000,halfX=innerWidth/2,halfY=innerHeight/2

function getBodyColor(o){
  let found=null
  o.traverse(n=>{
    if(found||!n.isMesh)return
    const m=Array.isArray(n.material)?n.material[0]:n.material
    if(m?.color)found=m.color.clone()
  })
  return found||new THREE.Color(0xffffff)
}

function startRepos(){
  active=true
  // Capture exacte juste avant de couper visuellement Entity.
  entityGroup.updateMatrixWorld(true)
  const positions=[]
  const colors=[]
  for(const o of visibleEntity){
    const p=new THREE.Vector3();o.getWorldPosition(p);positions.push(p);colors.push(getBodyColor(o))
  }

  // Canvas totalement indépendant : aucun renderer/post-traitement Entity n'est réutilisé.
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false})
  renderer.setPixelRatio(Math.min(devicePixelRatio,2))
  renderer.setSize(innerWidth,innerHeight)
  renderer.outputColorSpace=THREE.SRGBColorSpace
  Object.assign(renderer.domElement.style,{position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'50',display:'block'})
  document.body.appendChild(renderer.domElement)

  scene=new THREE.Scene()
  scene.background=new THREE.Color(0x08090b)
  camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,1,4000)
  camera.position.set(0,0,CAMERA)

  gpu=new GPUComputationRenderer(WIDTH,HEIGHT,renderer)
  const tp=gpu.createTexture(),tv=gpu.createTexture(),pd=tp.image.data,vd=tv.image.data
  for(let i=0;i<BIRDS;i++){
    const p=positions[i]
    pd[i*4]=p.x;pd[i*4+1]=p.y;pd[i*4+2]=p.z;pd[i*4+3]=1
    vd[i*4]=(Math.random()-.5)*10;vd[i*4+1]=(Math.random()-.5)*10;vd[i*4+2]=(Math.random()-.5)*10;vd[i*4+3]=1
  }
  vv=gpu.addVariable('textureVelocity',velocityShader,tv)
  pv=gpu.addVariable('texturePosition',positionShader,tp)
  gpu.setVariableDependencies(vv,[pv,vv]);gpu.setVariableDependencies(pv,[pv,vv])
  pu=pv.material.uniforms;vu=vv.material.uniforms
  pu.time={value:0};pu.delta={value:0};vu.time={value:1};vu.delta={value:0};vu.testing={value:1}
  vu.separationDistance={value:SEPARATION};vu.alignmentDistance={value:ALIGNEMENT};vu.cohesionDistance={value:COHESION}
  vu.freedomFactor={value:.75};vu.centralPull={value:CENTRE};vu.predator={value:new THREE.Vector3()}
  vv.material.defines.BOUNDS=BOUNDS.toFixed(2)
  vv.wrapS=vv.wrapT=pv.wrapS=pv.wrapT=THREE.RepeatWrapping
  const err=gpu.init();if(err)throw new Error(err)

  const base=new THREE.SphereGeometry(3.2,16,12)
  const geo=new THREE.InstancedBufferGeometry()
  geo.index=base.index;geo.setAttribute('position',base.getAttribute('position'));geo.setAttribute('normal',base.getAttribute('normal'));geo.instanceCount=BIRDS
  const refs=new Float32Array(BIRDS*2),cols=new Float32Array(BIRDS*3)
  for(let i=0;i<BIRDS;i++){
    refs[i*2]=(i%WIDTH+.5)/WIDTH;refs[i*2+1]=(Math.floor(i/WIDTH)+.5)/HEIGHT
    cols[i*3]=colors[i].r;cols[i*3+1]=colors[i].g;cols[i*3+2]=colors[i].b
  }
  geo.setAttribute('reference',new THREE.InstancedBufferAttribute(refs,2))
  geo.setAttribute('instanceColor',new THREE.InstancedBufferAttribute(cols,3))
  const uniforms={texturePosition:{value:null},marbleScale:{value:TAILLE}}
  material=new THREE.ShaderMaterial({uniforms,vertexShader:`
    attribute vec2 reference;attribute vec3 instanceColor;uniform sampler2D texturePosition;uniform float marbleScale;
    varying vec3 vNormal;varying vec3 vColor;varying float vDepth;
    void main(){vec3 c=texture2D(texturePosition,reference).xyz;vec3 w=c+position*marbleScale;vNormal=normalize(normalMatrix*normal);vColor=instanceColor;vDepth=w.z;gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}`,
    fragmentShader:`
    varying vec3 vNormal;varying vec3 vColor;varying float vDepth;
    void main(){vec3 l=normalize(vec3(.4,.7,.6));float d=.42+max(dot(vNormal,l),0.)*.58;float z=clamp((vDepth+400.)/800.,0.,1.);gl_FragColor=vec4(vColor*d*mix(.68,1.,z),1.);}`
  })
  scene.add(new THREE.Mesh(geo,material))

  // Entity peut continuer en arrière-plan, mais elle n'est plus visible et ne partage rien avec REPOS.
  const oldCanvas=document.querySelector('#app canvas')
  if(oldCanvas)oldCanvas.style.visibility='hidden'

  renderer.domElement.addEventListener('pointermove',e=>{
    if(e.isPrimary===false)return
    mouseX=e.clientX-halfX;mouseY=e.clientY-halfY
  })

  // Affiche les paramètres réellement actifs du murmure.
  document.querySelectorAll('.lil-gui.root').forEach(g=>g.style.display='none')
  const params={BOUNDS:BOUNDS_FACTOR,CENTRE,SEPARATION,ALIGNEMENT,COHESION,CAMERA,TAILLE,VITESSE:SPEED}
  const gui=new GUI({title:'REPOS — MURMURATION'})
  gui.add(params,'BOUNDS').name('BOUNDS').disable()
  gui.add(params,'CENTRE').name('CENTRE').disable()
  gui.add(params,'SEPARATION').name('SEPARATION').disable()
  gui.add(params,'ALIGNEMENT').name('ALIGNEMENT').disable()
  gui.add(params,'COHESION').name('COHESION').disable()
  gui.add(params,'CAMERA').name('CAMERA').disable()
  gui.add(params,'TAILLE').name('TAILLE BILLES').disable()
  gui.add(params,'VITESSE').name('VITESSE').disable()
  gui.domElement.style.zIndex='60'
}

addEventListener('resize',()=>{
  halfX=innerWidth/2;halfY=innerHeight/2
  if(!active)return
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)
})

const t0=performance.now()
function animateRepos(){
  requestAnimationFrame(animateRepos)
  if(!active&&performance.now()-t0>5000)startRepos()
  if(!active)return
  const now=performance.now();let delta=(now-last)/1000;if(delta>1)delta=1;last=now
  const simulationDelta=delta*SPEED
  pu.time.value=now;pu.delta.value=simulationDelta;vu.time.value=now;vu.delta.value=simulationDelta
  vu.predator.value.set(.5*mouseX/halfX,-.5*mouseY/halfY,0);mouseX=mouseY=10000
  gpu.compute();material.uniforms.texturePosition.value=gpu.getCurrentRenderTarget(pv).texture
  renderer.render(scene,camera)
}
animateRepos()

const label=[...document.querySelectorAll('div')].find(el=>el.textContent?.startsWith('ENTITY — Première connexion'))
if(label)label.textContent='ENTITY ÉLIGIBLE → REPOS GPGPU · 300 billes · BOUNDS .51 · CENTRE 4.9 · SÉPARATION 30 · ALIGNEMENT 1 · COHÉSION 60 · VITESSE .35 · CAMÉRA 840 · TAILLE 2.2'
const title=document.querySelector('.lil-gui.root > .title')
if(title)title.textContent='ENTITY → REPOS GPGPU HISTORIQUE'
