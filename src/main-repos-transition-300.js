import * as THREE from 'three'
import GUI from 'lil-gui'

// DONUT validé : mêmes 500 billes, mêmes curseurs 30 / 8 / 60.
// Test fluidité : calcul physique déporté dans un Worker + interpolation visuelle.
// Diagnostic ciblé : ombres temporairement coupées, sans toucher au mouvement ni à la forme.
const DONUT_ELIGIBILITY={beads:500,reposAcquired:true,emotionalTrigger:'JOIE',domains:{PERSONNALITE:61,RELATION:62,GOUTS:63,OPINIONS_VALEURS:61,CONNAISSANCES:62,MONDE_PROPRE:52,HISTOIRE_VECUE:48,CAPACITES:44}}
const captured=[];let entityGroup=null
const originalAdd=THREE.Object3D.prototype.add
THREE.Object3D.prototype.add=function(...objects){const r=originalAdd.apply(this,objects);for(const o of objects)if(o?.userData?.textureUnitScale&&captured.length<200){captured.push(o);entityGroup=this}return r}
await import('./main-first-connection-panel.js');THREE.Object3D.prototype.add=originalAdd
let entityScene=entityGroup;while(entityScene?.parent)entityScene=entityScene.parent
function cloneMaterial(m){return m?.clone?m.clone():m}
function cloneBody(src){const c=src.clone(true);c.traverse(n=>{if(n.material)n.material=Array.isArray(n.material)?n.material.map(cloneMaterial):cloneMaterial(n.material);if(n.isMesh){n.castShadow=false;n.receiveShadow=false}});return c}
const BIRDS=DONUT_ELIGIBILITY.beads,REFERENCE_BIRDS=32*32,REFERENCE_BOUNDS=800
const controls={BOUNDS:.51,CENTRE:4.9,SEPARATION:30,ALIGNEMENT:8,COHESION:60,CAMERA:840,TAILLE:2.2,VITESSE:.35}
function currentBounds(){return REFERENCE_BOUNDS*Math.cbrt(BIRDS/REFERENCE_BIRDS)*controls.BOUNDS}
const eligibleDomains=Object.values(DONUT_ELIGIBILITY.domains).filter(v=>v>=60&&v<=65).sort((a,b)=>a-b)
const donutEligible=BIRDS>=500&&DONUT_ELIGIBILITY.reposAcquired&&eligibleDomains.length>=5&&(eligibleDomains[4]-eligibleDomains[0]<=3)&&!!DONUT_ELIGIBILITY.emotionalTrigger
const app=document.querySelector('#app');app.innerHTML=''
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=false;renderer.toneMapping=THREE.ACESFilmicToneMapping;app.appendChild(renderer.domElement)
const scene=new THREE.Scene();scene.background=entityScene?.background?.clone?.()||new THREE.Color(0x1d1f22)
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,3000);camera.position.set(0,0,controls.CAMERA);camera.lookAt(0,0,0)
if(entityScene)entityScene.traverse(o=>{if(!o.isLight)return;const l=o.clone();l.position.copy(o.position);l.quaternion.copy(o.quaternion);l.scale.copy(o.scale);l.castShadow=false;scene.add(l)})
const marbles=[]
const initialPositions=new Float64Array(BIRDS*3),initialVelocities=new Float64Array(BIRDS*3)
const renderPositions=new Float64Array(BIRDS*3),fromPositions=new Float64Array(BIRDS*3),toPositions=new Float64Array(BIRDS*3)
const startBounds=currentBounds(),startHalf=startBounds/2
for(let i=0;i<BIRDS;i++){const c=cloneBody(captured[i%captured.length]);c.scale.multiplyScalar(controls.TAILLE/.90);scene.add(c);marbles.push(c);const q=i*3,px=Math.random()*startBounds-startHalf,py=Math.random()*startBounds-startHalf,pz=Math.random()*startBounds-startHalf,vx=(Math.random()-.5)*10,vy=(Math.random()-.5)*10,vz=(Math.random()-.5)*10;initialPositions[q]=px;initialPositions[q+1]=py;initialPositions[q+2]=pz;initialVelocities[q]=vx;initialVelocities[q+1]=vy;initialVelocities[q+2]=vz;renderPositions[q]=fromPositions[q]=toPositions[q]=px;renderPositions[q+1]=fromPositions[q+1]=toPositions[q+1]=py;renderPositions[q+2]=fromPositions[q+2]=toPositions[q+2]=pz;c.position.set(px,py,pz)}
const worker=new Worker(new URL('./donut-physics-worker.js',import.meta.url),{type:'module'})
let interpolationStart=performance.now(),interpolationDuration=16.7,hasSnapshot=false
worker.onmessage=e=>{if(e.data?.type!=='snapshot')return;const incoming=new Float64Array(e.data.positions);for(let i=0;i<renderPositions.length;i++){fromPositions[i]=renderPositions[i];toPositions[i]=incoming[i]}interpolationStart=performance.now();interpolationDuration=Math.max(8,Math.min(80,e.data.intervalMs||16.7));hasSnapshot=true}
function syncPhysicsControls(){worker.postMessage({type:'controls',controls:{CENTRE:controls.CENTRE,SEPARATION:controls.SEPARATION,ALIGNEMENT:controls.ALIGNEMENT,COHESION:controls.COHESION,VITESSE:controls.VITESSE}})}
if(donutEligible){const p=initialPositions.slice(),v=initialVelocities.slice();worker.postMessage({type:'init',birds:BIRDS,controls:{CENTRE:controls.CENTRE,SEPARATION:controls.SEPARATION,ALIGNEMENT:controls.ALIGNEMENT,COHESION:controls.COHESION,VITESSE:controls.VITESSE},positions:p.buffer,velocities:v.buffer},[p.buffer,v.buffer])}
const gui=new GUI({title:'DONUT — TEST FLUIDITÉ'});gui.add(controls,'BOUNDS',.1,1,.01);gui.add(controls,'CENTRE',0,10,.1).onChange(syncPhysicsControls);gui.add(controls,'SEPARATION',0,100,1).onChange(syncPhysicsControls);gui.add(controls,'ALIGNEMENT',0,100,1).onChange(syncPhysicsControls);gui.add(controls,'COHESION',0,100,1).onChange(syncPhysicsControls);gui.add(controls,'CAMERA',200,1200,10).onChange(v=>{camera.position.z=v;camera.lookAt(0,0,0)});gui.add(controls,'TAILLE',.2,5,.1).onChange(v=>{const s=v/.90;for(const m of marbles)m.scale.setScalar(s)});gui.add(controls,'VITESSE',.05,2,.05).onChange(syncPhysicsControls)
const status=document.createElement('div');status.textContent=`DONUT VALIDÉ — ${donutEligible?'ÉLIGIBLE':'NON ÉLIGIBLE'} · 500 billes · 30 / 8 / 60 · OMBRES COUPÉES · SANS TRAÎNÉES`;Object.assign(status.style,{position:'fixed',left:'14px',bottom:'12px',color:'rgba(255,255,255,.62)',font:'12px Arial',pointerEvents:'none'});document.body.appendChild(status)
const startedAt=performance.now()
function renderInterpolated(now){if(!hasSnapshot)return;const a=Math.min(1,Math.max(0,(now-interpolationStart)/interpolationDuration));for(let i=0;i<BIRDS;i++){const q=i*3,px=fromPositions[q]+(toPositions[q]-fromPositions[q])*a,py=fromPositions[q+1]+(toPositions[q+1]-fromPositions[q+1])*a,pz=fromPositions[q+2]+(toPositions[q+2]-fromPositions[q+2])*a;renderPositions[q]=px;renderPositions[q+1]=py;renderPositions[q+2]=pz;marbles[i].position.set(px,py,pz)}}
function updateCamera(now){const elapsed=(now-startedAt)/1000;if(elapsed<=60)return;const t=Math.min(1,(elapsed-60)/12),e=t*t*(3-2*t);camera.position.y=180*e;camera.position.z=controls.CAMERA;camera.lookAt(0,0,0)}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})
addEventListener('beforeunload',()=>worker.postMessage({type:'stop'}))
function animate(){requestAnimationFrame(animate);const now=performance.now();renderInterpolated(now);updateCamera(now);renderer.render(scene,camera)}animate()
