import * as THREE from 'three'
import GUI from 'lil-gui'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import './style.css'

const app=document.querySelector('#app')
const renderer=new THREE.WebGLRenderer({antialias:true})
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.14;app.appendChild(renderer.domElement)
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b0d10)
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,1000);camera.position.set(0,0,24)
const root=new THREE.Group();scene.add(root)
const controls={ROTATION:.14,BRILLANCE:.62,INTENSITE_LUMIERE:4.2,LUMIERE_AMBIANTE:.72,CAMERA:24}

// Gastronomie : coque alvéolaire dense. Les ouvertures sont de vraies soustractions 3D.
// Les cutters sont des ellipsoïdes orientés radialement : bouche arrondie + cavité profonde.
function makeCellularShell(){
 const evaluator=new Evaluator();evaluator.useGroups=false
 let result=new Brush(new THREE.SphereGeometry(6,112,80));result.updateMatrixWorld(true)
 const inner=new Brush(new THREE.SphereGeometry(5.02,96,72));inner.updateMatrixWorld(true)
 result=evaluator.evaluate(result,inner,SUBTRACTION)

 const count=118,golden=Math.PI*(3-Math.sqrt(5));let seed=0x6a31f
 const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}
 const zAxis=new THREE.Vector3(0,0,1)

 for(let i=0;i<count;i++){
  const y=1-((i+.5)*2)/count
  const rr=Math.sqrt(Math.max(0,1-y*y))
  const theta=i*golden+(rnd()-.5)*.52
  const dir=new THREE.Vector3(Math.cos(theta)*rr,y,Math.sin(theta)*rr).normalize()

  // majorité de cavités moyennes, quelques grandes et quelques petites
  const u=rnd();let mouth
  if(u<.16) mouth=THREE.MathUtils.lerp(.30,.42,rnd())
  else if(u<.82) mouth=THREE.MathUtils.lerp(.43,.62,rnd())
  else mouth=THREE.MathUtils.lerp(.63,.79,rnd())

  const oval=THREE.MathUtils.lerp(.82,1.18,rnd())
  const depth=mouth*THREE.MathUtils.lerp(1.65,2.05,rnd())
  const cutter=new Brush(new THREE.SphereGeometry(1,20,16))
  cutter.scale.set(mouth,mouth*oval,depth)
  cutter.quaternion.setFromUnitVectors(zAxis,dir)
  // suffisamment profond pour que les cavités aient de vraies parois sombres
  cutter.position.copy(dir).multiplyScalar(5.42+THREE.MathUtils.lerp(-.07,.07,rnd()))
  cutter.updateMatrixWorld(true)
  result=evaluator.evaluate(result,cutter,SUBTRACTION)
 }

 result.geometry.computeVertexNormals();result.geometry.computeBoundingSphere();return result.geometry
}

const cellularGeometry=makeCellularShell()
const shellMaterial=new THREE.MeshPhysicalMaterial({color:0xe5231f,roughness:.24,metalness:.01,clearcoat:.80,clearcoatRoughness:.17})
const innerMaterial=new THREE.MeshStandardMaterial({color:0x010101,roughness:.98,metalness:0})
const shell=new THREE.Mesh(cellularGeometry,shellMaterial);shell.castShadow=shell.receiveShadow=true;root.add(shell)
// coeur sombre : il n'est visible qu'au fond / à travers certaines alvéoles
const core=new THREE.Mesh(new THREE.SphereGeometry(4.78,80,60),innerMaterial);core.castShadow=core.receiveShadow=true;root.add(core)

const hemi=new THREE.HemisphereLight(0xffffff,0x15181d,controls.LUMIERE_AMBIANTE);scene.add(hemi)
const key=new THREE.SpotLight(0xffffff,controls.INTENSITE_LUMIERE,0,Math.PI/3.7,.40,0);key.position.set(10,10,18);key.target.position.set(0,0,0);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.00015;key.shadow.normalBias=.012;scene.add(key,key.target)
const fill=new THREE.PointLight(0xff715e,.62,70);fill.position.set(-8,5,8);scene.add(fill)
const rim=new THREE.PointLight(0xff2015,1.3,80);rim.position.set(-10,-5,-4);scene.add(rim)
function updateShine(){shellMaterial.roughness=THREE.MathUtils.lerp(.68,.07,controls.BRILLANCE);shellMaterial.clearcoat=THREE.MathUtils.lerp(.25,.95,controls.BRILLANCE)}updateShine()
const gui=new GUI({title:'ENTITY — GASTRONOMIE / CELLULAIRE 3D'});gui.add(controls,'ROTATION',0,1,.01).name('ROTATION');gui.add(controls,'BRILLANCE',0,1,.01).name('BRILLANCE').onChange(updateShine);gui.add(controls,'INTENSITE_LUMIERE',0,8,.05).name('INTENSITÉ LUMIÈRE').onChange(v=>key.intensity=v);gui.add(controls,'LUMIERE_AMBIANTE',0,2.5,.05).name('LUMIÈRE AMBIANTE').onChange(v=>hemi.intensity=v);gui.add(controls,'CAMERA',10,50,.5).name('CAMERA').onChange(v=>camera.position.z=v)
const tag=document.createElement('div');tag.textContent='GASTRONOMIE / SAVEURS — coque cellulaire dense, 118 cavités réelles';Object.assign(tag.style,{position:'fixed',left:'16px',bottom:'14px',color:'rgba(255,255,255,.72)',font:'12px Arial',letterSpacing:'.08em'});document.body.appendChild(tag)
const clock=new THREE.Clock();function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);root.rotation.y+=controls.ROTATION*dt;root.rotation.x+=controls.ROTATION*.17*dt;renderer.render(scene,camera)}animate()
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})
