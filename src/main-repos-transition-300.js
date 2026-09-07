import * as THREE from 'three'
import GUI from 'lil-gui'
import {createEntityBeadTemplates,addEntityLights} from './entity-bead-factory.js'

// DONUT : 500 billes. Nouvelle valeur validée : séparation 45, alignement 8, cohésion 60.
// Une Entity éligible conserve ses caractéristiques visuelles dans le murmure :
// personnalité/couleur, goûts/reliefs, opinions/éclats, connaissances/traînées,
// monde propre/rotation et histoire vécue/halos. Capacités reste à 44 % : pas de satellite (seuil 70 %).
const DONUT_ELIGIBILITY={beads:500,reposAcquired:true,emotionalTrigger:'JOIE',domains:{PERSONNALITE:61,RELATION:62,GOUTS:63,OPINIONS_VALEURS:61,CONNAISSANCES:62,MONDE_PROPRE:52,HISTOIRE_VECUE:48,CAPACITES:44}}
const BIRDS=500,REFERENCE_BIRDS=32*32,REFERENCE_BOUNDS=800,ENTITY_VISUAL_UNIT=6
const controls={BOUNDS:.51,CENTRE:4.9,SEPARATION:45,ALIGNEMENT:8,COHESION:60,CAMERA:840,TAILLE:2.2,VITESSE:.35}
const templates=createEntityBeadTemplates(BIRDS,{personalityLevel:DONUT_ELIGIBILITY.domains.PERSONNALITE,tasteLevel:DONUT_ELIGIBILITY.domains.GOUTS})
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
for(let i=0;i<BIRDS;i++){const t=templates[i];let d=familyDefs.get(t.kind);if(!d){d={geometry:t.geometry,items:[],mesh:null};familyDefs.set(t.kind,d)}beadFamily[i]=d;beadSlot[i]=d.items.length;d.items.push(i)}
const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.38,metalness:.02})
const dummy=new THREE.Object3D(),ownAxes=new Array(BIRDS),ownRates=new Float32Array(BIRDS)
function randomUnit(i){const a=(i*12.9898+78.233),b=(i*39.3467+11.135);const x=Math.sin(a)*43758.5453%2-1,y=Math.sin(b)*24634.6345%2-1,z=Math.sin(a+b)*56445.234%2-1;return new THREE.Vector3(x,y,z).normalize()}
for(let i=0;i<BIRDS;i++){ownAxes[i]=randomUnit(i+17);ownRates[i]=.55+.7*((i*37)%101)/100}
for(const d of familyDefs.values()){const m=new THREE.InstancedMesh(d.geometry,material,d.items.length);m.frustumCulled=false;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(m);d.mesh=m;for(let k=0;k<d.items.length;k++){const i=d.items[k];m.setColorAt(k,templates[i].color)}if(m.instanceColor)m.instanceColor.needsUpdate=true}
for(let i=0;i<BIRDS;i++){const q=i*3,px=Math.random()*startBounds-startHalf,py=Math.random()*startBounds-startHalf,pz=Math.random()*startBounds-startHalf;initialPositions[q]=renderPositions[q]=px;initialPositions[q+1]=renderPositions[q+1]=py;initialPositions[q+2]=renderPositions[q+2]=pz;initialVelocities[q]=(Math.random()-.5)*10;initialVelocities[q+1]=(Math.random()-.5)*10;initialVelocities[q+2]=(Math.random()-.5)*10}
function updateInstances(now){const visualScale=controls.TAILLE*ENTITY_VISUAL_UNIT,worldFactor=DONUT_ELIGIBILITY.domains.MONDE_PROPRE/100;for(let i=0;i<BIRDS;i++){const q=i*3;dummy.position.set(renderPositions[q],renderPositions[q+1],renderPositions[q+2]);dummy.scale.setScalar(visualScale);dummy.quaternion.setFromAxisAngle(ownAxes[i],now*.001*ownRates[i]*worldFactor*2.4);dummy.updateMatrix();beadFamily[i].mesh.setMatrixAt(beadSlot[i],dummy.matrix)}for(const d of familyDefs.values())d.mesh.instanceMatrix.needsUpdate=true}
updateInstances(performance.now())

// ---- Histoire vécue : halo extérieur uniquement, jamais bille émissive. ----
const HISTORY_COUNT=Math.round(BIRDS*DONUT_ELIGIBILITY.domains.HISTOIRE_VECUE/100)
const haloGeo=new THREE.BufferGeometry(),haloPositions=new Float32Array(HISTORY_COUNT*3),haloColors=new Float32Array(HISTORY_COUNT*3)
haloGeo.setAttribute('position',new THREE.BufferAttribute(haloPositions,3));haloGeo.setAttribute('color',new THREE.BufferAttribute(haloColors,3))
for(let i=0;i<HISTORY_COUNT;i++){const c=templates[i].color;haloColors[i*3]=c.r;haloColors[i*3+1]=c.g;haloColors[i*3+2]=c.b}
const haloMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,vertexColors:true,uniforms:{uSize:{value:controls.TAILLE*ENTITY_VISUAL_UNIT*4.5}},vertexShader:`uniform float uSize;varying vec3 vColor;void main(){vColor=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=uSize*(620.0/max(1.0,-mv.z));gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying vec3 vColor;void main(){vec2 p=gl_PointCoord-.5;float r=length(p)*2.;float ring=smoothstep(.72,.58,r)*(1.-smoothstep(.92,1.,r));float a=ring*.55;if(a<.01)discard;gl_FragColor=vec4(vColor,a);}`})
const halos=new THREE.Points(haloGeo,haloMat);halos.frustumCulled=false;scene.add(halos)
function updateHalos(){for(let i=0;i<HISTORY_COUNT;i++){const q=i*3;haloPositions[q]=renderPositions[q];haloPositions[q+1]=renderPositions[q+1];haloPositions[q+2]=renderPositions[q+2]}haloGeo.attributes.position.needsUpdate=true;haloMat.uniforms.uSize.value=controls.TAILLE*ENTITY_VISUAL_UNIT*4.5}

// ---- Connaissances : pose longue mobile, pool unique de points, 2.5 s ON puis 5-9 s OFF. ----
const KNOWLEDGE_COUNT=Math.round(BIRDS*DONUT_ELIGIBILITY.domains.CONNAISSANCES/100),TRAIL_MAX=12000,TRAIL_LIFE=3,TRAIL_SPACING=.42
const trailGeo=new THREE.BufferGeometry(),trailPos=new Float32Array(TRAIL_MAX*3),trailCol=new Float32Array(TRAIL_MAX*3),trailAlpha=new Float32Array(TRAIL_MAX),trailBorn=new Float32Array(TRAIL_MAX)
trailGeo.setAttribute('position',new THREE.BufferAttribute(trailPos,3));trailGeo.setAttribute('color',new THREE.BufferAttribute(trailCol,3));trailGeo.setAttribute('aAlpha',new THREE.BufferAttribute(trailAlpha,1))
const trailMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:THREE.NormalBlending,vertexColors:true,uniforms:{uSize:{value:controls.TAILLE*ENTITY_VISUAL_UNIT*1.42}},vertexShader:`uniform float uSize;attribute float aAlpha;varying vec3 vColor;varying float vAlpha;void main(){vColor=color;vAlpha=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=uSize*(620.0/max(1.0,-mv.z));gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying vec3 vColor;varying float vAlpha;void main(){vec2 p=gl_PointCoord-.5;float r=length(p)*2.;float a=(1.-smoothstep(.76,1.,r))*vAlpha;if(a<.008)discard;gl_FragColor=vec4(vColor,a);}`})
const trails=new THREE.Points(trailGeo,trailMat);trails.frustumCulled=false;scene.add(trails)
const knowledgeLast=new Float32Array(KNOWLEDGE_COUNT*3),knowledgePhase=new Float32Array(KNOWLEDGE_COUNT),knowledgeCycle=new Float32Array(KNOWLEDGE_COUNT)
for(let i=0;i<KNOWLEDGE_COUNT;i++){knowledgePhase[i]=Math.random()*8;knowledgeCycle[i]=7.5+Math.random()*4}
let trailHead=0
function updateTrails(now,dt){const t=now*.001;for(let k=0;k<TRAIL_MAX;k++){const age=t-trailBorn[k];trailAlpha[k]=age>=0&&age<TRAIL_LIFE?.27*(1-age/TRAIL_LIFE):0}for(let i=0;i<KNOWLEDGE_COUNT;i++){const cyc=knowledgeCycle[i],phase=(t+knowledgePhase[i])%cyc;if(phase>2.5)continue;const q=i*3,l=i*3,dx=renderPositions[q]-knowledgeLast[l],dy=renderPositions[q+1]-knowledgeLast[l+1],dz=renderPositions[q+2]-knowledgeLast[l+2],d=Math.hypot(dx,dy,dz);if(knowledgeLast[l]===0||d>=TRAIL_SPACING){const c=templates[i].color,k=trailHead++%TRAIL_MAX,p=k*3;trailPos[p]=renderPositions[q];trailPos[p+1]=renderPositions[q+1];trailPos[p+2]=renderPositions[q+2];trailCol[p]=c.r;trailCol[p+1]=c.g;trailCol[p+2]=c.b;trailBorn[k]=t;trailAlpha[k]=.27;knowledgeLast[l]=renderPositions[q];knowledgeLast[l+1]=renderPositions[q+1];knowledgeLast[l+2]=renderPositions[q+2]}}trailGeo.attributes.position.needsUpdate=true;trailGeo.attributes.color.needsUpdate=true;trailGeo.attributes.aAlpha.needsUpdate=true;trailMat.uniforms.uSize.value=controls.TAILLE*ENTITY_VISUAL_UNIT*1.42}

// ---- Opinions / valeurs : éclats directionnels fugitifs, un seul draw call. ----
const OPINION_COUNT=Math.round(BIRDS*DONUT_ELIGIBILITY.domains.OPINIONS_VALEURS/100)
const flashGeo=new THREE.BufferGeometry(),flashPos=new Float32Array(OPINION_COUNT*3),flashAlpha=new Float32Array(OPINION_COUNT),flashNormals=Array.from({length:OPINION_COUNT},(_,i)=>randomUnit(i+911)),flashNext=new Float32Array(OPINION_COUNT),flashAge=new Float32Array(OPINION_COUNT)
flashGeo.setAttribute('position',new THREE.BufferAttribute(flashPos,3));flashGeo.setAttribute('aAlpha',new THREE.BufferAttribute(flashAlpha,1))
const flashMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,uniforms:{uSize:{value:8}},vertexShader:`attribute float aAlpha;varying float vAlpha;void main(){vAlpha=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=8.;gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying float vAlpha;void main(){vec2 p=gl_PointCoord-.5;float r=length(p)*2.;float a=(1.-smoothstep(.15,1.,r))*vAlpha;if(a<.01)discard;gl_FragColor=vec4(vec3(1.),a);}`})
const flashes=new THREE.Points(flashGeo,flashMat);flashes.frustumCulled=false;scene.add(flashes)
for(let i=0;i<OPINION_COUNT;i++){flashNext[i]=Math.random()*2;flashAge[i]=99}
const tmpV=new THREE.Vector3()
function updateFlashes(now,dt){const t=now*.001,radius=controls.TAILLE*ENTITY_VISUAL_UNIT*1.06;for(let i=0;i<OPINION_COUNT;i++){if(t>=flashNext[i]){flashAge[i]=0;flashNext[i]=t+1.3+Math.random()*3.5;flashNormals[i].copy(randomUnit(i+Math.floor(t*1000)))}else flashAge[i]+=dt;const q=i*3,n=flashNormals[i],p=i*3;flashPos[p]=renderPositions[q]+n.x*radius;flashPos[p+1]=renderPositions[q+1]+n.y*radius;flashPos[p+2]=renderPositions[q+2]+n.z*radius;tmpV.set(camera.position.x-flashPos[p],camera.position.y-flashPos[p+1],camera.position.z-flashPos[p+2]).normalize();const facing=Math.max(0,n.dot(tmpV)),life=flashAge[i]<.08?1-flashAge[i]/.08:0;flashAlpha[i]=life*Math.pow(facing,1.5)}flashGeo.attributes.position.needsUpdate=true;flashGeo.attributes.aAlpha.needsUpdate=true}

const worker=new Worker(new URL('./donut-physics-worker.js',import.meta.url),{type:'module'}),snapshotQueue=[]
const PLAYBACK_DELAY_MS=70,MAX_QUEUE=12
let physicsClockMs=0,lastSnapshotAt=0,workerIntervalMs=0,workerComputeMs=0,workerSnapshots=0
worker.onmessage=e=>{if(e.data?.type!=='snapshot')return;const now=performance.now();if(lastSnapshotAt)workerIntervalMs=now-lastSnapshotAt;lastSnapshotAt=now;workerComputeMs=e.data.computeMs||0;workerSnapshots++;physicsClockMs+=Math.max(1,e.data.intervalMs||16.7);snapshotQueue.push({t:physicsClockMs,p:new Float64Array(e.data.positions)});if(snapshotQueue.length>MAX_QUEUE)snapshotQueue.splice(0,snapshotQueue.length-MAX_QUEUE)}
function syncPhysicsControls(){worker.postMessage({type:'controls',controls:{CENTRE:controls.CENTRE,SEPARATION:controls.SEPARATION,ALIGNEMENT:controls.ALIGNEMENT,COHESION:controls.COHESION,VITESSE:controls.VITESSE}})}
if(donutEligible){const p=initialPositions.slice(),v=initialVelocities.slice();worker.postMessage({type:'init',birds:BIRDS,controls:{CENTRE:controls.CENTRE,SEPARATION:controls.SEPARATION,ALIGNEMENT:controls.ALIGNEMENT,COHESION:controls.COHESION,VITESSE:controls.VITESSE},positions:p.buffer,velocities:v.buffer},[p.buffer,v.buffer])}

const gui=new GUI({title:'DONUT — ENTITY ÉLIGIBLE'});gui.add(controls,'BOUNDS',.1,1,.01);gui.add(controls,'CENTRE',0,10,.1).onChange(syncPhysicsControls);gui.add(controls,'SEPARATION',0,100,1).onChange(syncPhysicsControls);gui.add(controls,'ALIGNEMENT',0,100,1).onChange(syncPhysicsControls);gui.add(controls,'COHESION',0,100,1).onChange(syncPhysicsControls);gui.add(controls,'CAMERA',200,1200,10).onChange(v=>{camera.position.z=v;camera.lookAt(0,0,0)});gui.add(controls,'TAILLE',.2,5,.1);gui.add(controls,'VITESSE',.05,2,.05).onChange(syncPhysicsControls)
const status=document.createElement('div');status.textContent='DONUT — 500 billes · 45 / 8 / 60 · Entity éligible : P61 R62 G63 O61 C62 M52 H48 Cap44';Object.assign(status.style,{position:'fixed',left:'14px',bottom:'12px',color:'rgba(255,255,255,.62)',font:'12px Arial',pointerEvents:'none'});document.body.appendChild(status)
const diag=document.createElement('pre');Object.assign(diag.style,{position:'fixed',right:'14px',bottom:'12px',margin:0,padding:'10px 12px',background:'rgba(0,0,0,.62)',color:'#fff',font:'12px monospace',lineHeight:'1.45',pointerEvents:'none',zIndex:9999});document.body.appendChild(diag)
const startedAt=performance.now();let playbackStartWall=0,playbackStartPhysics=0
function renderBuffered(now){if(snapshotQueue.length<2)return;if(!playbackStartWall){playbackStartWall=now;playbackStartPhysics=Math.max(snapshotQueue[0].t,physicsClockMs-PLAYBACK_DELAY_MS)}let target=playbackStartPhysics+(now-playbackStartWall),newest=snapshotQueue[snapshotQueue.length-1].t;if(target>newest){playbackStartWall=now;playbackStartPhysics=Math.max(snapshotQueue[0].t,newest-16.7);target=playbackStartPhysics}while(snapshotQueue.length>2&&snapshotQueue[1].t<=target)snapshotQueue.shift();const a=snapshotQueue[0],b=snapshotQueue[1];if(!a||!b)return;const span=Math.max(1e-6,b.t-a.t),f=Math.min(1,Math.max(0,(target-a.t)/span));for(let i=0;i<renderPositions.length;i++)renderPositions[i]=a.p[i]+(b.p[i]-a.p[i])*f}
function updateCamera(now){const elapsed=(now-startedAt)/1000;if(elapsed<=60)return;const t=Math.min(1,(elapsed-60)/12),e=t*t*(3-2*t);camera.position.y=180*e;camera.position.z=controls.CAMERA;camera.lookAt(0,0,0)}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});addEventListener('beforeunload',()=>worker.postMessage({type:'stop'}))
let prevFrame=performance.now(),sampleStart=prevFrame,frames=0,sumFrame=0,maxFrame=0,sumUpdate=0,sumRender=0,maxRender=0,lastWorkerSnapshots=0
function animate(){requestAnimationFrame(animate);const now=performance.now(),dt=Math.min(.1,(now-prevFrame)/1000),frameMs=now-prevFrame;prevFrame=now;frames++;sumFrame+=frameMs;maxFrame=Math.max(maxFrame,frameMs);const u0=performance.now();renderBuffered(now);updateInstances(now);updateHalos();updateTrails(now,dt);updateFlashes(now,dt);sumUpdate+=performance.now()-u0;updateCamera(now);const r0=performance.now();renderer.render(scene,camera);const rm=performance.now()-r0;sumRender+=rm;maxRender=Math.max(maxRender,rm);if(now-sampleStart>=1000){const elapsed=now-sampleStart,fps=frames*1000/elapsed,snapshotHz=(workerSnapshots-lastWorkerSnapshots)*1000/elapsed;diag.textContent=`FPS             ${fps.toFixed(1)}\nFrame moy       ${(sumFrame/frames).toFixed(2)} ms\nFrame max       ${maxFrame.toFixed(2)} ms\nEntity update   ${(sumUpdate/frames).toFixed(2)} ms\nWebGL render    ${(sumRender/frames).toFixed(2)} ms\nRender max      ${maxRender.toFixed(2)} ms\nWorker calcul   ${workerComputeMs.toFixed(2)} ms\nWorker interval ${workerIntervalMs.toFixed(2)} ms\nWorker cadence  ${snapshotHz.toFixed(1)} Hz\nQueue           ${snapshotQueue.length}\nDraw calls      ${renderer.info.render.calls}\nFamilies        ${familyDefs.size}\nTrails pool     ${TRAIL_MAX}`;lastWorkerSnapshots=workerSnapshots;sampleStart=now;frames=0;sumFrame=0;maxFrame=0;sumUpdate=0;sumRender=0;maxRender=0}}
animate()
