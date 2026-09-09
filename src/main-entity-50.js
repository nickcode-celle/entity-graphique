import * as THREE from 'three'
import GUI from 'lil-gui'
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js'
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js'
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js'
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js'
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js'
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import './style.css'

const TEST_COUNTS=[300,500,750,760,775,800,875,1000,1500,2000];const requestedCount=Number(new URLSearchParams(location.search).get('balls'));const BODY_COUNT=TEST_COUNTS.includes(requestedCount)?requestedCount:1500,SATELLITE_COUNT=5,LEVEL=.50,CAPACITES=.50
const app=document.querySelector('#app'),renderer=new THREE.WebGLRenderer({antialias:true,alpha:true})
renderer.setPixelRatio(Math.min(devicePixelRatio,2))
renderer.setSize(innerWidth,innerHeight)
renderer.shadowMap.enabled=true
renderer.shadowMap.type=THREE.PCFSoftShadowMap
renderer.toneMapping=THREE.ACESFilmicToneMapping
app.appendChild(renderer.domElement)
const emaeGoldPMREM=new THREE.PMREMGenerator(renderer)
const emaeGoldEnv=emaeGoldPMREM.fromScene(new RoomEnvironment(),.04).texture
emaeGoldPMREM.dispose()

const scene=new THREE.Scene()
scene.background=new THREE.Color(0x1d1f22)
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,3000)
camera.position.z=280
const entityGroup=new THREE.Group()
scene.add(entityGroup)

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
const passProfile={bloomRender:0,bloomEffect:0,finalRender:0,finalMix:0,finalOutput:0,finalCalls:0,finalTriangles:0,samples:0,last:performance.now()};function measurePass(pass,key){const original=pass.render.bind(pass);pass.render=function(...args){const t=performance.now();const result=original(...args);passProfile[key]+=performance.now()-t;if(key==='finalRender'){passProfile.finalCalls+=renderer.info.render.calls;passProfile.finalTriangles+=renderer.info.render.triangles}return result}}measurePass(bloomComposer.passes[0],'bloomRender');measurePass(bloomComposer.passes[1],'bloomEffect');measurePass(finalComposer.passes[0],'finalRender');measurePass(finalComposer.passes[1],'finalMix');measurePass(finalComposer.passes[2],'finalOutput');const passProfileLabel=document.createElement('div');Object.assign(passProfileLabel.style,{position:'fixed',right:'14px',top:'150px',zIndex:9999,color:'#fff',background:'rgba(0,0,0,.68)',padding:'8px 10px',font:'12px/1.45 monospace',whiteSpace:'pre',pointerEvents:'none'});document.body.appendChild(passProfileLabel);setInterval(()=>{const n=Math.max(1,passProfile.samples);passProfileLabel.textContent='RENDER PASSES\nbloom scene '+(passProfile.bloomRender/n).toFixed(2)+' ms\nbloom effect '+(passProfile.bloomEffect/n).toFixed(2)+' ms\nfinal scene '+(passProfile.finalRender/n).toFixed(2)+' ms\nmix '+(passProfile.finalMix/n).toFixed(2)+' ms\noutput '+(passProfile.finalOutput/n).toFixed(2)+' ms\nfinal calls '+Math.round(passProfile.finalCalls/n)+'\nfinal triangles '+Math.round(passProfile.finalTriangles/n).toLocaleString();passProfile.bloomRender=passProfile.bloomEffect=passProfile.finalRender=passProfile.finalMix=passProfile.finalOutput=passProfile.finalCalls=passProfile.finalTriangles=0;passProfile.samples=0},1000);

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
function makeBodyCenters(){
  const populationScale=Math.cbrt(BODY_COUNT/200),p=[new THREE.Vector3()]
  const counts=[.06,.16,.28,.50].map(x=>Math.floor((BODY_COUNT-1)*x))
  counts[3]=BODY_COUNT-1-counts[0]-counts[1]-counts[2]
  p.push(
    ...fibonacciShell(counts[0],.95*populationScale,.18,new THREE.Vector3(.22,-.14,.31)),
    ...fibonacciShell(counts[1],1.58*populationScale,1.07,new THREE.Vector3(-.31,.27,.11)),
    ...fibonacciShell(counts[2],2.18*populationScale,2.16,new THREE.Vector3(.17,.39,-.26)),
    ...fibonacciShell(counts[3],2.82*populationScale,2.91,new THREE.Vector3(-.21,-.28,.37))
  )
  return p
}
function makeEmaeLogoCenters(){
  const pts=[]
  function halton(i,b){let f=1,r=0;while(i>0){f/=b;r+=f*(i%b);i=Math.floor(i/b)}return r}
  function insidePolygon(x,y,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))c=!c}return c}
  function fillPolygon(count,poly,offset){
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity
    for(const p of poly){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1])}
    let k=1+offset
    while(pts.length<count+offset){
      const x=minX+(maxX-minX)*halton(k,2),y=minY+(maxY-minY)*halton(k,3)
      if(insidePolygon(x,y,poly))pts.push(new THREE.Vector3(x,y,0))
      k++
    }
  }
  function addDot(count,cx,cy,offset){
    for(let i=0;i<count;i++){
      const k=i+1+offset,a=halton(k,2)*Math.PI*2,r=.34*Math.sqrt(halton(k,3))
      pts.push(new THREE.Vector3(cx+Math.cos(a)*r,cy+Math.sin(a)*r,0))
    }
  }
  const left=[[-1.95,-1.78],[-2.08,-1.42],[-2.03,-.98],[-1.85,-.50],[-1.64,.02],[-1.38,.54],[-1.08,1.02],[-.82,1.47],[-.62,1.78],[-.48,1.88],[-.38,1.78],[-.39,1.54],[-.52,1.20],[-.72,.82],[-.91,.42],[-1.06,.03],[-1.12,-.36],[-1.08,-.76],[-1.02,-1.13],[-1.08,-1.48],[-1.27,-1.78],[-1.58,-1.94],[-1.82,-1.91]]
  const right=left.map(([x,y])=>[-x,y])
  const dotEach=Math.round(12*BODY_COUNT/300),branchEach=(BODY_COUNT-dotEach*2)/2
  if(!Number.isInteger(branchEach))throw new Error('EMAE branch count must be integer')
  fillPolygon(branchEach,left,0)
  const leftCount=pts.length
  if(leftCount!==branchEach)throw new Error('EMAE left branch count mismatch: '+leftCount)
  const rightStart=pts.length
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity
  for(const q of right){minX=Math.min(minX,q[0]);maxX=Math.max(maxX,q[0]);minY=Math.min(minY,q[1]);maxY=Math.max(maxY,q[1])}
  let k=10001
  while(pts.length<rightStart+branchEach){const x=minX+(maxX-minX)*halton(k,2),y=minY+(maxY-minY)*halton(k,3);if(insidePolygon(x,y,right))pts.push(new THREE.Vector3(x,y,0));k++}
  addDot(dotEach,-.58,2.64,20000)
  addDot(dotEach,.58,2.64,30000)
  if(pts.length!==BODY_COUNT)throw new Error('EMAE symbol skeleton count mismatch: '+pts.length+' / '+BODY_COUNT)
  return pts
}

const personality=personalityColors.map(color=>({color,level:50}))
const assignments=shuffledAssignments(BODY_COUNT,10)
const individualLevels=buildLevels(personality,assignments)
function personalityColor(i){const p=personality[assignments[i]],v=new THREE.Color(p.color),h={};v.getHSL(h);const x=individualLevels[i]/100,s=x<=.4?THREE.MathUtils.lerp(.62,.88,x/.4):THREE.MathUtils.lerp(.88,1,(x-.4)/.6);return new THREE.Color().setHSL(h.h,s,h.l)}
const allMarbleMaterials=[],personalityMaterialCache=new Map()
function personalityMaterial(i){if(personalityMaterialCache.has(i))return personalityMaterialCache.get(i);const m=new THREE.MeshStandardMaterial({color:personalityColor(i),roughness:1-controls.BRILLANCE,metalness:.02,emissive:0x000000,emissiveIntensity:0});allMarbleMaterials.push(m);personalityMaterialCache.set(i,m);return m}

let marbleRenderBatches=null
function initMarbleRenderBatches(){
  const buckets=new Map(),records=[]
  for(let i=0;i<marbles.length;i++){
    const o=marbles[i]
    if(!o?.isMesh||!o.geometry||!o.material||Array.isArray(o.material))throw new Error('ENTITY batching requires each marble root to remain one Mesh')
    const attrs=Object.keys(o.geometry.attributes).sort().join(',')
    const key=(o.geometry.index?'indexed':'nonindexed')+'|'+(o.material.flatShading?'flat':'smooth')+'|'+attrs
    if(!buckets.has(key))buckets.set(key,[])
    buckets.get(key).push({o,i})
  }
  for(const items of buckets.values()){
    const geometries=[...new Set(items.map(x=>x.o.geometry))]
    const maxVertices=geometries.reduce((n,g)=>n+g.attributes.position.count,0)
    const maxIndices=geometries.reduce((n,g)=>n+(g.index?g.index.count:0),0)
    const sourceMaterial=items[0].o.material
    const material=sourceMaterial.clone()
    material.color.set(0xffffff)
    material.visible=true
    allMarbleMaterials.push(material)
    const batch=new THREE.BatchedMesh(items.length,maxVertices,Math.max(maxIndices,maxVertices*2),material)
    batch.castShadow=true
    batch.receiveShadow=true
    batch.frustumCulled=false
    batch.perObjectFrustumCulled=true
    const geometryIds=new Map()
    for(const g of geometries)geometryIds.set(g,batch.addGeometry(g))
    entityGroup.add(batch)
    for(const item of items){
      const id=batch.addInstance(geometryIds.get(item.o.geometry))
      batch.setColorAt(id,item.o.material.color)
      item.o.userData.renderBatch=batch
      item.o.userData.renderBatchId=id
      item.o.userData.renderBatchColor=item.o.material.color.getHex()
      item.o.material.visible=false
      records.push(item.o)
    }
  }
  marbleRenderBatches=records
}
function syncMarbleRenderBatches(){
  if(!marbleRenderBatches)initMarbleRenderBatches()
  for(const o of marbleRenderBatches){
    o.updateMatrix()
    const batch=o.userData.renderBatch,id=o.userData.renderBatchId
    batch.setMatrixAt(id,o.matrix)
    batch.setVisibleAt(id,o.visible)
    const hex=o.material.color.getHex()
    if(hex!==o.userData.renderBatchColor){batch.setColorAt(id,o.material.color);o.userData.renderBatchColor=hex}
  }
}


const fract=x=>x-Math.floor(x),hash=(x,y,z)=>fract(Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453)
function noise(x,y,z){const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),fx=x-X,fy=y-Y,fz=z-Z,s=t=>t*t*(3-2*t),sx=s(fx),sy=s(fy),sz=s(fz),h=(a,b,c)=>hash(X+a,Y+b,Z+c),a=THREE.MathUtils.lerp(h(0,0,0),h(1,0,0),sx),b=THREE.MathUtils.lerp(h(0,1,0),h(1,1,0),sx),c=THREE.MathUtils.lerp(h(0,0,1),h(1,0,1),sx),d=THREE.MathUtils.lerp(h(0,1,1),h(1,1,1),sx);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a,b,sy),THREE.MathUtils.lerp(c,d,sy),sz)*2-1}
function fbm(x,y,z,o=4){let v=0,a=.5,f=1;for(let i=0;i<o;i++){v+=a*noise(x*f,y*f,z*f);a*=.5;f*=2.03}return v}
function vor(x,y,z,s=4){x*=s;y*=s;z*=s;const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z);let d1=99,d2=99;for(let k=-1;k<=1;k++)for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const a=X+i,b=Y+j,c=Z+k,px=a+hash(a,b,c),py=b+hash(b,c,a),pz=c+hash(c,a,b),d=(x-px)**2+(y-py)**2+(z-pz)**2;if(d<d1){d2=d1;d1=d}else if(d<d2)d2=d}return[Math.sqrt(d1),Math.sqrt(d2)-Math.sqrt(d1)]}
function displaced(fn){const g=new THREE.SphereGeometry(1.02,144,108),p=g.attributes.position,n=new THREE.Vector3();for(let i=0;i<p.count;i++){n.set(p.getX(i),p.getY(i),p.getZ(i)).normalize();const d=fn(n);p.setXYZ(i,n.x*(1.02+d),n.y*(1.02+d),n.z*(1.02+d))}p.needsUpdate=true;g.computeVertexNormals();return g}
function fibDir(i,n){const y=1-(i/(n-1))*2,r=Math.sqrt(Math.max(0,1-y*y)),a=goldenAngle*i;return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r)}
const textureBaseGeometry=new THREE.SphereGeometry(1,64,48),ballGeometryCache=new Map(),coneGeometryCache=new Map()
function textureBase(i){return new THREE.Mesh(textureBaseGeometry,personalityMaterial(i))}
function ballOn(g,d,i,r=.1,dist=1.04){const key=r.toFixed(6);let geometry=ballGeometryCache.get(key);if(!geometry){geometry=new THREE.IcosahedronGeometry(r,2);ballGeometryCache.set(key,geometry)}const m=new THREE.Mesh(geometry,personalityMaterial(i));m.position.copy(d).multiplyScalar(dist);g.add(m)}
function coneOn(g,d,i,len=.42,r=.025){const key=len.toFixed(6)+'/'+r.toFixed(6);let geometry=coneGeometryCache.get(key);if(!geometry){geometry=new THREE.ConeGeometry(r,len,8);coneGeometryCache.set(key,geometry)}const m=new THREE.Mesh(geometry,personalityMaterial(i));m.position.copy(d).multiplyScalar(1+len/2);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d);g.add(m)}
const facetsGeometry=new THREE.IcosahedronGeometry(1.14,3),displacedGeometryCache=new Map()
function mergeCompatible(parts){const normalized=parts.map(src=>{const g=src.clone().toNonIndexed();for(const name of Object.keys(g.attributes)){if(name!=='position'&&name!=='normal'&&name!=='uv')g.deleteAttribute(name)}return g});return mergeGeometries(normalized,false)}
function mergedPomponsGeometry(){const parts=[textureBaseGeometry];for(let j=0;j<80;j++){const d=fibDir(j,80),r=.1+(j%3)*.018,key=r.toFixed(6);let geometry=ballGeometryCache.get(key);if(!geometry){geometry=new THREE.IcosahedronGeometry(r,2);ballGeometryCache.set(key,geometry)}const c=geometry.clone();c.translate(d.x*1.04,d.y*1.04,d.z*1.04);parts.push(c)}return mergeCompatible(parts)}
function mergedNeedlesGeometry(){const parts=[textureBaseGeometry],up=new THREE.Vector3(0,1,0),m=new THREE.Matrix4(),q=new THREE.Quaternion(),pos=new THREE.Vector3(),scale=new THREE.Vector3(1,1,1);for(let j=0;j<120;j++){const d=fibDir(j,120),len=.43+(j%7)*.022,r=.023,key=len.toFixed(6)+'/'+r.toFixed(6);let geometry=coneGeometryCache.get(key);if(!geometry){geometry=new THREE.ConeGeometry(r,len,8);coneGeometryCache.set(key,geometry)}q.setFromUnitVectors(up,d);pos.copy(d).multiplyScalar(1+len/2);m.compose(pos,q,scale);const c=geometry.clone();c.applyMatrix4(m);parts.push(c)}return mergeCompatible(parts)}
const pomponsMergedGeometry=mergedPomponsGeometry(),needlesMergedGeometry=mergedNeedlesGeometry()
function makeFrozenTexture(kind,i){if(kind==='facets'){const m=personalityMaterial(i);m.flatShading=true;return new THREE.Mesh(facetsGeometry,m)}if(kind==='pompons')return new THREE.Mesh(pomponsMergedGeometry,personalityMaterial(i));if(kind==='needles')return new THREE.Mesh(needlesMergedGeometry,personalityMaterial(i));let g=displacedGeometryCache.get(kind);if(!g){g=displaced(n=>{const u=(Math.atan2(n.z,n.x)+Math.PI)/(2*Math.PI),v=Math.acos(n.y)/Math.PI;if(kind==='wave')return .045*Math.sin(Math.acos(n.y)*18+Math.atan2(n.z,n.x)*2);if(kind==='orange')return .018*fbm(n.x*18,n.y*18,n.z*18,3);if(kind==='stripes')return .035*Math.sin((Math.atan2(n.z,n.x)+Math.acos(n.y)*.3)*24);if(kind==='brick'){const row=Math.floor(v*10),uu=fract(u*14+(row%2)*.5),vv=fract(v*10);return(uu>.08&&uu<.92&&vv>.1&&vv<.9)?.045:-.035}if(kind==='bumps')return .045*Math.sin(n.x*13)*Math.sin(n.y*13)*Math.sin(n.z*13);if(kind==='waffle')return .045*Math.sin(u*Math.PI*24)*Math.sin(v*Math.PI*18);const a=fbm(n.x*4.8,n.y*4.8,n.z*4.8,3),b=vor(n.x,n.y,n.z,5)[0];return .04*Math.sin((a*2.2+b*3.2)*Math.PI*2)});displacedGeometryCache.set(kind,g)}return new THREE.Mesh(g,personalityMaterial(i))}
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

const sphereCenters=makeBodyCenters(),emaeLogoCenters=makeEmaeLogoCenters(),centers=sphereCenters.map(p=>p.clone())
const DIGIT_MORPH_START=1,DIGIT_MORPH_DURATION=5
function updateSkeletonMorph(){const t=THREE.MathUtils.clamp((elapsed-DIGIT_MORPH_START)/DIGIT_MORPH_DURATION,0,1),s=t*t*(3-2*t);for(let i=0;i<BODY_COUNT;i++)centers[i].lerpVectors(sphereCenters[i],emaeLogoCenters[i],s);if(t>=1){const gold=new THREE.Color(0xffc928);for(let i=0;i<BODY_COUNT;i++){marbles[i].material.color.copy(gold);marbles[i].material.metalness=.92;marbles[i].material.roughness=.20;marbles[i].material.envMap=emaeGoldEnv;marbles[i].material.envMapIntensity=1.55;marbles[i].material.needsUpdate=true}if(marbleRenderBatches){const seen=new Set();for(const o of marbleRenderBatches){const batch=o.userData.renderBatch;if(seen.has(batch))continue;seen.add(batch);batch.material.color.set(0xffffff);batch.material.metalness=.92;batch.material.roughness=.20;batch.material.envMap=emaeGoldEnv;batch.material.envMapIntensity=1.55;batch.material.needsUpdate=true}}}updateCells()}
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
const complexity={meshes:0,geometries:new Set(),materials:new Set(),triangles:0};scene.traverse(o=>{if(!o.isMesh)return;complexity.meshes++;if(o.geometry){complexity.geometries.add(o.geometry.uuid);const g=o.geometry;if(g.index)complexity.triangles+=g.index.count/3;else if(g.attributes&&g.attributes.position)complexity.triangles+=g.attributes.position.count/3}const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)if(m)complexity.materials.add(m.uuid)});const complexityLabel=document.createElement('div');Object.assign(complexityLabel.style,{position:'fixed',right:'14px',top:'260px',zIndex:9999,color:'#fff',background:'rgba(0,0,0,.68)',padding:'8px 10px',font:'12px/1.45 monospace',whiteSpace:'pre',pointerEvents:'none'});complexityLabel.textContent='SCENE COMPLEXITY\nmeshes '+complexity.meshes+'\ngeometries '+complexity.geometries.size+'\nmaterials '+complexity.materials.size+'\ntriangles '+Math.round(complexity.triangles).toLocaleString('fr-FR');document.body.appendChild(complexityLabel);

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
const profiler={frame:0,knowledge:0,bloom:0,final:0,samples:0,last:performance.now()};const profilerLabel=document.createElement('div');Object.assign(profilerLabel.style,{position:'fixed',right:'14px',top:'12px',zIndex:9999,color:'#fff',background:'rgba(0,0,0,.68)',padding:'8px 10px',font:'12px/1.45 monospace',whiteSpace:'pre',pointerEvents:'none'});document.body.appendChild(profilerLabel);function profilerTick(frameStart,knowledgeMs,bloomMs,finalMs){profiler.frame+=performance.now()-frameStart;profiler.knowledge+=knowledgeMs;profiler.bloom+=bloomMs;profiler.final+=finalMs;profiler.samples++;const now=performance.now();if(now-profiler.last>=1000){const n=profiler.samples||1,frame=profiler.frame/n,knowledge=profiler.knowledge/n,bloom=profiler.bloom/n,final=profiler.final/n;profilerLabel.textContent='ENTITY PROFILER · '+BODY_COUNT+' billes\nframe '+frame.toFixed(2)+' ms · '+(1000/frame).toFixed(1)+' fps\nknowledge '+knowledge.toFixed(2)+' ms\nbloom '+bloom.toFixed(2)+' ms\nfinal '+final.toFixed(2)+' ms\nrender total '+(bloom+final).toFixed(2)+' ms\ndraw calls '+renderer.info.render.calls+' · tris '+renderer.info.render.triangles;profiler.frame=profiler.knowledge=profiler.bloom=profiler.final=profiler.samples=0;profiler.last=now}}
function animate(){requestAnimationFrame(animate);passProfile.samples++;const frameStart=performance.now();const dt=Math.min(clock.getDelta(),.04);elapsed+=dt;updateSkeletonMorph();nextCapacityMove-=dt;if(nextCapacityMove<=0){startCapacitySwap();nextCapacityMove=4.5+Math.random()*5.5}for(const f of flashes){if(f.age<f.duration){f.age+=dt;f.o.getWorldQuaternion(dq);worldN.copy(f.normal).applyQuaternion(dq).normalize();f.sp.getWorldPosition(worldP);toCamera.copy(camera.position).sub(worldP).normalize();const facing=Math.max(0,worldN.dot(toCamera)),t=Math.min(1,f.age/f.duration),pulse=Math.pow(Math.sin(Math.PI*t),.22),visibility=Math.pow(facing,1.8);f.sp.material.opacity=Math.min(1,pulse*visibility*2.8);f.sp.scale.setScalar(f.baseSize*(1.1+6.2*pulse)*(.35+.65*visibility));if(f.age>=f.duration)f.sp.visible=false}else{f.wait-=dt;if(f.wait<=0)fire(f)}}const maxR=controls.ECART*controls.LIBERTE*controls.CHEVAUCHEMENT,gs=controls.V1*controls.ECART*.42*(1+controls.RELATION_GLOBALE/100);for(let i=0;i<BODY_COUNT;i++){if(updateMigration(i,dt))continue;wanderClocks[i]-=dt;if(wanderClocks[i]<=0){wanderClocks[i]=.8+Math.random()*2.4;wanderTargets[i]=randomDirection()}const d=travel[i].length(),ret=maxR>0?THREE.MathUtils.smoothstep(d/maxR,.55,1):1;inward.copy(travel[i]);if(inward.lengthSq()>0)inward.normalize().multiplyScalar(-1);steer.copy(wanderTargets[i]).multiplyScalar(.3).addScaledVector(inward,ret*1.55);directions[i].addScaledVector(steer,dt).normalize();travel[i].addScaledVector(directions[i],gs*speedVariations[i]*dt);if(maxR<=0){travel[i].set(0,0,0)}else if(travel[i].length()>maxR*.985){const normal=travel[i].clone().normalize(),outward=directions[i].dot(normal);if(outward>0){directions[i].addScaledVector(normal,-2*outward);directions[i].addScaledVector(randomDirection(),.12);directions[i].normalize()}else directions[i].addScaledVector(normal,-.18).normalize();travel[i].setLength(maxR*.955)}marbles[i].position.copy(centers[homeSlots[i]]).multiplyScalar(controls.ECART).add(travel[i]);const ow=ownWorld[i];marbles[i].rotateOnAxis(ow.axis,6*LEVEL*ow.variation*dt)}if(Math.random()<1-Math.exp(-(controls.FREQUENCE_INVERSIONS/60)*dt))sense*=-1;entityGroup.rotateOnWorldAxis(axis,controls.ROTATION*sense*dt);entityGroup.updateMatrixWorld(true);const knowledgeStart=performance.now();updateKnowledgeTrails(dt);const knowledgeMs=performance.now()-knowledgeStart;for(let i=0;i<SATELLITE_COUNT;i++){const s=satelliteData[i],a=s.phase+elapsed*s.speed,p=new THREE.Vector3(Math.cos(a)*s.radius,0,Math.sin(a)*s.radius).applyEuler(new THREE.Euler(s.tiltX,0,s.tiltZ));satellites[i].position.copy(p)}syncMarbleRenderBatches();scene.background=bloomBackground;camera.layers.set(bloomLayer);const bloomStart=performance.now();bloomComposer.render(dt);const bloomMs=performance.now()-bloomStart;scene.background=(transition.state==='returning'||transition.state==='done')?null:baseBackground;camera.layers.set(0);camera.layers.enable(bloomLayer);const finalStart=performance.now();finalComposer.render(dt);const finalMs=performance.now()-finalStart;camera.layers.set(0);profilerTick(frameStart,knowledgeMs,bloomMs,finalMs)}animate()
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);bloomComposer.setSize(innerWidth,innerHeight);finalComposer.setSize(innerWidth,innerHeight)})