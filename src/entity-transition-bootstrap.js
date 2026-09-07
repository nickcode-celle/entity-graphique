import * as THREE from 'three'

const tracked=new Set()
const originalAdd=THREE.Object3D.prototype.add
THREE.Object3D.prototype.add=function(...objects){
  for(const object of objects)if(object?.isObject3D)tracked.add(object)
  return originalAdd.apply(this,objects)
}

await import('./main-entity-50.js')

const api=window.entityTransitionAPI
if(api){
  api.fadeSelectedBead=function(duration=3.2){
    const serial=api.state?.().serial
    if(!Number.isInteger(serial)||serial<0)return false

    let bead=null
    for(const object of tracked){
      if(object?.userData?.serialId===serial){bead=object;break}
    }
    if(!bead)return false

    const keep=new Set()
    bead.traverse(object=>keep.add(object))
    for(let object=bead;object;object=object.parent)keep.add(object)

    for(const object of tracked){
      if(!keep.has(object)&&!object.isLight)object.visible=false
    }

    const root=[...keep].find(object=>object?.isScene)
    if(root){
      try{Object.defineProperty(root,'background',{configurable:true,get(){return null},set(){}})}catch{root.background=null}
    }

    document.documentElement.style.background='transparent'
    document.body.style.background='transparent'
    const app=document.querySelector('#app')
    if(app)app.style.background='transparent'

    const materials=[]
    bead.traverse(object=>{
      const list=Array.isArray(object.material)?object.material:(object.material?[object.material]:[])
      for(const material of list){
        if(!material||materials.some(entry=>entry.material===material))continue
        materials.push({material,opacity:material.opacity??1,depthWrite:material.depthWrite})
        material.transparent=true
        material.depthWrite=false
        material.needsUpdate=true
      }
    })

    const start=performance.now()
    const total=Math.max(.1,duration)*1000
    function fade(now){
      const t=Math.min(1,(now-start)/total)
      const eased=t*t*(3-2*t)
      for(const entry of materials)entry.material.opacity=entry.opacity*(1-eased)
      if(t<1)requestAnimationFrame(fade)
      else{
        bead.visible=false
        window.parent?.postMessage({type:'ENTITY_TRANSITION_FADE_DONE',serial},'*')
      }
    }
    requestAnimationFrame(fade)
    return true
  }
}
