import * as THREE from 'three'
import GUI from 'lil-gui'

const monde={MONDE_PROPRE:90}
const rotating=[]
const originalAdd=THREE.Object3D.prototype.add

function randomAxis(){
  return new THREE.Vector3(Math.random()*2-1,Math.random()*2-1,Math.random()*2-1).normalize()
}

THREE.Object3D.prototype.add=function(...objects){
  const result=originalAdd.apply(this,objects)
  for(const object of objects){
    if(object?.userData?.textureUnitScale!==undefined&&!object.userData.mondeRotation){
      object.userData.mondeRotation={
        axis:randomAxis(),
        variation:THREE.MathUtils.lerp(.85,1.15,Math.random())
      }
      rotating.push(object)
    }
  }
  return result
}

await import('./main-comet.js')

const gui=new GUI({title:'ENTITY — TEST MONDE PROPRE'})
gui.add(monde,'MONDE_PROPRE',0,100,1).name('Monde propre %')

const label=document.createElement('div')
label.textContent='ENTITY — Monde propre : rotation propre — 30 % rapide / 90 % très rapide'
Object.assign(label.style,{position:'fixed',left:'14px',bottom:'30px',color:'#ddd',font:'12px Arial'})
document.body.appendChild(label)

let last=performance.now()
function rotateOwnWorld(now){
  requestAnimationFrame(rotateOwnWorld)
  const dt=Math.min((now-last)/1000,.04)
  last=now
  const level=monde.MONDE_PROPRE/100
  const speed=6.0*level
  for(const object of rotating){
    const r=object.userData.mondeRotation
    object.rotateOnAxis(r.axis,speed*r.variation*dt)
  }
}
requestAnimationFrame(rotateOwnWorld)
