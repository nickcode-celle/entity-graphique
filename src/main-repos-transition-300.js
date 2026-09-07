import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'
import GUI from 'lil-gui'

// Entity eligible -> REPOS historique.
// Même matière, même taille, même caméra et même volume apparent pendant la prise de relais.
const entityBodies=[];let entityGroup=null,controls=null
const originalGuiAdd=GUI.prototype.add
GUI.prototype.add=function(object,property,...args){if(['ECART','TAILLE_BILLES','V1','RELATION_GLOBALE','LIBERTE','CHEVAUCHEMENT','ROTATION','FREQUENCE_INVERSIONS','BRILLANCE','INTENSITE_LUMIERE','LUMIERE_AMBIANTE','CAMERA'].includes(property))controls=object;return originalGuiAdd.call(this,object,property,...args)}
const originalAdd=THREE.Object3D.prototype.add
THREE.Object3D.prototype.add=function(...objects){const r=originalAdd.apply(this,objects);for(const o of objects)if(o?.userData?.textureUnitScale&&entityBodies.length<200){entityBodies.push(o);entityGroup=this}return r}
await import('./main-first-connection-panel.js');THREE.Object3D.prototype.add=originalAdd;GUI.prototype.add=originalGuiAdd
if(controls)Object.assign(controls,{ECART:28,TAILLE_BILLES:.90,V1:.75,RELATION_GLOBALE:43,LIBERTE:.15,CHEVAUCHEMENT:1.45,ROTATION:.11,FREQUENCE_INVERSIONS:12,BRILLANCE:.62,INTENSITE_LUMIERE:2.25,LUMIERE_AMBIANTE:1,CAMERA:280})
const GOLDEN=Math.PI*(3-Math.sqrt(5))
function shellPoint(i,n=100){const y=1-(i+.5)*2/n,r=Math.sqrt(Math.max(0,1-y*y)),a=i*GOLDEN+2.31;return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r).multiplyScalar(3.32*28).applyEuler(new THREE.Euler(.21,-.27,.16))}
function cloneMaterial(m){const c=m.clone();if(c.isMeshStandardMaterial){c.emissive.set(0);c.emissiveIntensity=0}return c}
function cloneBody(src){const c=src.clone(true);c.traverse(n=>{if(n.material)n.material=Array.isArray(n.material)?n.material.map(cloneMaterial):cloneMaterial(n.material)});return c}
const pool=entityBodies.slice(),added=[]
for(let i=0;i<100;i++){const c=cloneBody(pool[Math.floor(Math.random()*pool.length)]);c.position.copy(shellPoint(i));entityGroup.add(c);added.push(c)}
const marbles=[...entityBodies,...added]
const WIDTH=20,HEIGHT=15,BIRDS=300,REFERENCE_BIRDS=32*32,REFERENCE_BOUNDS=800,BOUNDS_FACTOR=.51
const BOUNDS=REFERENCE_BOUNDS*Math.cbrt(BIRDS/REFERENCE_BIRDS)*BOUNDS_FACTOR,SPEED=.35,CENTRE=4.9,SEPARATION=30,ALIGNEMENT=1,COHESION=60,HOLD=5,TAKEOVER=7
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)}
const positionShader=`uniform float time;uniform float delta;void main(){vec2 uv=gl_FragCoord.xy/resolution.xy;vec4 p=texture2D(texturePosition,uv);vec3 v=texture2D(textureVelocity,uv).xyz;float phase=mod((p.w+delta+length(v.xz)*delta*3.+max(v.y,0.0)*delta*6.),62.83);gl_FragColor=vec4(p.xyz+v*delta*15.,phase);}`
const velocityShader=`uniform float time;uniform float testing;uniform float delta;uniform float separationDistance;uniform float alignmentDistance;uniform float cohesionDistance;uniform float freedomFactor;uniform float centralPull;uniform vec3 predator;const float width=resolution.x;const float height=resolution.y;const float PI=3.141592653589793;const float PI_2=PI*2.0;float zoneRadius=40.0;float zoneRadiusSquared=1600.0;float separationThresh=.45;float alignmentThresh=.65;const float UPPER_BOUNDS=BOUNDS;const float SPEED_LIMIT=9.0;void main(){zoneRadius=separationDistance+alignmentDistance+cohesionDistance;separationThresh=separationDistance/zoneRadius;alignmentThresh=(separationDistance+alignmentDistance)/zoneRadius;zoneRadiusSquared=zoneRadius*zoneRadius;vec2 uv=gl_FragCoord.xy/resolution.xy;vec3 selfPosition=texture2D(texturePosition,uv).xyz;vec3 selfVelocity=texture2D(textureVelocity,uv).xyz;vec3 velocity=selfVelocity;float limit=SPEED_LIMIT;vec3 dir=predator*UPPER_BOUNDS-selfPosition;dir.z=0.;float dist=length(dir),distSquared=dist*dist;float preyRadius=150.;if(dist<preyRadius){float f=(distSquared/(preyRadius*preyRadius)-1.)*delta*100.;velocity+=normalize(dir)*f;limit+=5.;}dir=selfPosition;dist=length(dir);dir.y*=2.5;if(dist>.0001)velocity-=normalize(dir)*delta*centralPull;for(float y=0.;y<height;y++)for(float x=0.;x<width;x++){vec2 ref=vec2(x+.5,y+.5)/resolution.xy;vec3 birdPosition=texture2D(texturePosition,ref).xyz;dir=birdPosition-selfPosition;dist=length(dir);if(dist<.0001)continue;distSquared=dist*dist;if(distSquared>zoneRadiusSquared)continue;float percent=distSquared/zoneRadiusSquared;if(percent<separationThresh){float f=(separationThresh/percent-1.)*delta;velocity-=normalize(dir)*f;}else if(percent<alignmentThresh){float td=alignmentThresh-separationThresh;float ap=(percent-separationThresh)/td;vec3 birdVelocity=texture2D(textureVelocity,ref).xyz;float f=(.5-cos(ap*PI_2)*.5+.5)*delta;velocity+=normalize(birdVelocity)*f;}else{float td=1.-alignmentThresh;float ap=td==0.?1.:(percent-alignmentThresh)/td;float f=(.5-(cos(ap*PI_2)*-.5+.5))*delta;velocity+=normalize(dir)*f;}}if(length(velocity)>limit)velocity=normalize(velocity)*limit;gl_FragColor=vec4(velocity,1.);}`
let active=false,renderer=null,scene=null,camera=null,gpu=null,pv=null,vv=null,pu=null,vu=null,last=performance.now(),transitionStart=0
const pixels=new Float32Array(BIRDS*4),startPositions=[],gpuPositions=Array.from({length:BIRDS},()=>new THREE.Vector3()),center=new THREE.Vector3(),gpuCenter=new THREE.Vector3()
let startCamera=280,startRadius=1
function rmsRadius(points,c){let s=0;for(const p of points)s+=p.distanceToSquared(c);return Math.sqrt(s/points.length)}
function startRepos(){
 active=true;transitionStart=performance.now();last=transitionStart;if(controls){startCamera=controls.CAMERA||280;controls.V1=0;controls.ROTATION=0}
 entityGroup.updateMatrixWorld(true);center.set(0,0,0)
 for(let i=0;i<BIRDS;i++){const p=new THREE.Vector3();marbles[i].getWorldPosition(p);startPositions[i]=p;center.add(p)}center.multiplyScalar(1/BIRDS);startRadius=rmsRadius(startPositions,center)
 scene=new THREE.Scene();scene.background=new THREE.Color(0x08090b);camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,1,4000);camera.position.z=startCamera
 scene.add(new THREE.HemisphereLight(0xffffff,0x303030,1.35));const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(250,320,420);scene.add(key)
 for(let i=0;i<BIRDS;i++){const o=marbles[i];o.removeFromParent();o.position.copy(startPositions[i]);o.visible=true;scene.add(o)}
 renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;Object.assign(renderer.domElement.style,{position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'50'});document.body.appendChild(renderer.domElement);const oldCanvas=document.querySelector('#app canvas');if(oldCanvas)oldCanvas.style.visibility='hidden'
 gpu=new GPUComputationRenderer(WIDTH,HEIGHT,renderer);const tp=gpu.createTexture(),tv=gpu.createTexture(),pd=tp.image.data,vd=tv.image.data
 for(let i=0;i<BIRDS;i++){const p=startPositions[i];pd[i*4]=p.x;pd[i*4+1]=p.y;pd[i*4+2]=p.z;pd[i*4+3]=1;vd[i*4]=(Math.random()-.5)*10;vd[i*4+1]=(Math.random()-.5)*10;vd[i*4+2]=(Math.random()-.5)*10;vd[i*4+3]=1}
 vv=gpu.addVariable('textureVelocity',velocityShader,tv);pv=gpu.addVariable('texturePosition',positionShader,tp);gpu.setVariableDependencies(vv,[pv,vv]);gpu.setVariableDependencies(pv,[pv,vv]);pu=pv.material.uniforms;vu=vv.material.uniforms;pu.time={value:0};pu.delta={value:0};vu.time={value:1};vu.delta={value:0};vu.testing={value:1};vu.separationDistance={value:SEPARATION};vu.alignmentDistance={value:ALIGNEMENT};vu.cohesionDistance={value:COHESION};vu.freedomFactor={value:.75};vu.centralPull={value:CENTRE};vu.predator={value:new THREE.Vector3(10000,10000,0)};vv.material.defines.BOUNDS=BOUNDS.toFixed(2);vv.wrapS=vv.wrapT=pv.wrapS=pv.wrapT=THREE.RepeatWrapping;const err=gpu.init();if(err)throw new Error(err)
 document.querySelectorAll('.lil-gui.root').forEach(g=>g.style.display='none');const params={BOUNDS:BOUNDS_FACTOR,CENTRE,SEPARATION,ALIGNEMENT,COHESION,VITESSE:SPEED,CAMERA:startCamera};const gui=new GUI({title:'REPOS — ÉCHELLE ENTITY'});for(const k of Object.keys(params))gui.add(params,k).disable();gui.domElement.style.zIndex='60'
}
addEventListener('resize',()=>{if(!active)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})
const t0=performance.now()
function animateRepos(){
 requestAnimationFrame(animateRepos);if(!active&&performance.now()-t0>HOLD*1000)startRepos();if(!active)return
 const now=performance.now(),elapsed=(now-transitionStart)/1000;let delta=Math.min((now-last)/1000,.05);last=now;const k=smooth(elapsed/TAKEOVER)
 // La caméra reste strictement celle d'Entity pendant toute cette expérience.
 camera.position.z=startCamera
 const simulationDelta=delta*SPEED*(.08+.92*k);pu.time.value=now;pu.delta.value=simulationDelta;vu.time.value=now;vu.delta.value=simulationDelta;gpu.compute();renderer.readRenderTargetPixels(gpu.getCurrentRenderTarget(pv),0,0,WIDTH,HEIGHT,pixels)
 gpuCenter.set(0,0,0);for(let i=0;i<BIRDS;i++){gpuPositions[i].set(pixels[i*4],pixels[i*4+1],pixels[i*4+2]);gpuCenter.add(gpuPositions[i])}gpuCenter.multiplyScalar(1/BIRDS)
 // Normalisation de volume : le murmure peut se réorganiser librement mais ne peut pas s'effondrer visuellement.
 const gr=Math.max(1,rmsRadius(gpuPositions,gpuCenter)),scale=startRadius/gr
 for(let i=0;i<BIRDS;i++){const target=gpuPositions[i].clone().sub(gpuCenter).multiplyScalar(scale).add(center);marbles[i].position.copy(startPositions[i]).lerp(target,k)}
 renderer.render(scene,camera)
}
animateRepos()
const label=[...document.querySelectorAll('div')].find(el=>el.textContent?.startsWith('ENTITY — Première connexion'));if(label)label.textContent='ENTITY ÉLIGIBLE → REPOS · mêmes billes · caméra fixe · volume Entity conservé'
const title=document.querySelector('.lil-gui.root > .title');if(title)title.textContent='ENTITY → REPOS / ÉCHELLE CONSERVÉE'
