import * as THREE from 'three'
import GUI from 'lil-gui'

// DONUT validé restauré : même moteur CPU, mêmes 500 billes, mêmes curseurs 30 / 8 / 60.
// Test ciblé : traînées temporairement coupées pour isoler les petites saccades du mouvement.
const DONUT_ELIGIBILITY={beads:500,reposAcquired:true,emotionalTrigger:'JOIE',domains:{PERSONNALITE:61,RELATION:62,GOUTS:63,OPINIONS_VALEURS:61,CONNAISSANCES:62,MONDE_PROPRE:52,HISTOIRE_VECUE:48,CAPACITES:44}}
const captured=[];let entityGroup=null
const originalAdd=THREE.Object3D.prototype.add
THREE.Object3D.prototype.add=function(...objects){const r=originalAdd.apply(this,objects);for(const o of objects)if(o?.userData?.textureUnitScale&&captured.length<200){captured.push(o);entityGroup=this}return r}
await import('./main-first-connection-panel.js');THREE.Object3D.prototype.add=originalAdd
let entityScene=entityGroup;while(entityScene?.parent)entityScene=entityScene.parent
function cloneMaterial(m){return m?.clone?m.clone():m}
function cloneBody(src){const c=src.clone(true);c.traverse(n=>{if(n.material)n.material=Array.isArray(n.material)?n.material.map(cloneMaterial):cloneMaterial(n.material);if(n.isMesh){n.castShadow=true;n.receiveShadow=true}});return c}
const BIRDS=DONUT_ELIGIBILITY.beads,REFERENCE_BIRDS=32*32,REFERENCE_BOUNDS=800
const controls={BOUNDS:.51,CENTRE:4.9,SEPARATION:30,ALIGNEMENT:8,COHESION:60,CAMERA:840,TAILLE:2.2,VITESSE:.35}
function currentBounds(){return REFERENCE_BOUNDS*Math.cbrt(BIRDS/REFERENCE_BIRDS)*controls.BOUNDS}
const eligibleDomains=Object.values(DONUT_ELIGIBILITY.domains).filter(v=>v>=60&&v<=65).sort((a,b)=>a-b)
const donutEligible=BIRDS>=500&&DONUT_ELIGIBILITY.reposAcquired&&eligibleDomains.length>=5&&(eligibleDomains[4]-eligibleDomains[0]<=3)&&!!DONUT_ELIGIBILITY.emotionalTrigger
const app=document.querySelector('#app');app.innerHTML=''
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;app.appendChild(renderer.domElement)
const scene=new THREE.Scene();scene.background=entityScene?.background?.clone?.()||new THREE.Color(0x1d1f22)
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,3000);camera.position.set(0,0,controls.CAMERA);camera.lookAt(0,0,0)
if(entityScene)entityScene.traverse(o=>{if(!o.isLight)return;const l=o.clone();l.position.copy(o.position);l.quaternion.copy(o.quaternion);l.scale.copy(o.scale);l.castShadow=o.castShadow;if(l.shadow&&o.shadow){l.shadow.mapSize.copy(o.shadow.mapSize);l.shadow.camera.near=o.shadow.camera.near;l.shadow.camera.far=o.shadow.camera.far;l.shadow.bias=o.shadow.bias;l.shadow.normalBias=o.shadow.normalBias}scene.add(l)})
const marbles=[],positions=[],velocities=[]
const startBounds=currentBounds(),startHalf=startBounds/2
for(let i=0;i<BIRDS;i++){const c=cloneBody(captured[i%captured.length]);c.scale.multiplyScalar(controls.TAILLE/.90);scene.add(c);marbles.push(c);const p=new THREE.Vector3(Math.random()*startBounds-startHalf,Math.random()*startBounds-startHalf,Math.random()*startBounds-startHalf);const v=new THREE.Vector3((Math.random()-.5)*10,(Math.random()-.5)*10,(Math.random()-.5)*10);positions.push(p);velocities.push(v);c.position.copy(p)}
const gui=new GUI({title:'DONUT — TEST FLUIDITÉ'});gui.add(controls,'BOUNDS',.1,1,.01);gui.add(controls,'CENTRE',0,10,.1);gui.add(controls,'SEPARATION',0,100,1);gui.add(controls,'ALIGNEMENT',0,100,1);gui.add(controls,'COHESION',0,100,1);gui.add(controls,'CAMERA',200,1200,10).onChange(v=>{camera.position.z=v;camera.lookAt(0,0,0)});gui.add(controls,'TAILLE',.2,5,.1).onChange(v=>{const s=v/.90;for(const m of marbles)m.scale.setScalar(s)});gui.add(controls,'VITESSE',.05,2,.05)
const status=document.createElement('div');status.textContent=`DONUT VALIDÉ — ${donutEligible?'ÉLIGIBLE':'NON ÉLIGIBLE'} · 500 billes · 30 / 8 / 60 · TEST SANS TRAÎNÉES`;Object.assign(status.style,{position:'fixed',left:'14px',bottom:'12px',color:'rgba(255,255,255,.62)',font:'12px Arial',pointerEvents:'none'});document.body.appendChild(status)
const nextVel=Array.from({length:BIRDS},()=>new THREE.Vector3()),dir=new THREE.Vector3(),tmp=new THREE.Vector3();let last=performance.now();const startedAt=last
function stepDonut(dt){const d=dt*controls.VITESSE,zone=controls.SEPARATION+controls.ALIGNEMENT+controls.COHESION,zone2=zone*zone,sepT=zone>0?controls.SEPARATION/zone:0,alignT=zone>0?(controls.SEPARATION+controls.ALIGNEMENT)/zone:0;for(let i=0;i<BIRDS;i++){const selfP=positions[i],selfV=velocities[i],v=nextVel[i].copy(selfV);dir.copy(selfP);dir.y*=2.5;if(dir.lengthSq()>1e-9)v.addScaledVector(dir.normalize(),-d*controls.CENTRE);if(zone>0)for(let j=0;j<BIRDS;j++){if(i===j)continue;dir.subVectors(positions[j],selfP);const dist2=dir.lengthSq();if(dist2<1e-8||dist2>zone2)continue;const percent=dist2/zone2;if(percent<sepT){const f=(sepT/percent-1)*d;v.addScaledVector(dir.normalize(),-f)}else if(percent<alignT){const td=alignT-sepT,ap=td===0?1:(percent-sepT)/td,f=(.5-Math.cos(ap*Math.PI*2)*.5+.5)*d;tmp.copy(velocities[j]);if(tmp.lengthSq()>1e-9)v.addScaledVector(tmp.normalize(),f)}else{const td=1-alignT,ap=td===0?1:(percent-alignT)/td,f=(.5-(Math.cos(ap*Math.PI*2)*-.5+.5))*d;v.addScaledVector(dir.normalize(),f)}}if(v.length()>9)v.setLength(9)}for(let i=0;i<BIRDS;i++){velocities[i].copy(nextVel[i]);positions[i].addScaledVector(velocities[i],d*15);marbles[i].position.copy(positions[i])}}
function updateCamera(now){const elapsed=(now-startedAt)/1000;if(elapsed<=60)return;const t=Math.min(1,(elapsed-60)/12),e=t*t*(3-2*t);camera.position.y=180*e;camera.position.z=controls.CAMERA;camera.lookAt(0,0,0)}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})
function animate(){requestAnimationFrame(animate);const now=performance.now();let dt=(now-last)/1000;if(dt>1)dt=1;last=now;if(donutEligible)stepDonut(dt);updateCamera(now);renderer.render(scene,camera)}animate()
