import * as THREE from 'three'
import GUI from 'lil-gui'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import './style.css'

const app=document.querySelector('#app')
const renderer=new THREE.WebGLRenderer({antialias:true})
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;app.appendChild(renderer.domElement)
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0d0f12)
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,1000);camera.position.set(0,0,24)
const root=new THREE.Group();scene.add(root)
const controls={ROTATION:.14,BRILLANCE:.62,INTENSITE_LUMIERE:4.2,LUMIERE_AMBIANTE:.75,CAMERA:24}

function makePorousShell(){
 const evaluator=new Evaluator();evaluator.useGroups=false
 let result=new Brush(new THREE.SphereGeometry(6,112,80));result.updateMatrixWorld(true)
 const inner=new Brush(new THREE.SphereGeometry(5.08,96,72));inner.updateMatrixWorld(true)
 result=evaluator.evaluate(result,inner,SUBTRACTION)
 const count=82,golden=Math.PI*(3-Math.sqrt(5));let seed=0x51a7e
 const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}
 for(let i=0;i<count;i++){
  const y=1-((i+.5)*2)/count,rr=Math.sqrt(Math.max(0,1-y*y)),theta=i*golden+(rnd()-.5)*.7
  const dir=new THREE.Vector3(Math.cos(theta)*rr,y,Math.sin(theta)*rr).normalize()
  const u=rnd();let radius
  if(u<.18) radius=THREE.MathUtils.lerp(.26,.40,rnd())
  else if(u<.78) radius=THREE.MathUtils.lerp(.40,.66,rnd())
  else radius=THREE.MathUtils.lerp(.66,.91,rnd())
  const cutter=new Brush(new THREE.SphereGeometry(radius,20,14))
  cutter.position.copy(dir).multiplyScalar(5.70+THREE.MathUtils.lerp(-.13,.11,rnd()))
  cutter.scale.set(1,THREE.MathUtils.lerp(.82,1.16,rnd()),THREE.MathUtils.lerp(.82,1.16,rnd()))
  cutter.rotation.set(rnd()*Math.PI,rnd()*Math.PI,rnd()*Math.PI);cutter.updateMatrixWorld(true)
  result=evaluator.evaluate(result,cutter,SUBTRACTION)
 }
 result.geometry.computeVertexNormals();result.geometry.computeBoundingSphere();return result.geometry
}
const porousGeometry=makePorousShell()
const shellMaterial=new THREE.MeshPhysicalMaterial({color:0xe5231f,roughness:.22,metalness:.015,clearcoat:.78,clearcoatRoughness:.16})
const innerMaterial=new THREE.MeshStandardMaterial({color:0x020202,roughness:.96,metalness:0})
const shell=new THREE.Mesh(porousGeometry,shellMaterial);shell.castShadow=shell.receiveShadow=true;root.add(shell)
const core=new THREE.Mesh(new THREE.SphereGeometry(4.93,80,60),innerMaterial);core.castShadow=core.receiveShadow=true;root.add(core)

const hemi=new THREE.HemisphereLight(0xffffff,0x16191e,controls.LUMIERE_AMBIANTE);scene.add(hemi)
const key=new THREE.SpotLight(0xffffff,controls.INTENSITE_LUMIERE,0,Math.PI/3.7,.4,0);key.position.set(10,10,18);key.target.position.set(0,0,0);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.00015;key.shadow.normalBias=.012;scene.add(key,key.target)
const fill=new THREE.PointLight(0xff6b52,.72,70);fill.position.set(-8,5,8);scene.add(fill)
const rim=new THREE.PointLight(0xff2418,1.45,80);rim.position.set(-10,-5,-4);scene.add(rim)
function updateShine(){shellMaterial.roughness=THREE.MathUtils.lerp(.68,.07,controls.BRILLANCE);shellMaterial.clearcoat=THREE.MathUtils.lerp(.25,.95,controls.BRILLANCE)}updateShine()
const gui=new GUI({title:'ENTITY — GASTRONOMIE / VRAIE 3D'});gui.add(controls,'ROTATION',0,1,.01).name('ROTATION');gui.add(controls,'BRILLANCE',0,1,.01).name('BRILLANCE').onChange(updateShine);gui.add(controls,'INTENSITE_LUMIERE',0,8,.05).name('INTENSITÉ LUMIÈRE').onChange(v=>key.intensity=v);gui.add(controls,'LUMIERE_AMBIANTE',0,2.5,.05).name('LUMIÈRE AMBIANTE').onChange(v=>hemi.intensity=v);gui.add(controls,'CAMERA',10,50,.5).name('CAMERA').onChange(v=>camera.position.z=v)
const tag=document.createElement('div');tag.textContent='GASTRONOMIE / SAVEURS — 82 cavités 3D multi-échelle';Object.assign(tag.style,{position:'fixed',left:'16px',bottom:'14px',color:'rgba(255,255,255,.72)',font:'12px Arial',letterSpacing:'.08em'});document.body.appendChild(tag)
const clock=new THREE.Clock();function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);root.rotation.y+=controls.ROTATION*dt;root.rotation.x+=controls.ROTATION*.17*dt;renderer.render(scene,camera)}animate()
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})
