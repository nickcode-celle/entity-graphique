import * as THREE from 'three'
import GUI from 'lil-gui'

// DONUT validé : mêmes 500 billes, mêmes curseurs 30 / 8 / 60.
// Test rendu mobile-first : InstancedMesh + Entity source RAF neutralisé.
// Les snapshots du Worker sont maintenant conservés dans une file chronologique
// pour éviter les grands sauts lorsque le rendu est plus lent que la physique.
const DONUT_ELIGIBILITY={beads:500,reposAcquired:true,emotionalTrigger:'JOIE',domains:{PERSONNALITE:61,RELATION:62,GOUTS:63,OPINIONS_VALEURS:61,CONNAISSANCES:62,MONDE_PROPRE:52,HISTOIRE_VECUE:48,CAPACITES:44}}
const captured=[];let entityGroup=null
const originalAdd=THREE.Object3D.prototype.add
const originalRAF=window.requestAnimationFrame.bind(window)
THREE.Object3D.prototype.add=function(...objects){const r=originalAdd.apply(this,objects);for(const o of objects)if(o?.userData?.textureUnitScale&&captured.length<200){captured.push(o);entityGroup=this}return r}
window.requestAnimationFrame=()=>0
try{await import('./main-first-connection-panel.js')}finally{window.requestAnimationFrame=originalRAF;THREE.Object3D.prototype.add=originalAdd}
let entityScene=entityGroup;while(entityScene?.parent)entityScene=entityScene.parent

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

const initialPositions=new Float64Array(BIRDS*3),initialVelocities=new Float64Array(BIRDS*3)
const renderPositions=new Float64Array(BIRDS*3)
const roots=new Array(BIRDS),overlayRoots=new Array(BIRDS)
const batchDefs=new Map(),beadEntries=Array.from({length:BIRDS},()=>[])
const startBounds=currentBounds(),startHalf=startBounds/2

function materialKey(mat){return Array.isArray(mat)?mat.map(m=>m.uuid).join(','):mat?.uuid||'none'}
function collectTemplate(src,beadIndex){
  src.updateWorldMatrix(true,true)
  const invRoot=new THREE.Matrix4().copy(src.matrixWorld).invert()
  src.traverse(node=>{
    if(!node.isMesh||!node.geometry||!node.material)return
    node.updateWorldMatrix(true,false)
    const local=new THREE.Matrix4().multiplyMatrices(invRoot,node.matrixWorld)
    const key=`${node.geometry.uuid}|${materialKey(node.material)}|${node.renderOrder}|${node.frustumCulled?'1':'0'}`
    let def=batchDefs.get(key)
    if(!def){def={geometry:node.geometry,material:node.material,castShadow:node.castShadow,receiveShadow:node.receiveShadow,renderOrder:node.renderOrder,frustumCulled:node.frustumCulled,items:[]};batchDefs.set(key,def)}
    const item={beadIndex,local,index:-1,batch:null};def.items.push(item);beadEntries[beadIndex].push(item)
  })
}

for(let i=0;i<BIRDS;i++){
  const src=captured[i%captured.length],root=new THREE.Object3D();root.quaternion.copy(src.quaternion);root.scale.copy(src.scale).multiplyScalar(controls.TAILLE/.90);roots[i]=root
  const q=i*3,px=Math.random()*startBounds-startHalf,py=Math.random()*startBounds-startHalf,pz=Math.random()*startBounds-startHalf,vx=(Math.random()-.5)*10,vy=(Math.random()-.5)*10,vz=(Math.random()-.5)*10
  initialPositions[q]=px;initialPositions[q+1]=py;initialPositions[q+2]=pz;initialVelocities[q]=vx;initialVelocities[q+1]=vy;initialVelocities[q+2]=vz;renderPositions[q]=px;renderPositions[q+1]=py;renderPositions[q+2]=pz;root.position.set(px,py,pz);root.updateMatrix()
  collectTemplate(src,i)
  const overlay=src.clone(true);overlay.traverse(n=>{if(n.isMesh)n.visible=false});overlay.position.set(px,py,pz);overlay.quaternion.copy(src.quaternion);overlay.scale.copy(src.scale).multiplyScalar(controls.TAILLE/.90);scene.add(overlay);overlayRoots[i]=overlay
}

const tempMatrix=new THREE.Matrix4()
for(const def of batchDefs.values()){
  const inst=new THREE.InstancedMesh(def.geometry,def.material,def.items.length);inst.castShadow=def.castShadow;inst.receiveShadow=def.receiveShadow;inst.renderOrder=def.renderOrder;inst.frustumCulled=false;inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(inst)
  for(let k=0;k<def.items.length;k++){const item=def.items[k];item.index=k;item.batch=inst;tempMatrix.multiplyMatrices(roots[item.beadIndex].matrix,item.local);inst.setMatrixAt(k,tempMatrix)}
  inst.instanceMatrix.needsUpdate=true
}

function updateInstances(){
  const touched=new Set()
  for(let i=0;i<BIRDS;i++){
    const q=i*3,root=roots[i];root.position.set(renderPositions[q],renderPositions[q+1],renderPositions[q+2]);root.updateMatrix()
    overlayRoots[i].position.copy(root.position)
    for(const item of beadEntries[i]){tempMatrix.multiplyMatrices(root.matrix,item.local);item.batch.setMatrixAt(item.index,tempMatrix);touched.add(item.batch)}
  }
  for(const batch of touched)batch.instanceMatrix.needsUpdate=true
}

const worker=new Worker(new URL('./donut-physics-worker.js',import.meta.url),{type:'module'})
const snapshotQueue=[]
const PLAYBACK_DELAY_MS=70
const MAX_QUEUE=12
let physicsClockMs=0,lastSnapshotAt=0,workerIntervalMs=0,workerComputeMs=0,workerSnapshots=0
worker.onmessage=e=>{
  if(e.data?.type!=='snapshot')return
  const now=performance.now();if(lastSnapshotAt)workerIntervalMs=now-lastSnapshotAt;lastSnapshotAt=now
  workerComputeMs=e.data.computeMs||0;workerSnapshots++
  const interval=Math.max(1,e.data.intervalMs||16.7);physicsClockMs+=interval
  snapshotQueue.push({t:physicsClockMs,p:new Float64Array(e.data.positions)})
  if(snapshotQueue.length>MAX_QUEUE)snapshotQueue.splice(0,snapshotQueue.length-MAX_QUEUE)
}
function syncPhysicsControls(){worker.postMessage({type:'controls',controls:{CENTRE:controls.CENTRE,SEPARATION:controls.SEPARATION,ALIGNEMENT:controls.ALIGNEMENT,COHESION:controls.COHESION,VITESSE:controls.VITESSE}})}
if(donutEligible){const p=initialPositions.slice(),v=initialVelocities.slice();worker.postMessage({type:'init',birds:BIRDS,controls:{CENTRE:controls.CENTRE,SEPARATION:controls.SEPARATION,ALIGNEMENT:controls.ALIGNEMENT,COHESION:controls.COHESION,VITESSE:controls.VITESSE},positions:p.buffer,velocities:v.buffer},[p.buffer,v.buffer])}

const gui=new GUI({title:'DONUT — TEST BATCH MOBILE'});gui.add(controls,'BOUNDS',.1,1,.01);gui.add(controls,'CENTRE',0,10,.1).onChange(syncPhysicsControls);gui.add(controls,'SEPARATION',0,100,1).onChange(syncPhysicsControls);gui.add(controls,'ALIGNEMENT',0,100,1).onChange(syncPhysicsControls);gui.add(controls,'COHESION',0,100,1).onChange(syncPhysicsControls);gui.add(controls,'CAMERA',200,1200,10).onChange(v=>{camera.position.z=v;camera.lookAt(0,0,0)});gui.add(controls,'TAILLE',.2,5,.1).onChange(v=>{const s=v/.90;for(let i=0;i<BIRDS;i++){roots[i].scale.copy(captured[i%captured.length].scale).multiplyScalar(s);overlayRoots[i].scale.copy(roots[i].scale)}});gui.add(controls,'VITESSE',.05,2,.05).onChange(syncPhysicsControls)
const status=document.createElement('div');status.textContent=`DONUT VALIDÉ — ${donutEligible?'ÉLIGIBLE':'NON ÉLIGIBLE'} · 500 billes · 30 / 8 / 60 · SNAPSHOT BUFFER`;Object.assign(status.style,{position:'fixed',left:'14px',bottom:'12px',color:'rgba(255,255,255,.62)',font:'12px Arial',pointerEvents:'none'});document.body.appendChild(status)
const diag=document.createElement('pre');Object.assign(diag.style,{position:'fixed',right:'14px',bottom:'12px',margin:0,padding:'10px 12px',background:'rgba(0,0,0,.62)',color:'#fff',font:'12px monospace',lineHeight:'1.45',pointerEvents:'none',zIndex:9999});document.body.appendChild(diag)
const startedAt=performance.now()
let playbackStartWall=0,playbackStartPhysics=0
function renderBuffered(now){
  if(snapshotQueue.length<2)return
  if(!playbackStartWall){playbackStartWall=now;playbackStartPhysics=Math.max(snapshotQueue[0].t,physicsClockMs-PLAYBACK_DELAY_MS)}
  let target=playbackStartPhysics+(now-playbackStartWall)
  const newest=snapshotQueue[snapshotQueue.length-1].t
  if(target>newest){playbackStartWall=now;playbackStartPhysics=Math.max(snapshotQueue[0].t,newest-16.7);target=playbackStartPhysics}
  while(snapshotQueue.length>2&&snapshotQueue[1].t<=target)snapshotQueue.shift()
  const a=snapshotQueue[0],b=snapshotQueue[1]
  if(!a||!b)return
  const span=Math.max(1e-6,b.t-a.t),f=Math.min(1,Math.max(0,(target-a.t)/span))
  for(let i=0;i<renderPositions.length;i++)renderPositions[i]=a.p[i]+(b.p[i]-a.p[i])*f
  updateInstances()
}
function updateCamera(now){const elapsed=(now-startedAt)/1000;if(elapsed<=60)return;const t=Math.min(1,(elapsed-60)/12),e=t*t*(3-2*t);camera.position.y=180*e;camera.position.z=controls.CAMERA;camera.lookAt(0,0,0)}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})
addEventListener('beforeunload',()=>worker.postMessage({type:'stop'}))

let prevFrame=performance.now(),sampleStart=prevFrame,frames=0,sumFrame=0,maxFrame=0,sumInterp=0,sumRender=0,maxRender=0,lastWorkerSnapshots=0
function animate(){requestAnimationFrame(animate);const frameStart=performance.now(),frameMs=frameStart-prevFrame;prevFrame=frameStart;frames++;sumFrame+=frameMs;if(frameMs>maxFrame)maxFrame=frameMs
  const i0=performance.now();renderBuffered(frameStart);const interpMs=performance.now()-i0;sumInterp+=interpMs
  updateCamera(frameStart)
  const r0=performance.now();renderer.render(scene,camera);const renderMs=performance.now()-r0;sumRender+=renderMs;if(renderMs>maxRender)maxRender=renderMs
  if(frameStart-sampleStart>=1000){const elapsed=frameStart-sampleStart,fps=frames*1000/elapsed,snapshotHz=(workerSnapshots-lastWorkerSnapshots)*1000/elapsed;diag.textContent=`FPS             ${fps.toFixed(1)}\nFrame moy       ${(sumFrame/frames).toFixed(2)} ms\nFrame max       ${maxFrame.toFixed(2)} ms\nBuffered update ${(sumInterp/frames).toFixed(2)} ms\nWebGL render    ${(sumRender/frames).toFixed(2)} ms\nRender max      ${maxRender.toFixed(2)} ms\nWorker calcul   ${workerComputeMs.toFixed(2)} ms\nWorker interval ${workerIntervalMs.toFixed(2)} ms\nWorker cadence  ${snapshotHz.toFixed(1)} Hz\nQueue           ${snapshotQueue.length}\nDraw calls      ${renderer.info.render.calls}\nBatches         ${batchDefs.size}`;lastWorkerSnapshots=workerSnapshots;sampleStart=frameStart;frames=0;sumFrame=0;maxFrame=0;sumInterp=0;sumRender=0;maxRender=0}}
animate()
