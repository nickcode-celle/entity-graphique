import * as THREE from 'three'
import GUI from 'lil-gui'

// TEST : ENTITY -> REPOS murmuration -> DONUT murmuration.
// Le DONUT n'est jamais une cible géométrique : il reste une nuée vivante.
const bodies=[]
let entityGroup=null
let controls=null
const originalGuiAdd=GUI.prototype.add
GUI.prototype.add=function(object,property,...args){if(['ECART','TAILLE_BILLES','V1','RELATION_GLOBALE','LIBERTE','CHEVAUCHEMENT','ROTATION','FREQUENCE_INVERSIONS','BRILLANCE','INTENSITE_LUMIERE','LUMIERE_AMBIANTE','CAMERA'].includes(property))controls=object;return originalGuiAdd.call(this,object,property,...args)}
const originalAdd=THREE.Object3D.prototype.add
THREE.Object3D.prototype.add=function(...objects){const result=originalAdd.apply(this,objects);for(const o of objects)if(o?.userData?.textureUnitScale&&bodies.length<200){bodies.push(o);entityGroup=this}return result}
await import('./main-first-connection-panel.js')
THREE.Object3D.prototype.add=originalAdd;GUI.prototype.add=originalGuiAdd

if(controls)Object.assign(controls,{ECART:28,TAILLE_BILLES:.90,V1:.75,RELATION_GLOBALE:43,LIBERTE:.15,CHEVAUCHEMENT:1.45,ROTATION:.11,FREQUENCE_INVERSIONS:12,BRILLANCE:.62,INTENSITE_LUMIERE:2.25,LUMIERE_AMBIANTE:1,CAMERA:280})

const rnd=(a,b)=>THREE.MathUtils.lerp(a,b,Math.random())
const randomUnit=()=>new THREE.Vector3(Math.random()*2-1,Math.random()*2-1,Math.random()*2-1).normalize()
function cloneMaterial(m){const c=m.clone();if(c.isMeshStandardMaterial){c.emissive.set(0);c.emissiveIntensity=0}return c}
function cloneBody(src){const c=src.clone(true);c.traverse(n=>{if(n.material)n.material=Array.isArray(n.material)?n.material.map(cloneMaterial):cloneMaterial(n.material);if(n.isMesh){n.castShadow=true;n.receiveShadow=true}});return c}

const sourcePool=bodies.slice()
for(let i=0;i<300;i++){
  const c=cloneBody(sourcePool[Math.floor(Math.random()*sourcePool.length)])
  c.userData.__donut500=true
  c.position.copy(randomUnit().multiplyScalar(rnd(72,98)))
  entityGroup.add(c);bodies.push(c)
}

const N=bodies.length
const state=bodies.map((o,i)=>{
  const h=randomUnit();h.z*=.32;h.normalize()
  return {o,i,start:o.position.clone(),pos:o.position.clone(),heading:h,desired:h.clone(),speed:rnd(17,23),phase:Math.random()*Math.PI*2}
})

// Paramètres de la murmuration. REPOS = alignement 1 ; DONUT = saut direct à 8.
const flock={
  alignment:1,
  cohesion:60,
  separation:30,
  centre:4.9,
  neighbourRadius:34,
  dangerDistance:7.8,
  speed:20,
  depth:34
}

const NORMAL_HOLD=4
const TO_MURMURATION=2.25
const REPOS_HOLD=4
const REPOS_START=NORMAL_HOLD
const REPOS_READY=REPOS_START+TO_MURMURATION
const DONUT_START=REPOS_READY+REPOS_HOLD

const centroid=new THREE.Vector3(),meanHeading=new THREE.Vector3()
const tmp=new THREE.Vector3(),tmp2=new THREE.Vector3(),align=new THREE.Vector3(),localCenter=new THREE.Vector3(),sep=new THREE.Vector3()
let frame=0

function smooth(t){t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)}

function globalState(){
  centroid.set(0,0,0);meanHeading.set(0,0,0)
  for(const s of state){centroid.add(s.pos);meanHeading.add(s.heading)}
  centroid.multiplyScalar(1/N)
  if(meanHeading.lengthSq()>1e-6)meanHeading.normalize()
}

function decide(s,donut){
  align.set(0,0,0);localCenter.set(0,0,0);sep.set(0,0,0)
  let count=0
  // Échantillonnage topologique régulier : assez de voisins pour 500 billes sans figer la simulation.
  const stride=17
  for(let k=1;k<=42;k++){
    const other=state[(s.i+k*stride)%N]
    tmp.copy(other.pos).sub(s.pos)
    const d2=tmp.lengthSq()
    if(d2<flock.neighbourRadius*flock.neighbourRadius){
      const d=Math.sqrt(d2)
      align.add(other.heading);localCenter.add(other.pos);count++
      if(d>1e-4&&d<flock.dangerDistance){
        sep.addScaledVector(tmp,-(1-d/flock.dangerDistance)/d)
      }
    }
  }

  const desired=s.heading.clone()
  if(count){
    align.multiplyScalar(1/count).normalize()
    localCenter.multiplyScalar(1/count).sub(s.pos)
    if(localCenter.lengthSq()>1e-5)localCenter.normalize()
    // Le saut historique REPOS -> DONUT est bien ALIGNEMENT 1 -> 8.
    desired.addScaledVector(align,flock.alignment*.13)
    desired.addScaledVector(localCenter,flock.cohesion*.0018)
  }
  desired.addScaledVector(sep,flock.separation*.055)

  // La nuée entière reste contenue, sans assigner de place à une bille.
  tmp.copy(centroid).sub(s.pos)
  const radius=tmp.length()
  if(radius>74)desired.addScaledVector(tmp.normalize(),flock.centre*.055)

  if(donut){
    // Champ collectif de circulation : aucune bille n'a de destination fixe.
    // L'alignement x8 fait circuler les trajectoires voisines ensemble ;
    // l'évidement central et le rappel radial font émerger un anneau vivant.
    tmp.copy(s.pos).sub(centroid)
    const planar=Math.hypot(tmp.x,tmp.y)
    if(planar>1e-4){
      const radial=tmp2.set(tmp.x/planar,tmp.y/planar,0)
      const tangent=new THREE.Vector3(-radial.y,radial.x,0)
      desired.addScaledVector(tangent,2.75)
      const ringRadius=61
      const radialError=(ringRadius-planar)/ringRadius
      desired.addScaledVector(radial,radialError*1.65)
      if(planar<28)desired.addScaledVector(radial,(28-planar)/28*3.2)
    }
    desired.z+=-tmp.z*.018
  }else{
    // REPOS murmuration : volume souple, mobile, sans trou central.
    desired.addScaledVector(meanHeading,.18)
    desired.z+=-s.pos.z*.0045
  }

  s.phase+=.018
  desired.x+=Math.sin(s.phase+s.i*.071)*.018
  desired.y+=Math.cos(s.phase*.83+s.i*.049)*.018
  desired.z+=Math.sin(s.phase*.71+s.i*.033)*.010
  if(desired.lengthSq()>1e-5)desired.normalize()
  s.desired.copy(desired)
}

function updateMurmuration(dt,donut){
  globalState()
  // recalcul social tous les 2 frames, intégration continue
  if((frame++&1)===0)for(const s of state)decide(s,donut)
  for(const s of state){
    s.heading.lerp(s.desired,1-Math.exp(-(donut?5.4:3.7)*dt)).normalize()
    const targetSpeed=flock.speed*(donut?1.08:1)
    s.speed=THREE.MathUtils.lerp(s.speed,targetSpeed,1-Math.exp(-1.8*dt))
    s.pos.addScaledVector(s.heading,s.speed*dt)
    s.o.position.copy(s.pos)
  }
}

const clock=new THREE.Clock()
const startTime=performance.now()/1000
function animate(){
  requestAnimationFrame(animate)
  const dt=Math.min(clock.getDelta(),.035)
  const t=performance.now()/1000-startTime
  if(t<NORMAL_HOLD)return

  // Dès l'entrée dans la murmuration, la mécanique structurée d'Entity s'efface.
  // Le mouvement visible est ensuite exclusivement celui de la murmuration.
  if(controls){controls.V1=0;controls.ROTATION=0}

  const enter=smooth((t-REPOS_START)/TO_MURMURATION)
  const donut=t>=DONUT_START
  flock.alignment=donut?8:1
  flock.separation=30
  flock.cohesion=60
  flock.centre=4.9

  updateMurmuration(dt,donut)

  // Au début seulement, raccord continu entre la matière structurée et la nuée.
  if(enter<1){for(const s of state)s.o.position.copy(s.start).lerp(s.pos,enter)}
}
animate()

const label=[...document.querySelectorAll('div')].find(el=>el.textContent?.startsWith('ENTITY — Première connexion'))
if(label)label.textContent='ENTITY → REPOS MURMURATION → DONUT MURMURATION · 500 billes · ALIGNEMENT 1→8'
const title=document.querySelector('.lil-gui.root > .title')
if(title)title.textContent='ENTITY — REPOS → DONUT MURMURATION'
