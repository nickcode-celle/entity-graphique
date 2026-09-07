import * as THREE from 'three'
import GUI from 'lil-gui'

// TEST : Entity eligible REPOS -> REPOS historique.
// Entity reste visible 5 s, puis ses 300 billes deviennent la murmuration REPOS.
// Recette : BOUNDS .51 / CENTRE 4.9 / SEPARATION 30 / ALIGNEMENT 1 / COHESION 60 / VITESSE .35.

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
  for(const o of objects)if(o?.userData?.textureUnitScale&&bodies.length<200){bodies.push(o);entityGroup=this}
  return result
}

await import('./main-first-connection-panel.js')
THREE.Object3D.prototype.add=originalAdd
GUI.prototype.add=originalGuiAdd

// Entity eligible : 300 billes, 6 domaines dans 40-45 avec dispersion <=3.
if(controls)Object.assign(controls,{ECART:28,TAILLE_BILLES:.90,V1:.75,RELATION_GLOBALE:43,LIBERTE:.15,CHEVAUCHEMENT:1.45,ROTATION:.11,FREQUENCE_INVERSIONS:12,BRILLANCE:.62,INTENSITE_LUMIERE:2.25,LUMIERE_AMBIANTE:1,CAMERA:280})

const GOLDEN=Math.PI*(3-Math.sqrt(5))
function shellPoint(i,n=100){const y=1-(i+.5)*2/n,r=Math.sqrt(Math.max(0,1-y*y)),a=i*GOLDEN+2.31;return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r).multiplyScalar(3.32*28).applyEuler(new THREE.Euler(.21,-.27,.16))}
function cloneMaterial(m){const c=m.clone();if(c.isMeshStandardMaterial){c.emissive.set(0);c.emissiveIntensity=0}return c}
function cloneBody(src){const c=src.clone(true);c.traverse(n=>{if(n.material)n.material=Array.isArray(n.material)?n.material.map(cloneMaterial):cloneMaterial(n.material);if(n.isMesh){n.castShadow=true;n.receiveShadow=true}});return c}
const sourcePool=bodies.slice()
for(let i=0;i<100;i++){const c=cloneBody(sourcePool[Math.floor(Math.random()*sourcePool.length)]);c.userData.__repos300=true;c.position.copy(shellPoint(i));entityGroup.add(c);bodies.push(c)}
const domains={PERSONNALITE:42,RELATION:43,GOUTS:41,OPINIONS_VALEURS:44,CONNAISSANCES:42,MONDE_PROPRE:43,HISTOIRE_VECUE:36,CAPACITES:28};void domains

// Etat initial mémorisé : la transition agit sur les mêmes billes, sans remplacement visuel.
const state=bodies.map(o=>({o,start:new THREE.Vector3(),pos:new THREE.Vector3(),vel:new THREE.Vector3()}))
const rnd=(a,b)=>THREE.MathUtils.lerp(a,b,Math.random())
const randomUnit=()=>new THREE.Vector3(Math.random()*2-1,Math.random()*2-1,Math.random()*2-1).normalize()

const NORMAL_HOLD=5
const TRANSITION=2.7
const SPEED=.35
const COHESION=60
const ALIGNMENT=1
const SEPARATION=30
const CENTER=4.9
const BOUNDS=.51
const NEIGHBOR_R=34
const SEP_R=15
let startTime=performance.now()/1000
let captured=false

function smooth(t){t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)}
function capture(){
  for(const s of state){
    s.start.copy(s.o.position)
    s.pos.copy(s.start)
    const radial=s.pos.clone().normalize()
    const tangent=new THREE.Vector3(-radial.z,radial.y*.12,radial.x).normalize()
    s.vel.copy(tangent).multiplyScalar(rnd(2.1,3)).addScaledVector(randomUnit(),.25)
  }
}

const avgPos=new THREE.Vector3(),avgVel=new THREE.Vector3(),coh=new THREE.Vector3(),ali=new THREE.Vector3(),sep=new THREE.Vector3(),delta=new THREE.Vector3()
function reposStep(dt,blend){
  avgPos.set(0,0,0);avgVel.set(0,0,0)
  for(const s of state){avgPos.add(s.pos);avgVel.add(s.vel)}
  avgPos.multiplyScalar(1/state.length);avgVel.multiplyScalar(1/state.length)
  for(let i=0;i<state.length;i++){
    const s=state[i];coh.set(0,0,0);ali.set(0,0,0);sep.set(0,0,0);let neighbors=0,seps=0
    for(let q=1;q<=18;q++){
      const other=state[(i+q*17)%state.length]
      delta.copy(other.pos).sub(s.pos)
      const d2=delta.lengthSq()
      if(d2<NEIGHBOR_R*NEIGHBOR_R){coh.add(other.pos);ali.add(other.vel);neighbors++}
      if(d2>0&&d2<SEP_R*SEP_R){sep.addScaledVector(delta,-1/Math.max(3,d2));seps++}
    }
    if(neighbors){coh.multiplyScalar(1/neighbors).sub(s.pos);ali.multiplyScalar(1/neighbors).sub(s.vel)}
    else{coh.copy(avgPos).sub(s.pos);ali.copy(avgVel).sub(s.vel)}
    if(seps)sep.multiplyScalar(1/seps)
    s.vel.addScaledVector(coh,COHESION*.00062*dt*blend)
    s.vel.addScaledVector(ali,ALIGNMENT*.018*dt*blend)
    s.vel.addScaledVector(sep,SEPARATION*.065*dt*blend)
    const fromCenter=s.pos.clone().sub(avgPos),dist=fromCenter.length(),softBound=72+BOUNDS*22
    if(dist>softBound)s.vel.addScaledVector(fromCenter.normalize(),-(dist-softBound)*CENTER*.018*dt*blend)
    s.vel.addScaledVector(avgPos.clone().multiplyScalar(-1),CENTER*.0007*dt*blend)
    const targetSpeed=8.8*SPEED,speed=s.vel.length()
    if(speed>.001)s.vel.multiplyScalar(THREE.MathUtils.lerp(1,targetSpeed/speed,.045*blend))
  }
  for(const s of state)s.pos.addScaledVector(s.vel,dt)
}

const clock=new THREE.Clock()
function animate(){
  requestAnimationFrame(animate)
  const dt=Math.min(clock.getDelta(),.035)
  const t=performance.now()/1000-startTime
  if(t<NORMAL_HOLD)return
  if(!captured){captured=true;capture()}

  // A partir d'ici, les mécaniques Entity cessent : la matière passe au murmure REPOS.
  if(controls){controls.V1=0;controls.ROTATION=0}
  if(entityGroup)entityGroup.rotation.set(0,0,0)

  const k=smooth((t-NORMAL_HOLD)/TRANSITION)
  reposStep(dt,k)
  for(const s of state){
    if(k<1)s.o.position.copy(s.start).lerp(s.pos,k)
    else s.o.position.copy(s.pos)
  }
}
animate()

const label=[...document.querySelectorAll('div')].find(el=>el.textContent?.startsWith('ENTITY — Première connexion'))
if(label)label.textContent='ENTITY ÉLIGIBLE → REPOS · 300 billes · BOUNDS .51 · CENTRE 4.9 · SÉPARATION 30 · ALIGNEMENT 1 · COHÉSION 60 · VITESSE .35'
const title=document.querySelector('.lil-gui.root > .title')
if(title)title.textContent='ENTITY — TRANSITION VERS REPOS'
