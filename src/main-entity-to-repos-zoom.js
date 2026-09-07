import * as THREE from 'three'
import './style.css'
import {createEntityBeadTemplates,addEntityLights} from './entity-bead-factory.js'

const N=200, UNIT=6, SIZE=.90, ENTITY_CAMERA=280
const REPOS={BOUNDS:.51,CENTRE:4.9,SEPARATION:40,ALIGNEMENT:1,COHESION:60,CAMERA:840,TAILLE:2.2,VITESSE:.35}
const app=document.querySelector('#app');app.innerHTML=''
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;app.appendChild(renderer.domElement)
const scene=new THREE.Scene();scene.background=new THREE.Color(0x1d1f22);addEntityLights(scene)
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,3000);camera.position.set(0,0,ENTITY_CAMERA)
const templates=createEntityBeadTemplates(N),group=new THREE.Group();scene.add(group)
const beads=[],basePositions=[],dummy=new THREE.Object3D()
const ga=Math.PI*(3-Math.sqrt(5))
for(let i=0;i<N;i++){const t=templates[i],m=new THREE.Mesh(t.geometry,new THREE.MeshStandardMaterial({color:t.color,roughness:.38,metalness:.02}));const y=1-(i+.5)*2/N,r=Math.sqrt(Math.max(0,1-y*y)),a=i*ga,p=new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r).multiplyScalar(78);m.position.copy(p);m.scale.setScalar(SIZE*UNIT);m.castShadow=m.receiveShadow=true;group.add(m);beads.push(m);basePositions.push(p.clone())}
let target=0,best=-Infinity
for(let i=0;i<N;i++){const p=basePositions[i],score=p.z-Math.abs(p.x)*.25-Math.abs(p.y)*.25;if(score>best){best=score;target=i}}
const focus=beads[target],focusWorld=new THREE.Vector3(),clock=new THREE.Clock(),start=performance.now()/1000
let phase='entity',worker=null,latest=null,switched=false
const overlay=document.createElement('div');overlay.style.cssText='position:fixed;left:18px;top:18px;color:white;font:14px system-ui;z-index:5;background:#0008;padding:8px 10px;border-radius:8px';overlay.textContent='ENTITY → REPOS · zoom bille';document.body.appendChild(overlay)
function smooth(t){t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)}
function startRepos(){if(switched)return;switched=true;const pos=new Float64Array(N*3),vel=new Float64Array(N*3);for(let i=0;i<N;i++){const q=i*3;pos[q]=(Math.random()-.5)*240;pos[q+1]=(Math.random()-.5)*240;pos[q+2]=(Math.random()-.5)*240;vel[q]=(Math.random()-.5)*8;vel[q+1]=(Math.random()-.5)*8;vel[q+2]=(Math.random()-.5)*8}worker=new Worker(new URL('./donut-physics-worker.js',import.meta.url),{type:'module'});worker.onmessage=e=>{if(e.data?.type==='snapshot')latest=e.data.positions};worker.postMessage({type:'init',count:N,positions:pos,velocities:vel,controls:REPOS});latest=pos}
function animate(){requestAnimationFrame(animate);const now=performance.now()/1000,t=now-start
if(t<2.2){group.rotation.y+=.0014;group.rotation.x+=.00035;for(let i=0;i<N;i++){const p=basePositions[i];beads[i].position.set(p.x+Math.sin(now*.8+i)*1.3,p.y+Math.sin(now*.65+i*1.7)*1.1,p.z+Math.cos(now*.72+i*.9)*1.2)}}
else if(t<4.6){phase='zoom';focus.getWorldPosition(focusWorld);const u=smooth((t-2.2)/2.4),desired=focusWorld.clone().add(new THREE.Vector3(0,0,THREE.MathUtils.lerp(210,4.2,u)));camera.position.lerp(desired,.12);camera.lookAt(focusWorld)}
else if(t<4.9){phase='switch';focus.getWorldPosition(focusWorld);camera.position.copy(focusWorld).add(new THREE.Vector3(0,0,4.2));camera.lookAt(focusWorld);startRepos()}
else {phase='repos';if(latest){for(let i=0;i<N;i++){const q=i*3;beads[i].position.set(latest[q],latest[q+1],latest[q+2]);beads[i].scale.setScalar(REPOS.TAILLE*UNIT)}}const u=smooth((t-4.9)/2.8);const targetCam=new THREE.Vector3(0,0,THREE.MathUtils.lerp(4.2,REPOS.CAMERA,u));camera.position.lerp(targetCam,.13);camera.lookAt(0,0,0)}
overlay.textContent=phase==='entity'?'ENTITY':phase==='zoom'?'ZOOM → bille':phase==='switch'?'RACCORD':'REPOS 40 / 1 / 60 · 0,35';renderer.render(scene,camera)}
animate()
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})
