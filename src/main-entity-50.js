import * as THREE from 'three'
import GUI from 'lil-gui'
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js'
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js'
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js'
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js'
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js'
import './style.css'

const BODY_COUNT=200,SATELLITE_COUNT=5,LEVEL=.50,CAPACITES=.50
const app=document.querySelector('#app'),renderer=new THREE.WebGLRenderer({antialias:true,alpha:true})
renderer.setPixelRatio(Math.min(devicePixelRatio,2))
renderer.setSize(innerWidth,innerHeight)
renderer.shadowMap.enabled=true
renderer.shadowMap.type=THREE.PCFSoftShadowMap
renderer.toneMapping=THREE.ACESFilmicToneMapping
app.appendChild(renderer.domElement)

const scene=new THREE.Scene()
scene.background=new THREE.Color(0x1d1f22)
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,3000)
camera.position.z=280
const entityGroup=new THREE.Group()
scene.add(entityGroup)

// NEW_MARBLE_BIRTH_SPHERE_TEST
const birthGroup=new THREE.Group()
scene.add(birthGroup)
const birthPosition=new THREE.Vector3(-142,0,0)
const birthPointMaterial=new THREE.MeshBasicMaterial({color:0xfff4b0,transparent:true,opacity:1})
const birthPoint=new THREE.Mesh(new THREE.SphereGeometry(.18,20,20),birthPointMaterial)
birthPoint.position.copy(birthPosition)
birthPoint.layers.enable(1)
birthGroup.add(birthPoint)
const birthLight=new THREE.PointLight(0xffd75b,0,90,2)
birthLight.position.copy(birthPosition)
scene.add(birthLight)
const birthMarbleMaterial=new THREE.MeshStandardMaterial({color:0xffd700,metalness:1,roughness:.16,emissive:0x000000,emissiveIntensity:0})
const birthMarble=new THREE.Mesh(new THREE.SphereGeometry(6,28,20),birthMarbleMaterial)
birthMarble.position.copy(birthPosition)
birthMarble.scale.setScalar(.001)
birthMarble.castShadow=true
birthMarble.receiveShadow=true
birthGroup.add(birthMarble)
const solarCoreMaterial=new THREE.MeshBasicMaterial({color:0xfff4b0,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})
const solarCore=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),solarCoreMaterial)
solarCore.position.copy(birthPosition)
solarCore.layers.enable(1)
birthGroup.add(solarCore)
const solarCoronaMaterial=new THREE.MeshBasicMaterial({color:0xffc13b,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})
const solarCorona=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),solarCoronaMaterial)
solarCorona.position.copy(birthPosition)
solarCorona.layers.enable(1)
birthGroup.add(solarCorona)
const solarHaloMaterial=new THREE.MeshBasicMaterial({color:0xff7a18,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})
const solarHalo=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),solarHaloMaterial)
solarHalo.position.copy(birthPosition)
solarHalo.layers.enable(1)
birthGroup.add(solarHalo)
const birthStart=performance.now()/1000
function updateNewMarbleBirth(now){
  const t=now-birthStart-10
  // For the first 10 seconds: ENTITY alone, no light and no marble.
  birthMarble.visible=t>=1.8
  if(t<0){
    birthPoint.visible=false
    birthLight.intensity=0
    solarCoreMaterial.opacity=0
    solarCoronaMaterial.opacity=0
    solarHaloMaterial.opacity=0
    solarCore.scale.setScalar(.001)
    solarCorona.scale.setScalar(.001)
    solarHalo.scale.setScalar(.001)
    birthMarble.visible=false
    return
  }
  if(t<1.8){
    const u=THREE.MathUtils.smoothstep(t,0,1.8)
    birthPoint.visible=true
    birthPoint.scale.setScalar(.8+u*5.2)
    birthLight.intensity=40+560*u
    birthMarble.scale.setScalar(.001)
    solarCoreMaterial.opacity=.15+.62*u
    solarCoronaMaterial.opacity=.08+.34*u
    solarHaloMaterial.opacity=.03+.16*u
    solarCore.scale.setScalar(.35+1.75*u)
    solarCorona.scale.setScalar(.9+2.7*u)
    solarHalo.scale.setScalar(1.8+4.4*u)
  }else if(t<3.85){
    const u=(t-1.8)/2.05
    const e=1-Math.pow(1-u,3)
    birthPoint.visible=u<.16
    birthLight.intensity=820*(1-.55*u)+220
    birthMarble.scale.setScalar(Math.max(.001,THREE.MathUtils.smoothstep(u,.04,.52)*controls.TAILLE_BILLES))
    solarCoreMaterial.opacity=.95*(1-u)+.12
    solarCoronaMaterial.opacity=.62*(1-u)+.10
    solarHaloMaterial.opacity=.38*(1-u)+.05
    solarCore.scale.setScalar(2.1+e*2.8)
    solarCorona.scale.setScalar(3.8+e*6.4)
    solarHalo.scale.setScalar(6.3+e*10.5)
  }else{
    birthPoint.visible=false
    const fade=Math.max(0,1-(t-3.85)/2.4)
    solarCoreMaterial.opacity=.12*fade
    solarCoronaMaterial.opacity=.10*fade
    solarHaloMaterial.opacity=.05*fade
    solarCore.scale.setScalar(4.9+2.2*(1-fade))
    solarCorona.scale.setScalar(10.2+4.2*(1-fade))
    solarHalo.scale.setScalar(16.8+6.2*(1-fade))
    birthLight.intensity=220*fade
    birthMarble.scale.setScalar(controls.TAILLE_BILLES)
  }
}


const bloomLayer=1
const bloomComposer=new EffectComposer(renderer)
bloomComposer.renderToScreen=false
bloomComposer.addPass(new RenderPass(scene,camera))
bloomComposer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),1.15,.28,0))
const finalComposer=new EffectComposer(renderer)
finalComposer.addPass(new RenderPass(scene,camera))
const mixPass=new ShaderPass(new THREE.ShaderMaterial({uniforms:{baseTexture:{value:null},bloomTexture:{value:bloomComposer.renderTarget2.texture}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D baseTexture;uniform sampler2D bloomTexture;varying vec2 vUv;void main(){gl_FragColor=texture2D(baseTexture,vUv)+texture2D(bloomTexture,vUv);}'}),'baseTexture')
mixPass.needsSwap=true
finalComposer.addPass(mixPass)
finalComposer.addPass(new OutputPass())

const controls={ECART:28,TAILLE_BILLES:.90,V1:.75,RELATION_GLOBALE:50,LIBERTE:.15,CHEVAUCHEMENT:1.45,ROTATION:.11,FREQUENCE_INVERSIONS:12,BRILLANCE:.62,INTENSITE_LUMIERE:2.25,LUMIERE_AMBIANTE:1,CAMERA:280,VOIR_CELLULES:false}
const personalityColors=[0xffe600,0xff6500,0xe5231f,0xa86a12,0x2468d8,0x7137c8,0x5146e5,0x28c95b,0xe95a9d,0x13bfc8]
const goldenAngle=Math.PI*(3-Math.sqrt(5))
const rnd=(a,b)=>THREE.MathUtils.lerp(a,b,Math.random())
function randomDirection(){return new THREE.Vector3(Math.random()*2-1,Math.random()*2-1,Math.random()*2-1).normalize()}
function shuffledAssignments(n,k){const a=Array.from({length:n},(_,i)=>i%k);for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function randomEncadredValue(t){if(Math.random()<.28)return Math.random()*100;return THREE.MathUtils.clamp(t+(((Math.random()+Math.random()+Math.random())/3)-.5)*90,0,100)}
function forceExactMean(v,t){const r=v.slice(),d=t*r.length;for(let p=0;p<30;p++){const x=d-r.reduce((s,n)=>s+n,0);if(Math.abs(x)<1e-9)break;const e=r.map((n,i)=>((x>0&&n<100)||(x<0&&n>0))?i:-1).filter(i=>i>=0);if(!e.length)break;for(const i of e)r[i]=THREE.MathUtils.clamp(r[i]+x/e.length,0,100)}return r}
function buildLevels(dom,a){const l=new Array(BODY_COUNT);for(let p=0;p<dom.length;p++){const ids=a.map((x,i)=>x===p?i:-1).filter(i=>i>=0),v=forceExactMean(ids.map(()=>randomEncadredValue(dom[p].level)),dom[p].level);ids.forEach((id,k)=>l[id]=v[k])}return l}
function fibonacciShell(count,radius,phase,rotation){const pts=[],q=new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x,rotation.y,rotation.z));for(let i=0;i<count;i++){const y=1-(i+.5)*(2/count),rr=Math.sqrt(Math.max(0,1-y*y)),theta=i*goldenAngle+phase,p=new THREE.Vector3(Math.cos(theta)*rr,y,Math.sin(theta)*rr).multiplyScalar(radius);p.applyQuaternion(q);pts.push(p)}return pts}
function makeBodyCenters(){const p=[new THREE.Vector3()];p.push(...fibonacciShell(12,.95,.18,new THREE.Vector3(.22,-.14,.31)),...fibonacciShell(32,1.58,1.07,new THREE.Vector3(-.31,.27,.11)),...fibonacciShell(56,2.18,2.16,new THREE.Vector3(.17,.39,-.26)),...fibonacciShell(99,2.82,2.91,new THREE.Vector3(-.21,-.28,.37)));return p}

const personality=personalityColors.map(color=>({color,level:50}))
const assignments=shuffledAssignments(BODY_COUNT,10)
const individualLevels=buildLevels(personality,assignments)
function personalityColor(i){const p=personality[assignments[i]],v=new THREE.Color(p.color),h={};v.getHSL(h);const x=individualLevels[i]/100,s=x<=.4?THREE.MathUtils.lerp(.62,.88,x/.4):THREE.MathUtils.lerp(.88,1,(x-.4)/.6);return new THREE.Color().setHSL(h.h,s,h.l)}
const allMarbleMaterials=[]
function personalityMaterial(i){const m=new THREE.MeshStandardMaterial({color:personalityColor(i),roughness:1-controls.BRILLANCE,metalness:.02,emissive:0x000000,emissiveIntensity:0});allMarbleMaterials.push(m);return m}

const fract=x=>x-Math.floor(x),hash=(x,y,z)=>fract(Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453)
function noise(x,y,z){const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),fx=x-X,fy=y-Y,fz=z-Z,s=t=>t*t*(3-2*t),sx=s(fx),sy=s(fy),sz=s(fz),h=(a,b,c)=>hash(X+a,Y+b,Z+c),a=THREE.MathUtils.lerp(h(0,0,0),h(1,0,0),sx),b=THREE.MathUtils.lerp(h(0,1,0),h(1,1,0),sx),c=THREE.MathUtils.lerp(h(0,0,1),h(1,0,1),sx),d=THREE.MathUtils.lerp(h(0,1,1),h(1,1,1),sx);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a,b,sy),THREE.MathUtils.lerp(c,d,sy),sz)*2-1}
function fbm(x,y,z,o=4){let v=0,a=.5,f=1;for(let i=0;i<o;i++){v+=a*noise(x*f,y*f,z*f);a*=.5;f*=2.03}return v}
function vor(x,y,z,s=4){x*=s;y*=s;z*=s;const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z);let d1=99,d2=99;for(let k=-1;k<=1;k++)for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const a=X+i,b=Y+j,c=Z+k,px=a+hash(a,b,c),py=b+hash(b,c,a),pz=c+hash(c,a,b),d=(x-px)**2+(y-py)**2+(z-pz)**2;if(d<d1){d2=d1;d1=d}else if(d<d2)d2=d}return[Math.sqrt(d1),Math.sqrt(d2)-Math.sqrt(d1)]}
function displaced(fn){const g=new THREE.SphereGeometry(1.02,144,108),p=g.attributes.position,n=new THREE.Vector3();for(let i=0;i<p.count;i++){n.set(p.getX(i),p.getY(i),p.getZ(i)).normalize();const d=fn(n);p.setXYZ(i,n.x*(1.02+d),n.y*(1.02+d),n.z*(1.02+d))}p.needsUpdate=true;g.computeVertexNormals();return g}
function fibDir(i,n){const y=1-(i/(n-1))*2,r=Math.sqrt(Math.max(0,1-y*y)),a=goldenAngle*i;return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r)}
function textureBase(i){return new THREE.Mesh(new THREE.SphereGeometry(1,64,48),personalityMaterial(i))}
function ballOn(g,d,i,r=.1,dist=1.04){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r,2),personalityMaterial(i));m.position.copy(d).multiplyScalar(dist);g.add(m)}
function coneOn(g,d,i,len=.42,r=.025){const m=new THREE.Mesh(new THREE.ConeGeometry(r,len,8),personalityMaterial(i));m.position.copy(d).multiplyScalar(1+len/2);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d);g.add(m)}
function makeFrozenTexture(kind,i){if(kind==='facets'){const m=personalityMaterial(i);m.flatShading=true;return new THREE.Mesh(new THREE.IcosahedronGeometry(1.14,3),m)}if(kind==='pompons'){const g=new THREE.Group();g.add(textureBase(i));for(let j=0;j<80;j++)ballOn(g,fibDir(j,80),i,.1+(j%3)*.018,1.04);return g}if(kind==='needles'){const g=new THREE.Group();g.add(textureBase(i));for(let j=0;j<120;j++)coneOn(g,fibDir(j,120),i,.43+(j%7)*.022,.023);return g}const g=displaced(n=>{const u=(Math.atan2(n.z,n.x)+Math.PI)/(2*Math.PI),v=Math.acos(n.y)/Math.PI;if(kind==='wave')return .045*Math.sin(Math.acos(n.y)*18+Math.atan2(n.z,n.x)*2);if(kind==='orange')return .018*fbm(n.x*18,n.y*18,n.z*18,3);if(kind==='stripes')return .035*Math.sin((Math.atan2(n.z,n.x)+Math.acos(n.y)*.3)*24);if(kind==='brick'){const row=Math.floor(v*10),uu=fract(u*14+(row%2)*.5),vv=fract(v*10);return(uu>.08&&uu<.92&&vv>.1&&vv<.9)?.045:-.035}if(kind==='bumps')return .045*Math.sin(n.x*13)*Math.sin(n.y*13)*Math.sin(n.z*13);if(kind==='waffle')return .045*Math.sin(u*Math.PI*24)*Math.sin(v*Math.PI*18);const a=fbm(n.x*4.8,n.y*4.8,n.z*4.8,3),b=vor(n.x,n.y,n.z,5)[0];return .04*Math.sin((a*2.2+b*3.2)*Math.PI*2)});return new THREE.Mesh(g,personalityMaterial(i))}
const tasteKinds=['wave','facets','orange','stripes','brick','bumps','waffle','turing','pompons','needles']
const tastes=tasteKinds.map(kind=>({level:50,kind}))
const tasteAssignments=shuffledAssignments(BODY_COUNT,10),textureByIndex=new Map()
for(let t=0;t<10;t++){const ids=tasteAssignments.map((a,i)=>a===t?i:-1).filter(i=>i>=0),count=Math.floor(ids.length*.5);for(let k=0;k<count;k++)textureByIndex.set(ids[k],tastes[t].kind)}

const opinions=Array.from({length:9},()=>({level:50}))
const opinionAssignments=shuffledAssignments(BODY_COUNT,9),opinionLevels=buildLevels(opinions,opinionAssignments)
function makeFlashTexture(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.12,'rgba(255,255,255,1)');g.addColorStop(.28,'rgba(255,255,255,.72)');g.addColorStop(.5,'rgba(255,255,255,.24)');g.addColorStop(.72,'rgba(255,255,255,.055)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(c);t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;return t}
const flashTexture=makeFlashTexture(),flashes=[]
function addDirectionalFlashes(o,i,kind){const level=opinionLevels[i]/100,max=1,radius=kind?1.10:6.18,baseSize=kind?.07:.42;for(let j=0;j<max;j++){const mat=new THREE.SpriteMaterial({map:flashTexture,color:0xffffff,transparent:true,opacity:0,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,toneMapped:false}),sp=new THREE.Sprite(mat);sp.layers.set(bloomLayer);sp.visible=false;o.add(sp);flashes.push({sp,o,level,radius,baseSize,normal:new THREE.Vector3(),wait:Math.random()*(2.6-2.1*level),age:99,duration:.045})}}
function fire(f){f.normal.copy(randomDirection());f.sp.position.copy(f.normal).multiplyScalar(f.radius);f.age=0;f.duration=.035+Math.random()*.045;const activity=.12+.88*f.level*f.level;f.wait=.12+Math.random()*(2.8-2.55*activity);f.sp.visible=true}

const centers=makeBodyCenters()
const homeSlots=Array.from({length:BODY_COUNT},(_,i)=>i)
const capacityIds=shuffledAssignments(BODY_COUNT,BODY_COUNT),capacityMask=new Array(BODY_COUNT).fill(false)
for(let i=0;i<Math.round(BODY_COUNT*CAPACITES);i++)capacityMask[capacityIds[i]]=true
const migrationByBead=new Map()
const transition={requested:false,serial:-1,state:'idle',nativeMigrationCaught:false,outAge:0,outDuration:3.6,returnAge:0,returnDuration:3.6}
const transitionStartWorld=new THREE.Vector3(),transitionCurrentWorld=new THREE.Vector3(),transitionTargetWorld=new THREE.Vector3(),transitionLocal=new THREE.Vector3(),transitionCamPos=new THREE.Vector3(),transitionCamDir=new THREE.Vector3(),transitionReturnStartWorld=new THREE.Vector3(),transitionReturnTargetWorld=new THREE.Vector3()
const marbleGeometry=new THREE.SphereGeometry(6,28,20),marbles=[],directions=[],travel=[],wanderTargets=[],wanderClocks=[],ownWorld=[]
for(let i=0;i<BODY_COUNT;i++){const kind=textureByIndex.get(i),o=kind?makeFrozenTexture(kind,i):new THREE.Mesh(marbleGeometry,personalityMaterial(i));o.userData.textureUnitScale=kind?6:1;o.userData.serialId=i;o.scale.setScalar(controls.TAILLE_BILLES*o.userData.textureUnitScale);o.traverse(x=>{if(x.isMesh){x.castShadow=true;x.receiveShadow=true}});addDirectionalFlashes(o,i,kind);entityGroup.add(o);marbles.push(o);directions.push(randomDirection());travel.push(new THREE.Vector3());wanderTargets.push(randomDirection());wanderClocks.push(Math.random()*2.5);ownWorld.push({axis:randomDirection(),variation:rnd(.85,1.15)})}
function startCapacitySwap(){const eligible=[];for(let i=0;i<BODY_COUNT;i++)if(capacityMask[i]&&!migrationByBead.has(i))eligible.push(i);if(eligible.length<2)return;const a=eligible[Math.floor(Math.random()*eligible.length)];let b=a;while(b===a)b=eligible[Math.floor(Math.random()*eligible.length)];const slotA=homeSlots[a],slotB=homeSlots[b],fromA=centers[slotA].clone().multiplyScalar(controls.ECART),fromB=centers[slotB].clone().multiplyScalar(controls.ECART),toA=centers[slotB].clone().multiplyScalar(controls.ECART),toB=centers[slotA].clone().multiplyScalar(controls.ECART);travel[a].set(0,0,0);travel[b].set(0,0,0);migrationByBead.set(a,{from:fromA,to:toA,age:0,duration:1.7+Math.random()*.8,targetSlot:slotB,delay:0});migrationByBead.set(b,{from:fromB,to:toB,age:0,duration:1.7+Math.random()*.8,targetSlot:slotA,delay:.9+Math.random()*1.6});if(transition.requested&&transition.state==='idle'){transition.requested=false;transition.serial=a;transition.state='native';transition.nativeMigrationCaught=true;window.parent?.postMessage({type:'ENTITY_NATIVE_MIGRATION_CAUGHT',serial:a},'*')}}
function worldToEntityLocal(world,out){entityGroup.updateMatrixWorld(true);out.copy(world);entityGroup.worldToLocal(out);return out}
function updateMigration(i,dt){const m=migrationByBead.get(i);if(!m)return false;if(i===transition.serial&&transition.state==='outbound'){transition.outAge+=dt;camera.updateMatrixWorld(true);camera.getWorldPosition(transitionCamPos);camera.getWorldDirection(transitionCamDir);transitionTargetWorld.copy(transitionCamPos).addScaledVector(transitionCamDir,7.4);const t=Math.min(1,transition.outAge/transition.outDuration),s=t*t*(3-2*t);transitionCurrentWorld.copy(transitionStartWorld).lerp(transitionTargetWorld,s);marbles[i].position.copy(worldToEntityLocal(transitionCurrentWorld,transitionLocal));if(t>=1){transition.state='covered';window.parent?.postMessage({type:'ENTITY_TRANSITION_FULL',serial:i},'*')}return true}if(i===transition.serial&&transition.state==='returning'){transition.returnAge+=dt;const t=Math.min(1,transition.returnAge/transition.returnDuration),s=t*t*(3-2*t);transitionCurrentWorld.copy(transitionReturnStartWorld).lerp(transitionReturnTargetWorld,s);marbles[i].position.copy(worldToEntityLocal(transitionCurrentWorld,transitionLocal));if(t>=1){transition.state='done';marbles[i].visible=false;window.parent?.postMessage({type:'ENTITY_TRANSITION_DONE',serial:i},'*')}return true}if(m.delay>0){m.delay-=dt;return true}m.age+=dt;const t=Math.min(1,m.age/m.duration),s=t*t*(3-2*t),arc=Math.sin(Math.PI*t)*controls.ECART*.12,mid=m.from.clone().lerp(m.to,s),side=new THREE.Vector3().crossVectors(m.from,m.to);if(side.lengthSq()<1e-6)side.set(0,1,0);side.normalize().multiplyScalar(arc);marbles[i].position.copy(mid.add(side));if(i===transition.serial&&transition.state==='native'&&t>=.25){entityGroup.updateMatrixWorld(true);marbles[i].updateWorldMatrix(true,false);marbles[i].getWorldPosition(transitionStartWorld);transition.outAge=0;transition.state='outbound';window.parent?.postMessage({type:'ENTITY_TRANSITION_BEAD',serial:i},'*');return true}if(t>=1){homeSlots[i]=m.targetSlot;travel[i].set(0,0,0);directions[i].copy(randomDirection());wanderTargets[i].copy(randomDirection());wanderClocks[i]=.8+Math.random()*2.4;migrationByBead.delete(i)}return true}
window.entityTransitionAPI={request(){if(transition.state!=='idle')return false;transition.requested=true;transition.nativeMigrationCaught=false;return true},returnToTarget(target){if(transition.state!=='covered'||transition.serial<0)return false;const bead=marbles[transition.serial];entityGroup.updateMatrixWorld(true);bead.updateWorldMatrix(true,false);bead.getWorldPosition(transitionReturnStartWorld);camera.updateMatrixWorld(true);camera.getWorldPosition(transitionCamPos);const ndc=new THREE.Vector3(target.x,target.y,0).unproject(camera),dir=ndc.sub(transitionCamPos).normalize();transitionReturnTargetWorld.copy(transitionCamPos).addScaledVector(dir,210);transition.returnAge=0;transition.state='returning';return true},state(){return{state:transition.state,serial:transition.serial,transitionRequested:transition.requested,nativeMigrationCaught:transition.nativeMigrationCaught}}}
window.parent?.postMessage({type:'ENTITY_TRANSITION_READY'},'*')

const satelliteGroup=new THREE.Group();scene.add(satelliteGroup);const satellites=[],satelliteData=[{radius:103,speed:.19,phase:.40,tiltX:.55,tiltZ:.18},{radius:112,speed:-.14,phase:1.70,tiltX:-.38,tiltZ:.72},{radius:98,speed:.23,phase:2.95,tiltX:.22,tiltZ:-.61},{radius:108,speed:-.17,phase:4.15,tiltX:.68,tiltZ:-.27},{radius:101,speed:.15,phase:5.45,tiltX:-.52,tiltZ:-.76}];for(let i=0;i<SATELLITE_COUNT;i++){const m=new THREE.Mesh(marbleGeometry,personalityMaterial(i));m.scale.setScalar(controls.TAILLE_BILLES);m.castShadow=m.receiveShadow=true;satelliteGroup.add(m);satellites.push(m)}
const ambientLight=new THREE.HemisphereLight(0xffffff,0x30343b,controls.LUMIERE_AMBIANTE);scene.add(ambientLight);const cameraLight=new THREE.SpotLight(0xffffff,controls.INTENSITE_LUMIERE,0,Math.PI/3.2,.55,0);cameraLight.position.set(42,28,350);cameraLight.castShadow=true;cameraLight.shadow.mapSize.set(1024,1024);cameraLight.shadow.camera.near=1;cameraLight.shadow.camera.far=700;cameraLight.shadow.bias=-.00035;cameraLight.shadow.normalBias=.015;scene.add(cameraLight)

const cellGroup=new THREE.Group();cellGroup.visible=controls.VOIR_CELLULES;entityGroup.add(cellGroup)
const cellGeometry=new THREE.SphereGeometry(1,16,12),cellMaterial=new THREE.MeshBasicMaterial({color:0x7f8792,wireframe:true,transparent:true,opacity:.16,depthWrite:false})
const cells=[];for(let i=0;i<BODY_COUNT;i++){const c=new THREE.Mesh(cellGeometry,cellMaterial);cellGroup.add(c);cells.push(c)}
function updateCells(){const r=controls.ECART*controls.LIBERTE*controls.CHEVAUCHEMENT;for(let i=0;i<BODY_COUNT;i++){cells[i].position.copy(centers[homeSlots[i]]).multiplyScalar(controls.ECART);cells[i].scale.setScalar(r)}}

function makeHistoryHaloTexture(){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(128,128,0,128,128,128);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.60,'rgba(255,255,255,0)');g.addColorStop(.66,'rgba(255,255,255,.30)');g.addColorStop(.76,'rgba(255,255,255,.16)');g.addColorStop(.88,'rgba(255,255,255,.06)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,256,256);const t=new THREE.CanvasTexture(c);t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;return t}
const haloTexture=makeHistoryHaloTexture(),historyIds=shuffledAssignments(BODY_COUNT,BODY_COUNT)
for(let h=0;h<Math.round(BODY_COUNT*LEVEL);h++){const i=historyIds[h],o=marbles[i],halo=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTexture,color:personalityColor(i),transparent:true,opacity:.72,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,toneMapped:false}));halo.scale.setScalar(19.2/(o.userData.textureUnitScale||1));halo.renderOrder=0;o.add(halo)}

const speedVariations=Array.from({length:BODY_COUNT},()=>rnd(.8,1.2)),svm=1/(speedVariations.reduce((s,v)=>s+v,0)/BODY_COUNT);for(let i=0;i<BODY_COUNT;i++)speedVariations[i]*=svm
const KNOWLEDGE_LEVEL=.50,KNOWLEDGE_ON=2.5,KNOWLEDGE_OFF_MIN=5,KNOWLEDGE_OFF_MAX=9,AFTERIMAGE_LIFE=3,AFTERIMAGE_SPACING=.42,AFTERIMAGE_SIZE=9.4,AFTERIMAGE_ALPHA=.27,AFTERIMAGE_PER_BEAD=220,AFTERIMAGE_CAPACITY=BODY_COUNT*AFTERIMAGE_PER_BEAD
const knowledgeOffBase=()=>THREE.MathUtils.lerp(KNOWLEDGE_OFF_MAX,KNOWLEDGE_OFF_MIN,KNOWLEDGE_LEVEL),nextKnowledgeOff=()=>knowledgeOffBase()*rnd(.72,1.28)
const afterPositions=new Float32Array(AFTERIMAGE_CAPACITY*3),afterColors=new Float32Array(AFTERIMAGE_CAPACITY*3),afterSizes=new Float32Array(AFTERIMAGE_CAPACITY),afterAlphas=new Float32Array(AFTERIMAGE_CAPACITY),afterAges=new Float32Array(AFTERIMAGE_CAPACITY),afterLives=new Float32Array(AFTERIMAGE_CAPACITY),afterAlive=new Uint8Array(AFTERIMAGE_CAPACITY),afterHeads=new Uint16Array(BODY_COUNT),knowledgeStates=[],prevKnowledgeWorld=[],trailWorld=new THREE.Vector3(),trailPrev=new THREE.Vector3(),trailEmitPos=new THREE.Vector3()
const afterBase=new THREE.PlaneGeometry(1,1),afterGeometry=new THREE.InstancedBufferGeometry();afterGeometry.index=afterBase.index;afterGeometry.setAttribute('position',afterBase.attributes.position);afterGeometry.setAttribute('uv',afterBase.attributes.uv);afterGeometry.setAttribute('iPos',new THREE.InstancedBufferAttribute(afterPositions,3));afterGeometry.setAttribute('iColor',new THREE.InstancedBufferAttribute(afterColors,3));afterGeometry.setAttribute('iSize',new THREE.InstancedBufferAttribute(afterSizes,1));afterGeometry.setAttribute('iAlpha',new THREE.InstancedBufferAttribute(afterAlphas,1));afterGeometry.instanceCount=AFTERIMAGE_CAPACITY
const afterMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,depthFunc:THREE.LessDepth,toneMapped:false,blending:THREE.NormalBlending,vertexShader:'attribute vec3 iPos;attribute vec3 iColor;attribute float iSize;attribute float iAlpha;varying vec2 vUv;varying vec3 vColor;varying float vAlpha;void main(){vUv=uv;vColor=iColor;vAlpha=iAlpha;vec4 center=modelViewMatrix*vec4(iPos,1.0);center.xy+=position.xy*iSize;gl_Position=projectionMatrix*center;}',fragmentShader:'varying vec2 vUv;varying vec3 vColor;varying float vAlpha;void main(){float d=length(vUv-.5);float body=1.0-smoothstep(.05,.46,d);float feather=1.0-smoothstep(.25,.52,d);float a=(body*.66+feather*.34)*vAlpha;if(a<.004)discard;gl_FragColor=vec4(vColor,a);}'});const afterMesh=new THREE.Mesh(afterGeometry,afterMaterial);afterMesh.frustumCulled=false;afterMesh.renderOrder=2;scene.add(afterMesh)
for(let i=0;i<BODY_COUNT;i++){const offDuration=nextKnowledgeOff();prevKnowledgeWorld.push(new THREE.Vector3());knowledgeStates.push({active:false,phase:Math.random()*offDuration,offDuration})}
function emitAfterimage(i,p){const slot=i*AFTERIMAGE_PER_BEAD+afterHeads[i];afterHeads[i]=(afterHeads[i]+1)%AFTERIMAGE_PER_BEAD;const o=slot*3,c=personalityColor(i);afterPositions[o]=p.x;afterPositions[o+1]=p.y;afterPositions[o+2]=p.z;afterColors[o]=c.r;afterColors[o+1]=c.g;afterColors[o+2]=c.b;afterSizes[slot]=AFTERIMAGE_SIZE;afterAlphas[slot]=AFTERIMAGE_ALPHA;afterAges[slot]=0;afterLives[slot]=AFTERIMAGE_LIFE;afterAlive[slot]=1}
function updateAfterimages(dt){for(let s=0;s<AFTERIMAGE_CAPACITY;s++){if(!afterAlive[s])continue;afterAges[s]+=dt;if(afterAges[s]>=afterLives[s]){afterAlive[s]=0;afterAlphas[s]=0;continue}const u=afterAges[s]/afterLives[s];afterAlphas[s]=AFTERIMAGE_ALPHA*Math.pow(1-u,1.42);afterSizes[s]=AFTERIMAGE_SIZE*(1-.06*u)}afterGeometry.attributes.iPos.needsUpdate=true;afterGeometry.attributes.iColor.needsUpdate=true;afterGeometry.attributes.iSize.needsUpdate=true;afterGeometry.attributes.iAlpha.needsUpdate=true}
function updateKnowledgeTrails(dt){updateAfterimages(dt);for(let i=0;i<BODY_COUNT;i++){const s=knowledgeStates[i];marbles[i].getWorldPosition(trailWorld);trailPrev.copy(prevKnowledgeWorld[i]);const dist=trailWorld.distanceTo(trailPrev);s.phase+=dt;if(s.active&&s.phase>=KNOWLEDGE_ON){s.active=false;s.phase=0;s.offDuration=nextKnowledgeOff()}else if(!s.active&&s.phase>=s.offDuration){s.active=true;s.phase=0}if(s.active&&dist>.001){const n=Math.max(1,Math.ceil(dist/AFTERIMAGE_SPACING));for(let k=0;k<n;k++){trailEmitPos.copy(trailPrev).lerp(trailWorld,k/n);emitAfterimage(i,trailEmitPos)}}prevKnowledgeWorld[i].copy(trailWorld)}}

function updateLayout(){for(let i=0;i<BODY_COUNT;i++){marbles[i].scale.setScalar(controls.TAILLE_BILLES*marbles[i].userData.textureUnitScale);if(!migrationByBead.has(i))marbles[i].position.copy(centers[homeSlots[i]]).multiplyScalar(controls.ECART).add(travel[i])}for(const s of satellites)s.scale.setScalar(controls.TAILLE_BILLES);updateCells()}
updateLayout();entityGroup.updateMatrixWorld(true);for(let i=0;i<BODY_COUNT;i++)marbles[i].getWorldPosition(prevKnowledgeWorld[i])

const gui=new GUI({title:'ENTITY — NIVEAU MOYEN 50 %'});gui.add(controls,'RELATION_GLOBALE',0,100,1);gui.add(controls,'V1',0,5,.01);gui.add(controls,'ROTATION',0,2,.01);gui.add(controls,'FREQUENCE_INVERSIONS',0,12,.1);gui.add(controls,'BRILLANCE',0,1,.01).onChange(v=>allMarbleMaterials.forEach(m=>m.roughness=1-v));gui.add(controls,'INTENSITE_LUMIERE',0,8,.05).onChange(v=>cameraLight.intensity=v);gui.add(controls,'LUMIERE_AMBIANTE',0,4,.05).onChange(v=>ambientLight.intensity=v);gui.add(controls,'LIBERTE',0,.5,.01).onChange(updateCells);gui.add(controls,'CHEVAUCHEMENT',.5,2,.01).onChange(updateCells);gui.add(controls,'VOIR_CELLULES').onChange(v=>cellGroup.visible=v);gui.add(controls,'CAMERA',250,800,10).onChange(v=>camera.position.z=v)
const label=document.createElement('div');label.textContent='ENTITY — 50 % sur les 8 domaines · mouvement cellule + réorganisation + halo + scintillements + connaissances';Object.assign(label.style,{position:'fixed',left:'14px',bottom:'12px',color:'#aaa',font:'12px Arial'});document.body.appendChild(label)

const clock=new THREE.Clock(),inward=new THREE.Vector3(),steer=new THREE.Vector3(),worldN=new THREE.Vector3(),worldP=new THREE.Vector3(),toCamera=new THREE.Vector3(),axis=randomDirection(),dq=new THREE.Quaternion(),baseBackground=scene.background.clone(),bloomBackground=new THREE.Color(0x000000);let elapsed=0,sense=1,nextCapacityMove=4.5+Math.random()*5.5
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);elapsed+=dt;updateNewMarbleBirth(performance.now()/1000);nextCapacityMove-=dt;if(nextCapacityMove<=0){startCapacitySwap();nextCapacityMove=4.5+Math.random()*5.5}for(const f of flashes){if(f.age<f.duration){f.age+=dt;f.o.getWorldQuaternion(dq);worldN.copy(f.normal).applyQuaternion(dq).normalize();f.sp.getWorldPosition(worldP);toCamera.copy(camera.position).sub(worldP).normalize();const facing=Math.max(0,worldN.dot(toCamera)),t=Math.min(1,f.age/f.duration),pulse=Math.pow(Math.sin(Math.PI*t),.22),visibility=Math.pow(facing,1.8);f.sp.material.opacity=Math.min(1,pulse*visibility*2.8);f.sp.scale.setScalar(f.baseSize*(1.1+6.2*pulse)*(.35+.65*visibility));if(f.age>=f.duration)f.sp.visible=false}else{f.wait-=dt;if(f.wait<=0)fire(f)}}const maxR=controls.ECART*controls.LIBERTE*controls.CHEVAUCHEMENT,gs=controls.V1*controls.ECART*.42*(1+controls.RELATION_GLOBALE/100);for(let i=0;i<BODY_COUNT;i++){if(updateMigration(i,dt))continue;wanderClocks[i]-=dt;if(wanderClocks[i]<=0){wanderClocks[i]=.8+Math.random()*2.4;wanderTargets[i]=randomDirection()}const d=travel[i].length(),ret=maxR>0?THREE.MathUtils.smoothstep(d/maxR,.55,1):1;inward.copy(travel[i]);if(inward.lengthSq()>0)inward.normalize().multiplyScalar(-1);steer.copy(wanderTargets[i]).multiplyScalar(.3).addScaledVector(inward,ret*1.55);directions[i].addScaledVector(steer,dt).normalize();travel[i].addScaledVector(directions[i],gs*speedVariations[i]*dt);if(maxR<=0){travel[i].set(0,0,0)}else if(travel[i].length()>maxR*.985){const normal=travel[i].clone().normalize(),outward=directions[i].dot(normal);if(outward>0){directions[i].addScaledVector(normal,-2*outward);directions[i].addScaledVector(randomDirection(),.12);directions[i].normalize()}else directions[i].addScaledVector(normal,-.18).normalize();travel[i].setLength(maxR*.955)}marbles[i].position.copy(centers[homeSlots[i]]).multiplyScalar(controls.ECART).add(travel[i]);const ow=ownWorld[i];marbles[i].rotateOnAxis(ow.axis,6*LEVEL*ow.variation*dt)}if(Math.random()<1-Math.exp(-(controls.FREQUENCE_INVERSIONS/60)*dt))sense*=-1;entityGroup.rotateOnWorldAxis(axis,controls.ROTATION*sense*dt);entityGroup.updateMatrixWorld(true);updateKnowledgeTrails(dt);for(let i=0;i<SATELLITE_COUNT;i++){const s=satelliteData[i],a=s.phase+elapsed*s.speed,p=new THREE.Vector3(Math.cos(a)*s.radius,0,Math.sin(a)*s.radius).applyEuler(new THREE.Euler(s.tiltX,0,s.tiltZ));satellites[i].position.copy(p)}scene.background=bloomBackground;camera.layers.set(bloomLayer);bloomComposer.render(dt);scene.background=(transition.state==='returning'||transition.state==='done')?null:baseBackground;camera.layers.set(0);camera.layers.enable(bloomLayer);finalComposer.render(dt);camera.layers.set(0)}animate()
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);bloomComposer.setSize(innerWidth,innerHeight);finalComposer.setSize(innerWidth,innerHeight)})