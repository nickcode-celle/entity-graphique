import * as THREE from 'three'

// Conserve uniquement l’activation des ombres du modèle 3D.
// Le panneau et tous ses curseurs sont maintenant gérés directement
// par main-bloom-reference.js : aucune interception du GUI.
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

await import('./main-bloom-reference.js')
