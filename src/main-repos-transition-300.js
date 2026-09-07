import * as THREE from 'three'
import GUI from 'lil-gui'
import {createEntityBeadTemplates,addEntityLights} from './entity-bead-factory.js'

// DONUT validé : 500 billes, 30 / 8 / 60 inchangés.
// Aucun import du moteur Entity : uniquement une factory visuelle légère et réutilisable.
// Les géométries de la factory sont en unité 1 ; facteur visuel 6 pour retrouver
// exactement l'échelle des billes Entity historiques avec TAILLE 2.2.
const DONUT_ELIGIBILITY={beads:500,reposAcquired:true,emotionalTrigger:'JOIE',domains:{PERSONNALITE:61,RELATION:62,GOUTS:63,OPINIONS_VALEURS:61,CONNAISSANCES:62,MONDE_PROPRE:52,HISTOIRE_VECUE:48,CAPACITES:44}}
const BIRDS=500,REFERENCE_BIRDS=32*32,REFERENCE_BOUNDS=800,ENTITY_VISUAL_UNIT=6
const controls={BOUNDS:.51,CENTRE:4.9,SEPARATION:30,ALIGNEMENT:8,COHESION:60,CAMERA:840,TAILLE:2.2,VITESSE:.35}
const templates=createEntityBeadTemplates(200)
function currentBounds(){return REFERENCE_BOUNDS*Math.cbrt(BIRDS/REFERENCE_BIRDS)*controls.BOUNDS}
const eligibleDomains=Object.values(DONUT_ELIGIBILITY.domains).filter(v=>v>=60&&v<=65).sort((a,b)=>a-b)
const donutEligible=BIRDS>=500&&DONUT_ELIGIBILITY.reposAcquired&&eligibleDomains.length>=5&&(eligibleDomains[4]-eligibleDomains[0]<=3)&&!!DONUT_ELIGIBILITY.emotionalTrigger

const app=document.querySelector('#app');app.innerHTML=''
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;app.appendChild(renderer.domElement)
const scene=new THREE.Scene();scene.background=new THREE.Color(0x1d1f22);addEntityLights(scene)
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,3000);camera.position.set(0,0,controls.CAMERA);camera.lookAt(0,0,0)

const initialPositions=new Float64Array(BIRDS*3),initialVelocities=new Float64Array(BIRDS*3),renderPositions=new Float64Array(BIRDS*3)
const startBounds=currentBounds(),startHalf=startBounds/2
const familyDefs=new Map(),beadFamily=new Array(BIRDS),beadSlot=new Int32Array(BIRDS)
for(let i=0;i<BIRDS;i++){const t=templates[i%templates.length];let d=familyDefs.get(t.kind);if(!d){d={geometry:t.geometry,items:[],mesh:null};familyDefs.set(t.kind,d)}beadFamily[i]=d;beadSlot[i]=d.items.length;d.items.push(i)}
const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.38,metalness:.02})
const dummy=new THREE.Object3D()
for(const d of familyDefs.values()){const m=new THREE.InstancedMesh(d.geometry,material,d.items.length);m.frustumCulled=false;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(m);d.mesh=m;for(let k=0;k<d.items.length;k++){const i=d.items[k],t=templates[i%templates.length];m.setColorAt(k,t.color)}if(m.instanceColor)m.instanceColor.needsUpdate=true}
for(let i=0;i<BIRDS;i++){const q=i*3,px=Math.random()*startBounds-startHalf,py=Math.random()*startBounds-startHalf,pz=Math.random()*startBounds-startHalf;initialPositions[q]=renderPositions[q]=px;initialPositions[q+1]=renderPositions[q+1]=py;initialPositions[q+2]=renderPositions[q+2]=pz;initialVelocities[q]=(Math.random()-.5)*10;initialVelocities[q+1]=(Math.random()-.5)*10;initialVelocities[q+2]=(Math.random()-.5)*10}
function updateInstances(){const visualScale=controls.TAILLE*ENTITY_VISUAL_UNIT;for(let i=0;i<BIRDS;i++){const q=i*3;dummy.position.set(renderPositions[q],renderPositions[q+1],renderPositions[q+2]);dummy.scale.setScalar(visualScale);dummy.updateMatrix();beadFamily[i].mesh.setMatrixAt(beadSlot[i],dummy.matrix)}for(const d of familyDefs.values())d.mesh.instanceMatrix.needsUpdate=true}
updateInstances()

const worker=new Worker(new URL('./donut-physics-worker.js',import.meta.url),{type:'module'}),snapshotQueue=[]
const PLAYBACK_DELAY_MS=70,MAX_QUEUE=12
let physicsClockMs=0,lastSnapshotAt=0,workerIntervalMs=0,workerComputeMs=0,workerSnapshots=0
worker.onmessage=e=>{if(e.data?.type!=='snapshot')return;const now=performance.now();if(lastSnapshotAt)workerIntervalMs=now-lastSnapshotAt;lastSnapshotAt=now;workerComputeMs=e.data.computeMs||0;workerSnapshots++;physicsClockMs+=Math.max(1,e.data.intervalMs||16.7);snapshotQueue.push({t:physicsClockMs,p:new Float64Array(e.data.positions)});if(snapshotQueue.length>MAX_QUEUE)snapshotQueue.splice(0,snapshotQueue.length-MAX_QUEUE)}
function syncPhysicsControls(){worker.postMessage({type:'controls',controls:{CENTRE:controls.CENTRE,SEPARATION:controls.SEPARATION,ALIGNEMENT:controls.ALIGNEMENT,COHESION:controls.COHESION,VITESSE:controls.VITESSE}})}
if(donutEligible){const p=initialPositions.slice(),v=initialVelocities.slice();worker.postMessage({type:'init',birds:BIRDS,controls:{CENTRE:controls.CENTRE,SEPARATION:controls.SEPARATION,ALIGNEMENT:controls.ALIGNEMENT,COHESION:controls.COHESION,VITESSE:controls.VITESSE},positions:p.buffer,velocities:v.buffer},[p.buffer,v.buffer])}

const gui=new GUI({title:'DONUT — FACTORY MOBILE'});gui.add(controls,'BOUNDS',.1,1,.01);gui.add(controls,'CENTRE',0,10,.1).onChange(syncPhysicsControls);gui.add(controls,'SEPARATION',0,100,1).onChange(syncPhysicsControls);gui.add(controls,'ALIGNEMENT',0,100,1).onChange(syncPhysicsControls);gui.add(controls,'COHESION',0,100,1).onChange(syncPhysicsControls);gui.add(controls,'CAMERA',200,1200,10).onChange(v=>{camera.position.z=v;camera.lookAt(0,0,0)});gui.add(controls,'TAILLE',.2,5,.1);gui.add(controls,'VITESSE',.05,2,.05).onChange(syncPhysicsControls)
const status=document.createElement('div');status.textContent='DONUT VALIDÉ — 500 billes · 30 / 8 / 60 · FACTORY SANS MOTEUR ENTITY · ÉCHELLE ENTITY';Object.assign(status.style,{position:'fixed',left:'14px',bottom:'12px',color:'rgba(255,255,255,.62)',font:'12px Arial',pointerEvents:'none'});document.body.appendChild(status)
const diag=document.createElement('pre');Object.assign(diag.style,{position:'fixed',right:'14px',bottom:'12px',margin:0,padding:'10px 12px',background:'rgba(0,0,0,.62)',color:'#fff',font:'12px monospace',lineHeight:'1.45',pointerEvents:'none',zIndex:9999});document.body.appendChild(diag)
const startedAt=performance.now();let playbackStartWall=0,playbackStartPhysics=0
function renderBuffered(now){if(snapshotQueue.length<2)return;if(!playbackStartWall){playbackStartWall=now;playbackStartPhysics=Math.max(snapshotQueue[0].t,physicsClockMs-PLAYBACK_DELAY_MS)}let target=playbackStartPhysics+(now-playbackStartWall),newest=snapshotQueue[snapshotQueue.length-1].t;if(target>newest){playbackStartWall=now;playbackStartPhysics=Math.max(snapshotQueue[0].t,newest-16.7);target=playbackStartPhysics}while(snapshotQueue.length>2&&snapshotQueue[1].t<=target)snapshotQueue.shift();const a=snapshotQueue[0],b=snapshotQueue[1];if(!a||!b)return;const span=Math.max(1e-6,b.t-a.t),f=Math.min(1,Math.max(0,(target-a.t)/span));for(let i=0;i<renderPositions.length;i++)renderPositions[i]=a.p[i]+(b.p[i]-a.p[i])*f;updateInstances()}
function updateCamera(now){const elapsed=(now-startedAt)/1000;if(elapsed<=60)return;const t=Math.min(1,(elapsed-60)/12),e=t*t*(3-2*t);camera.position.y=180*e;camera.position.z=controls.CAMERA;camera.lookAt(0,0,0)}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});addEventListener('beforeunload',()=>worker.postMessage({type:'stop'}))
let prevFrame=performance.now(),sampleStart=prevFrame,frames=0,sumFrame=0,maxFrame=0,sumUpdate=0,sumRender=0,maxRender=0,lastWorkerSnapshots=0
function animate(){requestAnimationFrame(animate);const now=performance.now(),frameMs=now-prevFrame;prevFrame=now;frames++;sumFrame+=frameMs;maxFrame=Math.max(maxFrame,frameMs);const u0=performance.now();renderBuffered(now);sumUpdate+=performance.now()-u0;updateCamera(now);const r0=performance.now();renderer.render(scene,camera);const rm=performance.now()-r0;sumRender+=rm;maxRender=Math.max(maxRender,rm);if(now-sampleStart>=1000){const elapsed=now-sampleStart,fps=frames*1000/elapsed,snapshotHz=(workerSnapshots-lastWorkerSnapshots)*1000/elapsed;diag.textContent=`FPS             ${fps.toFixed(1)}\nFrame moy       ${(sumFrame/frames).toFixed(2)} ms\nFrame max       ${maxFrame.toFixed(2)} ms\nBuffered update ${(sumUpdate/frames).toFixed(2)} ms\nWebGL render    ${(sumRender/frames).toFixed(2)} ms\nRender max      ${maxRender.toFixed(2)} ms\nWorker calcul   ${workerComputeMs.toFixed(2)} ms\nWorker interval ${workerIntervalMs.toFixed(2)} ms\nWorker cadence  ${snapshotHz.toFixed(1)} Hz\nQueue           ${snapshotQueue.length}\nDraw calls      ${renderer.info.render.calls}\nFamilies        ${familyDefs.size}`;lastWorkerSnapshots=workerSnapshots;sampleStart=now;frames=0;sumFrame=0;maxFrame=0;sumUpdate=0;sumRender=0;maxRender=0}}
animate()
