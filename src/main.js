import * as THREE from 'three'
import GUI from 'lil-gui'
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js'
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

// Gastronomie : vraie surface implicite alvéolaire.
// On ne perce plus une sphère puis on ne rajoute plus d'anneaux.
// La coque ET les bords des cavités sont une seule isosurface lissée.
const RES=74
const field=new MarchingCubes(RES,shellMaterial,false,false,300000)
field.isolation=0
field.scale.setScalar(7.65)
field.castShadow=field.receiveShadow=true
root.add(field)

const pores=[]
const count=96,golden=Math.PI*(3-Math.sqrt(5));let seed=0x3fa921
const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}
for(let i=0;i<count;i++){
 const y=1-((i+.5)*2)/count
 const rr=Math.sqrt(Math.max(0,1-y*y))
 const theta=i*golden+(rnd()-.5)*.78
 const dir=new THREE.Vector3(Math.cos(theta)*rr,y,Math.sin(theta)*rr).normalize()
 const u=rnd();let mouth
 if(u<.15) mouth=THREE.MathUtils.lerp(.070,.086,rnd())
 else if(u<.82) mouth=THREE.MathUtils.lerp(.088,.116,rnd())
 else mouth=THREE.MathUtils.lerp(.118,.142,rnd())
 pores.push({
  dir,
  center:dir.clone().multiplyScalar(.735+THREE.MathUtils.lerp(-.012,.012,rnd())),
  mouth,
  oval:THREE.MathUtils.lerp(.84,1.18,rnd()),
  depth:mouth*THREE.MathUtils.lerp(1.45,1.85,rnd())
 })
}

function smoothMin(a,b,k){
 const h=Math.max(k-Math.abs(a-b),0)/k
 return Math.min(a,b)-h*h*k*.25
}

function buildField(){
 field.reset()
 const R=.785,Rin=.585,k=.027
 const p=new THREE.Vector3(),q=new THREE.Vector3()
 for(let z=1;z<RES-1;z++){
  const pz=(z/(RES-1))*2-1
  for(let y=1;y<RES-1;y++){
   const py=(y/(RES-1))*2-1
   for(let x=1;x<RES-1;x++){
    const px=(x/(RES-1))*2-1
    const r=Math.hypot(px,py,pz)
    // positif uniquement dans l'épaisseur de la coque
    let v=Math.min(R-r,r-Rin)
    // inutile de tester les pores loin de la coque
    if(v>-0.075){
     p.set(px,py,pz)
     for(const pore of pores){
      q.copy(p).sub(pore.center)
      const radial=q.dot(pore.dir)
      const t2=Math.max(0,q.lengthSq()-radial*radial)
      // ellipsoïde radial : ouverture arrondie, cavité profonde
      const e=Math.sqrt(t2/(pore.mouth*pore.mouth)+(radial*radial)/(pore.depth*pore.depth))-1
      const outside=e*pore.mouth
      // intersection lissée coque ∩ extérieur du pore : le raccord devient une lèvre organique
      v=smoothMin(v,outside,k)
     }
    }
    field.setCell(x,y,z,v)
   }
  }
 }
 // léger lissage volumétrique : supprime l'effet "trou usiné" sans effacer les cavités
 field.blur(1)
 field.update()
}
buildField()

// cœur sombre derrière la coque : uniquement pour donner de la profondeur aux alvéoles
const core=new THREE.Mesh(new THREE.SphereGeometry(4.36,96,72),innerMaterial)
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

const gui=new GUI({title:'ENTITY — GASTRONOMIE / IMPLICITE'})
gui.add(controls,'ROTATION',0,1,.01).name('ROTATION')
gui.add(controls,'BRILLANCE',0,1,.01).name('BRILLANCE').onChange(updateShine)
gui.add(controls,'INTENSITE_LUMIERE',0,8,.05).name('INTENSITÉ LUMIÈRE').onChange(v=>key.intensity=v)
gui.add(controls,'LUMIERE_AMBIANTE',0,2.5,.05).name('LUMIÈRE AMBIANTE').onChange(v=>hemi.intensity=v)
gui.add(controls,'CAMERA',10,50,.5).name('CAMERA').onChange(v=>camera.position.z=v)

const tag=document.createElement('div')
tag.textContent='GASTRONOMIE / SAVEURS — surface implicite alvéolaire, une seule géométrie'
Object.assign(tag.style,{position:'fixed',left:'16px',bottom:'14px',color:'rgba(255,255,255,.72)',font:'12px Arial',letterSpacing:'.08em'})
document.body.appendChild(tag)

const clock=new THREE.Clock()
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);root.rotation.y+=controls.ROTATION*dt;root.rotation.x+=controls.ROTATION*.17*dt;renderer.render(scene,camera)}
animate()

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})
