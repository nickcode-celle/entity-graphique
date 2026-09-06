import * as THREE from 'three'
import GUI from 'lil-gui'

// Ombres 3D actives, mais avec une shadow map raisonnable pour ne pas bloquer
// l'animation interne des 200 billes et de leurs textures complexes.
const originalObjectAdd=THREE.Object3D.prototype.add
THREE.Object3D.prototype.add=function(...objects){
  const result=originalObjectAdd.apply(this,objects)
  for(const object of objects){
    object?.traverse?.(node=>{
      if(node.isMesh){
        node.castShadow=true
        node.receiveShadow=true
      }
      if(node.isSpotLight){
        node.castShadow=true
        node.shadow.mapSize.set(1024,1024)
        node.shadow.camera.near=1
        node.shadow.camera.far=700
        node.shadow.bias=-0.00035
        node.shadow.normalBias=.015
      }
    })
  }
  return result
}

let guiRef=null
let controlsRef=null
let addedOnce=false
const originalAdd=GUI.prototype.add

GUI.prototype.add=function(object,property,...args){
  const controller=originalAdd.call(this,object,property,...args)
  if(!guiRef){guiRef=this;controlsRef=object}
  return controller
}

await import('./main-bloom-reference.js')

if(guiRef&&controlsRef&&!addedOnce){
  addedOnce=true

  const controllers=()=>guiRef.controllersRecursive?.() ?? guiRef.controllers ?? []
  const findController=property=>controllers().find(c=>c?.property===property)
  const setExisting=(property,value)=>{
    const c=findController(property)
    if(c)c.setValue(value)
    else controlsRef[property]=value
  }

  setExisting('RELATION_GLOBALE',8)
  setExisting('ROTATION',.11)
  setExisting('FREQUENCE_INVERSIONS',12)
  setExisting('BRILLANCE',.62)
  setExisting('CAMERA',350)
  setExisting('V1',1)

  // Le V1 existant pilote directement controls.V1 lu à chaque frame par le moteur.
  // On élargit seulement sa plage pour rendre le contrôle immédiatement vérifiable.
  const v1=findController('V1')
  if(v1){
    v1.min(0)
    v1.max(8)
    v1.step(.01)
    v1.name('V1 — VITESSE BILLES / CELLULE')
    v1.updateDisplay()
  }

  const props=new Set(controllers().map(c=>c?.property))
  if(!props.has('INTENSITE_LUMIERE')) guiRef.add(controlsRef,'INTENSITE_LUMIERE',0,8,.05).name('INTENSITÉ LUMIÈRE')
  if(!props.has('LUMIERE_AMBIANTE')) guiRef.add(controlsRef,'LUMIERE_AMBIANTE',0,4,.05).name('LUMIÈRE AMBIANTE')
  if(!props.has('ECART')) guiRef.add(controlsRef,'ECART',18,42,.5).name('TAILLE / ÉCART')
  if(!props.has('TAILLE_BILLES')) guiRef.add(controlsRef,'TAILLE_BILLES',.4,1.5,.01).name('TAILLE BILLES')
  if(!props.has('V1')) guiRef.add(controlsRef,'V1',0,8,.01).name('V1 — VITESSE BILLES / CELLULE')
  if(!props.has('LIBERTE')) guiRef.add(controlsRef,'LIBERTE',0,.5,.01).name('LIBERTÉ CELLULE')
  if(!props.has('CHEVAUCHEMENT')) guiRef.add(controlsRef,'CHEVAUCHEMENT',1,2,.01).name('CHEVAUCHEMENT')
  if(!props.has('VOIR_CELLULES')) guiRef.add(controlsRef,'VOIR_CELLULES').name('VOIR CELLULES')
}

GUI.prototype.add=originalAdd
