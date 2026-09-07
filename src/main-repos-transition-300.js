import * as THREE from 'three'
import GUI from 'lil-gui'

// TEST : même scène / mêmes billes Entity, mais REPOS calculé directement dans la boucle CPU d'Entity.
// Aucun second moteur GPGPU. On vérifie seulement si le comportement REPOS historique reste fidèle.
const captured=[];let entityGroup=null
const originalAdd=THREE.Object3D.prototype.add
THREE.Object3D.prototype.add=function(...objects){const r=originalAdd.apply(this,objects);for(const o of objects)if(o?.userData?.textureUnitScale&&captured.length<200){captured.push(o);entityGroup=this}return r}
await import('./main-first-connection-panel.js');THREE.Object3D.prototype.add=originalAdd
let entityScene=entityGroup;while(entityScene?.parent)entityScene=entityScene.parent

function cloneMaterial(m){return m?.clone?m.clone():m}
function cloneBody(src){const c=src.clone(true);c.traverse(n=>{if(n.material)n.material=Array.isArray(n.material)?n.material.map(cloneMaterial):cloneMaterial(n.material);if(n.isMesh){n.castShadow=true;n.receiveShadow=true}});return c}

const BIRDS=300,REFERENCE_BIRDS=32*32,REFERENCE_BOUNDS=800,BOUNDS_FACTOR=.51
const BASE_BOUNDS=REFERENCE_BOUNDS*Math.cbrt(BIRDS/REFERENCE_BIRDS),BOUNDS=BASE_BOUNDS*BOUNDS_FACTOR,BOUNDS_HALF=BOUNDS/2
const REPOS={CENTRE:4.9,SEPARATION:30,ALIGNEMENT:1,COHESION:60,VITESSE:.35,CAMERA:840,TAILLE:2.2}
const ZONE=REPOS.SEPARATION+REPOS.ALIGNEMENT+REPOS.COHESION,ZONE2=ZONE*ZONE
const SEP_T=REPOS.SEPARATION/ZONE,ALIGN_T=(REPOS.SEPARATION+REPOS.ALIGNEMENT)/ZONE,SPEED_LIMIT=9

const app=document.querySelector('#app');app.innerHTML=''
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;app.appendChild(renderer.domElement)
const scene=new THREE.Scene();scene.background=entityScene?.background?.clone?.()||new THREE.Color(0x1d1f22)
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,3000);camera.position.z=REPOS.CAMERA
if(entityScene)entityScene.traverse(o=>{if(!o.isLight)return;const l=o.clone();l.position.copy(o.position);l.quaternion.copy(o.quaternion);l.scale.copy(o.scale);l.castShadow=o.castShadow;if(l.shadow&&o.shadow){l.shadow.mapSize.copy(o.shadow.mapSize);l.shadow.camera.near=o.shadow.camera.near;l.shadow.camera.far=o.shadow.camera.far;l.shadow.bias=o.shadow.bias;l.shadow.normalBias=o.shadow.normalBias}scene.add(l)})

const marbles=[],positions=[],velocities=[]
for(let i=0;i<BIRDS;i++){
  const c=cloneBody(captured[i%captured.length]);c.scale.multiplyScalar(REPOS.TAILLE/.90);scene.add(c);marbles.push(c)
  const p=new THREE.Vector3(Math.random()*BOUNDS-BOUNDS_HALF,Math.random()*BOUNDS-BOUNDS_HALF,Math.random()*BOUNDS-BOUNDS_HALF)
  const v=new THREE.Vector3((Math.random()-.5)*10,(Math.random()-.5)*10,(Math.random()-.5)*10)
  positions.push(p);velocities.push(v);c.position.copy(p)
}

// Connaissances : mêmes paramètres validés que dans Entity.
const KNOWLEDGE_LEVEL=.27,KNOWLEDGE_ON=2.5,KNOWLEDGE_OFF_MIN=5,KNOWLEDGE_OFF_MAX=9,AFTERIMAGE_LIFE=3,AFTERIMAGE_SPACING=.42,AFTERIMAGE_SIZE=9.4,AFTERIMAGE_ALPHA=.27
function bodyColor(o){let c=new THREE.Color(0xffffff),found=false;o.traverse(n=>{if(!found&&n.isMesh&&n.material?.color){c=n.material.color.clone();found=true}});return c}
const knowledgeIds=Array.from({length:BIRDS},(_,i)=>i).sort(()=>Math.random()-.5).slice(0,Math.round(BIRDS*KNOWLEDGE_LEVEL))
const knowledge=new Map();for(const i of knowledgeIds)knowledge.set(i,{on:Math.random()*KNOWLEDGE_ON,off:0,last:new THREE.Vector3(1e9,1e9,1e9),marks:[]})
const ghostGeo=new THREE.SphereGeometry(AFTERIMAGE_SIZE,10,8)
function emitGhost(i,k,now){const p=marbles[i].position;if(p.distanceTo(k.last)<AFTERIMAGE_SPACING)return;k.last.copy(p);const mat=new THREE.MeshBasicMaterial({color:bodyColor(marbles[i]),transparent:true,opacity:AFTERIMAGE_ALPHA,depthWrite:false,toneMapped:false});const mesh=new THREE.Mesh(ghostGeo,mat);mesh.position.copy(p);scene.add(mesh);k.marks.push({mesh,born:now})}
function updateKnowledge(dt,now){for(const [i,k] of knowledge){if(k.on>0){k.on-=dt;emitGhost(i,k,now);if(k.on<=0)k.off=THREE.MathUtils.lerp(KNOWLEDGE_OFF_MIN,KNOWLEDGE_OFF_MAX,Math.random())}else{k.off-=dt;if(k.off<=0){k.on=KNOWLEDGE_ON;k.last.set(1e9,1e9,1e9)}}for(let j=k.marks.length-1;j>=0;j--){const g=k.marks[j],age=(now-g.born)/1000;if(age>=AFTERIMAGE_LIFE){scene.remove(g.mesh);g.mesh.material.dispose();k.marks.splice(j,1)}else g.mesh.material.opacity=AFTERIMAGE_ALPHA*(1-age/AFTERIMAGE_LIFE)}}}

const controls={BOUNDS:.51,CENTRE:4.9,SEPARATION:30,ALIGNEMENT:1,COHESION:60,CAMERA:840,TAILLE:2.2,VITESSE:.35}
const gui=new GUI({title:'REPOS — MOTEUR ENTITY'});for(const k of Object.keys(controls))gui.add(controls,k).disable()
const status=document.createElement('div');status.textContent='REPOS — 300 billes Entity · forces collectives calculées dans le moteur CPU Entity';Object.assign(status.style,{position:'fixed',left:'14px',bottom:'12px',color:'rgba(255,255,255,.62)',font:'12px Arial',pointerEvents:'none'});document.body.appendChild(status)

const nextVel=Array.from({length:BIRDS},()=>new THREE.Vector3()),dir=new THREE.Vector3(),tmp=new THREE.Vector3()
let last=performance.now()
function stepRepos(dt){
  const d=dt*REPOS.VITESSE
  for(let i=0;i<BIRDS;i++){
    const selfP=positions[i],selfV=velocities[i],v=nextVel[i].copy(selfV)
    dir.copy(selfP);dir.y*=2.5;if(dir.lengthSq()>1e-9)v.addScaledVector(dir.normalize(),-d*REPOS.CENTRE)
    for(let j=0;j<BIRDS;j++){
      if(i===j)continue
      dir.subVectors(positions[j],selfP);const dist2=dir.lengthSq();if(dist2<1e-8||dist2>ZONE2)continue
      const percent=dist2/ZONE2
      if(percent<SEP_T){const f=(SEP_T/percent-1)*d;v.addScaledVector(dir.normalize(),-f)}
      else if(percent<ALIGN_T){const td=ALIGN_T-SEP_T,ap=(percent-SEP_T)/td;const f=(.5-Math.cos(ap*Math.PI*2)*.5+.5)*d;tmp.copy(velocities[j]);if(tmp.lengthSq()>1e-9)v.addScaledVector(tmp.normalize(),f)}
      else{const td=1-ALIGN_T,ap=td===0?1:(percent-ALIGN_T)/td;const f=(.5-(Math.cos(ap*Math.PI*2)*-.5+.5))*d;v.addScaledVector(dir.normalize(),f)}
    }
    if(v.length()>SPEED_LIMIT)v.setLength(SPEED_LIMIT)
  }
  for(let i=0;i<BIRDS;i++){
    velocities[i].copy(nextVel[i]);positions[i].addScaledVector(velocities[i],d*15);marbles[i].position.copy(positions[i])
  }
}

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})
function animate(){requestAnimationFrame(animate);const now=performance.now();let dt=(now-last)/1000;if(dt>1)dt=1;last=now;stepRepos(dt);updateKnowledge(dt,now);renderer.render(scene,camera)}animate()
