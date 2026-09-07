import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'
import GUI from 'lil-gui'
import './style.css'

// Référence historique remise telle quelle : 1000 billes, vrai moteur GPGPU.
// Test volontairement isolé de toute mécanique Entity pour valider REPOS puis DONUT.
const WIDTH=40
const HEIGHT=25
const BIRDS=WIDTH*HEIGHT
const REFERENCE_BIRDS=32*32
const REFERENCE_BOUNDS=800
const BASE_BOUNDS=REFERENCE_BOUNDS*Math.cbrt(BIRDS/REFERENCE_BIRDS)
const BOUNDS_FACTOR=.51
const BOUNDS=BASE_BOUNDS*BOUNDS_FACTOR
const BOUNDS_HALF=BOUNDS/2

const app=document.querySelector('#app')
app.innerHTML=''
const renderer=new THREE.WebGLRenderer({antialias:true})
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2))
renderer.setSize(innerWidth,innerHeight)
app.appendChild(renderer.domElement)

const scene=new THREE.Scene()
scene.background=new THREE.Color(0x16181b)
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,1,4000)
camera.position.z=840

let mouseX=10000,mouseY=10000,windowHalfX=innerWidth/2,windowHalfY=innerHeight/2,last=performance.now()
let movementSpeed=.35

const positionShader=`
uniform float time; uniform float delta;
void main(){
 vec2 uv=gl_FragCoord.xy/resolution.xy; vec4 p=texture2D(texturePosition,uv); vec3 v=texture2D(textureVelocity,uv).xyz;
 float phase=mod((p.w+delta+length(v.xz)*delta*3.+max(v.y,0.0)*delta*6.),62.83);
 gl_FragColor=vec4(p.xyz+v*delta*15.,phase);
}`

const velocityShader=`
uniform float time; uniform float testing; uniform float delta;
uniform float separationDistance; uniform float alignmentDistance; uniform float cohesionDistance; uniform float freedomFactor; uniform float centralPull; uniform vec3 predator;
const float width=resolution.x; const float height=resolution.y; const float PI=3.141592653589793; const float PI_2=PI*2.0;
float zoneRadius=40.0; float zoneRadiusSquared=1600.0; float separationThresh=.45; float alignmentThresh=.65;
const float UPPER_BOUNDS=BOUNDS; const float LOWER_BOUNDS=-UPPER_BOUNDS; const float SPEED_LIMIT=9.0;
void main(){
 zoneRadius=separationDistance+alignmentDistance+cohesionDistance; separationThresh=separationDistance/zoneRadius; alignmentThresh=(separationDistance+alignmentDistance)/zoneRadius; zoneRadiusSquared=zoneRadius*zoneRadius;
 vec2 uv=gl_FragCoord.xy/resolution.xy; vec3 birdPosition,birdVelocity; vec3 selfPosition=texture2D(texturePosition,uv).xyz; vec3 selfVelocity=texture2D(textureVelocity,uv).xyz;
 float dist,distSquared,f,percent; vec3 dir; vec3 velocity=selfVelocity; float limit=SPEED_LIMIT;
 dir=predator*UPPER_BOUNDS-selfPosition; dir.z=0.; dist=length(dir); distSquared=dist*dist; float preyRadius=150.; float preyRadiusSq=preyRadius*preyRadius;
 if(dist<preyRadius){f=(distSquared/preyRadiusSq-1.0)*delta*100.; velocity+=normalize(dir)*f; limit+=5.;}
 dir=selfPosition; dist=length(dir); dir.y*=2.5; velocity-=normalize(dir)*delta*centralPull;
 for(float y=0.;y<height;y++) for(float x=0.;x<width;x++){
   vec2 ref=vec2(x+.5,y+.5)/resolution.xy; birdPosition=texture2D(texturePosition,ref).xyz; dir=birdPosition-selfPosition; dist=length(dir); if(dist<.0001) continue;
   distSquared=dist*dist; if(distSquared>zoneRadiusSquared) continue; percent=distSquared/zoneRadiusSquared;
   if(percent<separationThresh){f=(separationThresh/percent-1.)*delta; velocity-=normalize(dir)*f;}
   else if(percent<alignmentThresh){float td=alignmentThresh-separationThresh; float ap=(percent-separationThresh)/td; birdVelocity=texture2D(textureVelocity,ref).xyz; f=(.5-cos(ap*PI_2)*.5+.5)*delta; velocity+=normalize(birdVelocity)*f;}
   else {float td=1.-alignmentThresh; float ap=td==0.?1.:(percent-alignmentThresh)/td; f=(.5-(cos(ap*PI_2)*-.5+.5))*delta; velocity+=normalize(dir)*f;}
 }
 if(length(velocity)>limit) velocity=normalize(velocity)*limit; gl_FragColor=vec4(velocity,1.);
}`

const gpuCompute=new GPUComputationRenderer(WIDTH,HEIGHT,renderer)
const dtPosition=gpuCompute.createTexture(),dtVelocity=gpuCompute.createTexture()
for(let k=0;k<dtPosition.image.data.length;k+=4){
 dtPosition.image.data[k]=Math.random()*BOUNDS-BOUNDS_HALF
 dtPosition.image.data[k+1]=Math.random()*BOUNDS-BOUNDS_HALF
 dtPosition.image.data[k+2]=Math.random()*BOUNDS-BOUNDS_HALF
 dtPosition.image.data[k+3]=1
}
for(let k=0;k<dtVelocity.image.data.length;k+=4){
 dtVelocity.image.data[k]=(Math.random()-.5)*10
 dtVelocity.image.data[k+1]=(Math.random()-.5)*10
 dtVelocity.image.data[k+2]=(Math.random()-.5)*10
 dtVelocity.image.data[k+3]=1
}
const velocityVariable=gpuCompute.addVariable('textureVelocity',velocityShader,dtVelocity)
const positionVariable=gpuCompute.addVariable('texturePosition',positionShader,dtPosition)
gpuCompute.setVariableDependencies(velocityVariable,[positionVariable,velocityVariable])
gpuCompute.setVariableDependencies(positionVariable,[positionVariable,velocityVariable])
const pu=positionVariable.material.uniforms,vu=velocityVariable.material.uniforms
pu.time={value:0};pu.delta={value:0};vu.time={value:1};vu.delta={value:0};vu.testing={value:1}
vu.separationDistance={value:30}
vu.alignmentDistance={value:1}
vu.cohesionDistance={value:60}
vu.freedomFactor={value:.75}
vu.centralPull={value:4.9}
vu.predator={value:new THREE.Vector3()}
velocityVariable.material.defines.BOUNDS=BOUNDS.toFixed(2)
velocityVariable.wrapS=velocityVariable.wrapT=positionVariable.wrapS=positionVariable.wrapT=THREE.RepeatWrapping
const err=gpuCompute.init();if(err!==null)throw new Error(err)

const palette=[0xFFE600,0xFF6500,0xE5231F,0xA86A12,0x2468D8,0x7137C8,0x5146E5,0x28C95B,0xE95A9D,0x13BFC8].map(c=>new THREE.Color(c))
const base=new THREE.SphereGeometry(3.2,16,12),geo=new THREE.InstancedBufferGeometry()
geo.index=base.index
geo.setAttribute('position',base.getAttribute('position'))
geo.setAttribute('normal',base.getAttribute('normal'))
geo.setAttribute('uv',base.getAttribute('uv'))
geo.instanceCount=BIRDS
const refs=new Float32Array(BIRDS*2),cols=new Float32Array(BIRDS*3)
for(let i=0;i<BIRDS;i++){
 refs[i*2]=(i%WIDTH+.5)/WIDTH
 refs[i*2+1]=(Math.floor(i/WIDTH)+.5)/HEIGHT
 const c=palette[i%palette.length]
 cols[i*3]=c.r;cols[i*3+1]=c.g;cols[i*3+2]=c.b
}
geo.setAttribute('reference',new THREE.InstancedBufferAttribute(refs,2))
geo.setAttribute('instanceColor',new THREE.InstancedBufferAttribute(cols,3))
const su={texturePosition:{value:null},marbleScale:{value:2.2}}
const mat=new THREE.ShaderMaterial({
 uniforms:su,
 vertexShader:`attribute vec2 reference;attribute vec3 instanceColor;uniform sampler2D texturePosition;uniform float marbleScale;varying vec3 vNormal;varying vec3 vColor;varying float vDepth;void main(){vec3 c=texture2D(texturePosition,reference).xyz;vec3 w=c+position*marbleScale;vNormal=normalize(normalMatrix*normal);vColor=instanceColor;vDepth=w.z;gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}`,
 fragmentShader:`varying vec3 vNormal;varying vec3 vColor;varying float vDepth;void main(){vec3 l=normalize(vec3(.4,.7,.6));float d=.42+max(dot(vNormal,l),0.)*.58;float z=clamp((vDepth+400.)/800.,0.,1.);gl_FragColor=vec4(vColor*d*mix(.68,1.,z),1.);}`
})
scene.add(new THREE.Mesh(geo,mat))

const controls={BOUNDS:.51,CENTRE:4.9,SEPARATION:30,ALIGNEMENT:1,COHESION:60,CAMERA:840,TAILLE:2.2,VITESSE:.35}
const gui=new GUI({title:'MURMURATION HISTORIQUE'})
gui.add(controls,'BOUNDS').name('BOUNDS').disable()
gui.add(controls,'CENTRE').name('CENTRE').disable()
gui.add(controls,'SEPARATION').name('SEPARATION').disable()
gui.add(controls,'ALIGNEMENT',1,8,1).name('ALIGNEMENT').onChange(v=>vu.alignmentDistance.value=v)
gui.add(controls,'COHESION').name('COHESION').disable()
gui.add(controls,'CAMERA').name('CAMERA').disable()
gui.add(controls,'TAILLE').name('TAILLE BILLES').disable()
gui.add(controls,'VITESSE').name('VITESSE').disable()

const status=document.createElement('div')
status.textContent='REPOS — ALIGNEMENT 1 · après 8 s : DONUT — ALIGNEMENT 8'
Object.assign(status.style,{position:'fixed',left:'14px',bottom:'12px',color:'rgba(255,255,255,.62)',font:'12px Arial',pointerEvents:'none'})
document.body.appendChild(status)
setTimeout(()=>{controls.ALIGNEMENT=8;vu.alignmentDistance.value=8;gui.controllersRecursive().forEach(c=>c.updateDisplay());status.textContent='DONUT — BOUNDS .51 · CENTRE 4.9 · SEP 30 · ALIGN 8 · COH 60 · VITESSE .35 · CAMERA 840 · TAILLE 2.2'},8000)

renderer.domElement.addEventListener('pointermove',e=>{if(e.isPrimary===false)return;mouseX=e.clientX-windowHalfX;mouseY=e.clientY-windowHalfY})
addEventListener('resize',()=>{windowHalfX=innerWidth/2;windowHalfY=innerHeight/2;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})
function animate(){
 requestAnimationFrame(animate)
 const now=performance.now();let delta=(now-last)/1000;if(delta>1)delta=1;last=now
 const simulationDelta=delta*movementSpeed
 pu.time.value=now;pu.delta.value=simulationDelta;vu.time.value=now;vu.delta.value=simulationDelta
 vu.predator.value.set(.5*mouseX/windowHalfX,-.5*mouseY/windowHalfY,0);mouseX=mouseY=10000
 gpuCompute.compute();su.texturePosition.value=gpuCompute.getCurrentRenderTarget(positionVariable).texture
 renderer.render(scene,camera)
}
animate()
