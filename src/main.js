import * as THREE from 'three'
import GUI from 'lil-gui'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import './style.css'

const app=document.querySelector('#app')
const renderer=new THREE.WebGLRenderer({antialias:true})
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight)
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap
renderer.outputColorSpace=THREE.SRGBColorSpace
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08
app.appendChild(renderer.domElement)

const scene=new THREE.Scene();scene.background=new THREE.Color(0x090b0e)
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,1000);camera.position.set(0,0,23)
const root=new THREE.Group();scene.add(root)
const controls={ROTATION:.14,BRILLANCE:.68,INTENSITE_LUMIERE:4.5,LUMIERE_AMBIANTE:.62,CAMERA:23}

const shellMaterial=new THREE.MeshPhysicalMaterial({
 color:0xe5231f,roughness:.18,metalness:.01,clearcoat:.88,clearcoatRoughness:.12
})
const innerMaterial=new THREE.MeshStandardMaterial({color:0x010101,roughness:1,metalness:0})

// Construction hybride :
// 1) vraie coque CSG perforée ; 2) lèvres toriques réelles autour des ouvertures.
// Les lèvres arrondissent les cloisons : on obtient une mousse/alvéole et non un simple perçage.
function makeCellularShell(){
 const evaluator=new Evaluator();evaluator.useGroups=false
 let shellBrush=new Brush(new THREE.SphereGeometry(6,128,96));shellBrush.updateMatrixWorld(true)
 const innerBrush=new Brush(new THREE.SphereGeometry(5.18,112,84));innerBrush.updateMatrixWorld(true)
 shellBrush=evaluator.evaluate(shellBrush,innerBrush,SUBTRACTION)

 const holes=[]
 const count=104,golden=Math.PI*(3-Math.sqrt(5));let seed=0x9341ba
 const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}
 const zAxis=new THREE.Vector3(0,0,1)

 for(let i=0;i<count;i++){
  const y=1-((i+.5)*2)/count
  const rr=Math.sqrt(Math.max(0,1-y*y))
  const theta=i*golden+(rnd()-.5)*.72
  const dir=new THREE.Vector3(Math.cos(theta)*rr,y,Math.sin(theta)*rr).normalize()

  const u=rnd();let mouth
  if(u<.13) mouth=THREE.MathUtils.lerp(.33,.44,rnd())
  else if(u<.78) mouth=THREE.MathUtils.lerp(.48,.66,rnd())
  else mouth=THREE.MathUtils.lerp(.69,.88,rnd())

  const oval=THREE.MathUtils.lerp(.84,1.16,rnd())
  const twist=(rnd()-.5)*Math.PI
  const depth=THREE.MathUtils.lerp(1.55,2.05,rnd())

  const cutter=new Brush(new THREE.SphereGeometry(1,24,18))
  cutter.scale.set(mouth,mouth*oval,mouth*depth)
  cutter.quaternion.setFromUnitVectors(zAxis,dir)
  cutter.rotateOnAxis(dir,twist)
  cutter.position.copy(dir).multiplyScalar(5.45+THREE.MathUtils.lerp(-.06,.05,rnd()))
  cutter.updateMatrixWorld(true)
  shellBrush=evaluator.evaluate(shellBrush,cutter,SUBTRACTION)

  holes.push({dir,mouth,oval,twist})
 }

 shellBrush.geometry.computeVertexNormals();shellBrush.geometry.computeBoundingSphere()
 return {geometry:shellBrush.geometry,holes}
}

const cellular=makeCellularShell()
const shell=new THREE.Mesh(cellular.geometry,shellMaterial);shell.castShadow=shell.receiveShadow=true;root.add(shell)

// Lèvres arrondies : elles sont de la vraie géométrie et fusionnent visuellement avec la coque.
const zAxis=new THREE.Vector3(0,0,1)
for(const h of cellular.holes){
 const ringGeo=new THREE.TorusGeometry(h.mouth*.86,h.mouth*.17,12,34)
 const ring=new THREE.Mesh(ringGeo,shellMaterial)
 ring.quaternion.setFromUnitVectors(zAxis,h.dir)
 ring.rotateOnAxis(h.dir,h.twist)
 ring.scale.set(1,h.oval,1)
 ring.position.copy(h.dir).multiplyScalar(5.93)
 ring.castShadow=ring.receiveShadow=true
 root.add(ring)
}

// Fond sombre très proche derrière les parois pour renforcer la profondeur réelle des alvéoles.
const core=new THREE.Mesh(new THREE.SphereGeometry(4.95,96,72),innerMaterial)
core.castShadow=core.receiveShadow=true;root.add(core)

const hemi=new THREE.HemisphereLight(0xffffff,0x111419,controls.LUMIERE_AMBIANTE);scene.add(hemi)
const key=new THREE.SpotLight(0xffffff,controls.INTENSITE_LUMIERE,0,Math.PI/3.8,.38,0)
key.position.set(10,10,18);key.target.position.set(0,0,0);key.castShadow=true
key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.00015;key.shadow.normalBias=.01;scene.add(key,key.target)
const fill=new THREE.PointLight(0xff5c42,.42,70);fill.position.set(-7,4,9);scene.add(fill)
const rim=new THREE.PointLight(0xff1c12,1.55,80);rim.position.set(-10,-5,-4);scene.add(rim)

function updateShine(){
 shellMaterial.roughness=THREE.MathUtils.lerp(.58,.055,controls.BRILLANCE)
 shellMaterial.clearcoat=THREE.MathUtils.lerp(.38,.98,controls.BRILLANCE)
}
updateShine()

const gui=new GUI({title:'ENTITY — GASTRONOMIE / ALVÉOLAIRE'})
gui.add(controls,'ROTATION',0,1,.01).name('ROTATION')
gui.add(controls,'BRILLANCE',0,1,.01).name('BRILLANCE').onChange(updateShine)
gui.add(controls,'INTENSITE_LUMIERE',0,8,.05).name('INTENSITÉ LUMIÈRE').onChange(v=>key.intensity=v)
gui.add(controls,'LUMIERE_AMBIANTE',0,2.5,.05).name('LUMIÈRE AMBIANTE').onChange(v=>hemi.intensity=v)
gui.add(controls,'CAMERA',10,50,.5).name('CAMERA').onChange(v=>camera.position.z=v)

const tag=document.createElement('div')
tag.textContent='GASTRONOMIE / SAVEURS — coque perforée + cloisons arrondies 3D'
Object.assign(tag.style,{position:'fixed',left:'16px',bottom:'14px',color:'rgba(255,255,255,.72)',font:'12px Arial',letterSpacing:'.08em'})
document.body.appendChild(tag)

const clock=new THREE.Clock()
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);root.rotation.y+=controls.ROTATION*dt;root.rotation.x+=controls.ROTATION*.17*dt;renderer.render(scene,camera)}
animate()

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})
