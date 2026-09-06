import * as THREE from 'three'
import GUI from 'lil-gui'

// TEST : ENTITY -> REPOS rapide -> DONUT. 500 billes, même matière, sans remplacement visuel.
const bodies=[]
let entityGroup=null
let controls=null
const originalGuiAdd=GUI.prototype.add
GUI.prototype.add=function(object,property,...args){if(['ECART','TAILLE_BILLES','V1','RELATION_GLOBALE','LIBERTE','CHEVAUCHEMENT','ROTATION','FREQUENCE_INVERSIONS','BRILLANCE','INTENSITE_LUMIERE','LUMIERE_AMBIANTE','CAMERA'].includes(property))controls=object;return originalGuiAdd.call(this,object,property,...args)}
const originalAdd=THREE.Object3D.prototype.add
THREE.Object3D.prototype.add=function(...objects){const result=originalAdd.apply(this,objects);for(const o of objects)if(o?.userData?.textureUnitScale&&bodies.length<200){bodies.push(o);entityGroup=this}return result}
await import('./main-first-connection-panel.js')
THREE.Object3D.prototype.add=originalAdd;GUI.prototype.add=originalGuiAdd

// Référence Entity de base : V1 = 0,75.
if(controls)Object.assign(controls,{ECART:28,TAILLE_BILLES:.90,V1:.75,RELATION_GLOBALE:43,LIBERTE:.15,CHEVAUCHEMENT:1.45,ROTATION:.11,FREQUENCE_INVERSIONS:12,BRILLANCE:.62,INTENSITE_LUMIERE:2.25,LUMIERE_AMBIANTE:1,CAMERA:280})

const rnd=(a,b)=>THREE.MathUtils.lerp(a,b,Math.random())
const randomUnit=()=>new THREE.Vector3(Math.random()*2-1,Math.random()*2-1,Math.random()*2-1).normalize()
function cloneMaterial(m){const c=m.clone();if(c.isMeshStandardMaterial){c.emissive.set(0);c.emissiveIntensity=0}return c}
function cloneBody(src){const c=src.clone(true);c.traverse(n=>{if(n.material)n.material=Array.isArray(n.material)?n.material.map(cloneMaterial):cloneMaterial(n.material);if(n.isMesh){n.castShadow=true;n.receiveShadow=true}});return c}
const sourcePool=bodies.slice()
for(let i=0;i<300;i++){const c=cloneBody(sourcePool[Math.floor(Math.random()*sourcePool.length)]);c.userData.__donut500=true;const u=randomUnit();c.position.copy(u.multiplyScalar(rnd(72,98)));entityGroup.add(c);bodies.push(c)}

const state=bodies.map((o,i)=>({o,i,start:o.position.clone(),pos:o.position.clone(),vel:randomUnit().multiplyScalar(rnd(1.8,2.8)),phase:Math.random()*Math.PI*2,donut:new THREE.Vector3()}))
const tilt=new THREE.Euler(.48,.10,-.22)
for(const s of state){const a=(s.i/state.length)*Math.PI*2+Math.sin(s.i*2.17)*.045;const b=((s.i*137)%state.length)/state.length*Math.PI*2;const R=64,r=22;const p=new THREE.Vector3((R+r*Math.cos(b))*Math.cos(a),r*Math.sin(b),(R+r*Math.cos(b))*Math.sin(a));p.applyEuler(tilt);s.donut.copy(p)}

const NORMAL_HOLD=4,TO_REPOS=2.2,REPOS_HOLD=2,DONUT_TIME=5
const REPOS_START=NORMAL_HOLD,REPOS_READY=REPOS_START+TO_REPOS,DONUT_START=REPOS_READY+REPOS_HOLD
const center=new THREE.Vector3(),tmp=new THREE.Vector3()
function smooth(t){t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)}
function reposStep(dt,strength=1){center.set(0,0,0);for(const s of state)center.add(s.pos);center.multiplyScalar(1/state.length);for(const s of state){tmp.copy(center).sub(s.pos);s.vel.addScaledVector(tmp,.018*dt*strength);const radial=s.pos.clone().sub(center);if(radial.length()>62)s.vel.addScaledVector(radial.normalize(),-.7*dt*strength);s.phase+=dt*.7;s.vel.x+=Math.sin(s.phase+s.i*.17)*.05*dt;s.vel.y+=Math.cos(s.phase*.8+s.i*.11)*.04*dt;s.vel.z+=Math.sin(s.phase*.9+s.i*.13)*.05*dt;const speed=s.vel.length();if(speed>3.1)s.vel.multiplyScalar(3.1/speed);s.pos.addScaledVector(s.vel,dt)}}

let startTime=performance.now()/1000
const clock=new THREE.Clock()
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.035),t=performance.now()/1000-startTime;if(t<NORMAL_HOLD)return
  if(t<DONUT_START){
    if(controls){controls.ECART=28;controls.V1=.75;controls.ROTATION=.11}
    const k=smooth((t-REPOS_START)/TO_REPOS);reposStep(dt,k);for(const s of state){if(k<1)s.o.position.copy(s.start).lerp(s.pos,k);else s.o.position.copy(s.pos)}return
  }

  // REPOS -> DONUT : on conserve le mouvement propre des billes à V1 = 0,75.
  // Seule la rotation globale de l'Entity est arrêtée progressivement.
  const d=smooth((t-DONUT_START)/DONUT_TIME)
  const neutral=smooth(Math.min(1,(t-DONUT_START)/1.15))
  const spread=THREE.MathUtils.lerp(1,40/28,d)
  if(controls){
    controls.ECART=THREE.MathUtils.lerp(28,40,d)
    controls.V1=.75
    controls.ROTATION=THREE.MathUtils.lerp(.11,0,neutral)
  }
  reposStep(dt,1-d)
  for(const s of state){tmp.copy(s.donut).multiplyScalar(spread);s.pos.lerp(tmp,.035+.075*d);s.o.position.copy(s.pos)}
  if(d>=1){if(controls){controls.V1=.75;controls.ROTATION=0;controls.ECART=40}}
}
animate()

const label=[...document.querySelectorAll('div')].find(el=>el.textContent?.startsWith('ENTITY — Première connexion'))
if(label)label.textContent='ENTITY → REPOS rapide → DONUT · mouvement billes conservé V1 0,75 · rotation Entity arrêtée'
const title=document.querySelector('.lil-gui.root > .title');if(title)title.textContent='ENTITY — TEST REPOS → DONUT'
