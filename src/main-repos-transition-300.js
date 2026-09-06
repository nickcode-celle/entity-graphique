import * as THREE from 'three'
import GUI from 'lil-gui'

// TEST VALIDÉ À CONSTRUIRE : Entity normale éligible REPOS -> REPOS murmuration.
// On conserve le rendu du corps existant et les mêmes billes pendant la métamorphose.
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
    if(o?.userData?.textureUnitScale && bodies.length<200){bodies.push(o);entityGroup=this}
  }
  return result
}

await import('./main-first-connection-panel.js')
THREE.Object3D.prototype.add=originalAdd
GUI.prototype.add=originalGuiAdd

// Base visuelle obligatoire : curseurs de la première connexion validée.
if(controls){
  Object.assign(controls,{
    ECART:28,TAILLE_BILLES:.90,V1:1,RELATION_GLOBALE:43,
    LIBERTE:.15,CHEVAUCHEMENT:1.45,ROTATION:.11,FREQUENCE_INVERSIONS:12,
    BRILLANCE:.62,INTENSITE_LUMIERE:2.25,LUMIERE_AMBIANTE:1,CAMERA:280
  })
}

const GOLDEN=Math.PI*(3-Math.sqrt(5))
const rnd=(a,b)=>THREE.MathUtils.lerp(a,b,Math.random())
const randomUnit=()=>new THREE.Vector3(Math.random()*2-1,Math.random()*2-1,Math.random()*2-1).normalize()
function shellPoint(i,n=100){
  const y=1-(i+.5)*2/n,r=Math.sqrt(Math.max(0,1-y*y)),a=i*GOLDEN+2.31
  return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r).multiplyScalar(3.32*28).applyEuler(new THREE.Euler(.21,-.27,.16))
}
function cloneMaterial(m){
  const c=m.clone(); if(c.isMeshStandardMaterial){c.emissive.set(0);c.emissiveIntensity=0} return c
}
function cloneBody(src){
  const c=src.clone(true)
  c.traverse(n=>{if(n.material)n.material=Array.isArray(n.material)?n.material.map(cloneMaterial):cloneMaterial(n.material);if(n.isMesh){n.castShadow=true;n.receiveShadow=true}})
  return c
}

// 100 nouvelles billes : même matière graphique, nouvelle couronne structurelle.
const sourcePool=bodies.slice()
for(let i=0;i<100;i++){
  const c=cloneBody(sourcePool[Math.floor(Math.random()*sourcePool.length)])
  c.userData.__repos300=true
  c.position.copy(shellPoint(i))
  entityGroup.add(c);bodies.push(c)
}

// Configuration d'éligibilité REPOS : 6 domaines dans 40–45 %, écart max 3 points.
const domains={
  PERSONNALITE:42,RELATION:43,GOUTS:41,OPINIONS_VALEURS:44,CONNAISSANCES:42,MONDE_PROPRE:43,
  HISTOIRE_VECUE:36,CAPACITES:28
}

// Chaque bille garde son identité. On capture sa position juste avant la libération.
const state=bodies.map((o,i)=>({
  o,i,start:new THREE.Vector3(),pos:new THREE.Vector3(),vel:randomUnit().multiplyScalar(rnd(2,5)),
  phase:Math.random()*Math.PI*2
}))

let startTime=performance.now()/1000
const NORMAL_HOLD=5.0
const RELEASE=3.2
const REST_SPEED=.35
const REST_RADIUS=72
const REST_Y=42

function smooth(t){t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)}
function boidStep(dt){
  const center=new THREE.Vector3()
  for(const s of state)center.add(s.pos)
  center.multiplyScalar(1/state.length)
  for(const s of state){
    const toCenter=center.clone().sub(s.pos)
    const radial=s.pos.clone(); radial.y*=1.35
    const tangent=new THREE.Vector3(-radial.z,radial.y*.08,radial.x).normalize()
    const noise=new THREE.Vector3(Math.sin(s.phase),Math.cos(s.phase*1.31),Math.sin(s.phase*.73+2)).multiplyScalar(.22)
    s.phase+=dt*.7
    s.vel.addScaledVector(toCenter,.12*dt)
    s.vel.addScaledVector(tangent,.32*dt)
    s.vel.addScaledVector(noise,dt)
    // enveloppe douce REPOS : cohésion forte, aucune séparation brutale
    const rr=Math.sqrt(s.pos.x*s.pos.x+s.pos.z*s.pos.z)
    if(rr>REST_RADIUS)s.vel.addScaledVector(new THREE.Vector3(-s.pos.x,0,-s.pos.z).normalize(),(rr-REST_RADIUS)*.018*dt)
    if(Math.abs(s.pos.y)>REST_Y)s.vel.y-=Math.sign(s.pos.y)*(Math.abs(s.pos.y)-REST_Y)*.018*dt
    const targetSpeed=9*REST_SPEED
    const speed=s.vel.length()
    if(speed>0)s.vel.multiplyScalar(THREE.MathUtils.lerp(1,targetSpeed/speed,.035))
    s.pos.addScaledVector(s.vel,dt)
  }
}

let captured=false
const clock=new THREE.Clock()
function animate(){
  requestAnimationFrame(animate)
  const dt=Math.min(clock.getDelta(),.035),t=performance.now()/1000-startTime
  if(t<NORMAL_HOLD)return
  if(!captured){
    captured=true
    for(const s of state){s.start.copy(s.o.position);s.pos.copy(s.start)}
  }
  boidStep(dt)
  const k=smooth((t-NORMAL_HOLD)/RELEASE)
  for(const s of state){
    // Même bille : sa contrainte de cellule s'efface pendant que le mouvement collectif prend le relais.
    s.o.position.copy(s.start).lerp(s.pos,k)
  }
}
animate()

const label=[...document.querySelectorAll('div')].find(el=>el.textContent?.startsWith('ENTITY — Première connexion'))
if(label)label.textContent='ENTITY — Éligible REPOS · 300 billes · 6 domaines 40–45 % / écart max 3 pts · transition automatique après 5 s'
const title=document.querySelector('.lil-gui.root > .title')
if(title)title.textContent='ENTITY — TEST 300 BILLES → REPOS'
