import * as THREE from 'three'
import GUI from 'lil-gui'

let controlsRef=null
const bodyMarbles=[]

function randomUnit(){
  return new THREE.Vector3(Math.random()*2-1,Math.random()*2-1,Math.random()*2-1).normalize()
}

// Capture le vrai objet controls sans modifier le fonctionnement de lil-gui.
const originalGuiAdd=GUI.prototype.add
GUI.prototype.add=function(object,property,...args){
  if(property==='RELATION_GLOBALE'||property==='V1') controlsRef=object
  return originalGuiAdd.call(this,object,property,...args)
}

// Ombres 3D + capture des 200 billes du corps.
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

    // Les billes du corps reçoivent textureUnitScale juste avant leur ajout à entityGroup.
    if(object?.userData?.textureUnitScale && bodyMarbles.length<200){
      bodyMarbles.push(object)

      // Lors du premier updateLayout, main-bloom-reference passe ici le vecteur travel
      // permanent de cette bille. On le capture puis on corrige uniquement sa limite.
      const position=object.position
      const originalPositionAdd=position.add.bind(position)
      position.add=function(v){
        if(!object.userData.__travelVector){
          object.userData.__travelVector=v
          const travel=v
          const originalTravelAddScaled=travel.addScaledVector.bind(travel)

          travel.addScaledVector=function(direction,scale){
            originalTravelAddScaled(direction,scale)

            if(!controlsRef) return this
            const maxR=controlsRef.ECART*controlsRef.LIBERTE*controlsRef.CHEVAUCHEMENT
            if(maxR<=0){
              this.set(0,0,0)
              return this
            }

            // Avant que le moteur ne plaque la bille sur la frontière, on la renvoie
            // vers l'intérieur en conservant une composante tangentielle naturelle.
            if(this.length()>maxR*.985){
              const normal=this.clone().normalize()
              const outward=direction.dot(normal)
              if(outward>0){
                direction.addScaledVector(normal,-2*outward)
                direction.addScaledVector(randomUnit(),.12)
                direction.normalize()
              }else{
                direction.addScaledVector(normal,-.18).normalize()
              }
              this.setLength(maxR*.955)
            }
            return this
          }
        }
        return originalPositionAdd(v)
      }
    }
  }
  return result
}

await import('./main-bloom-reference.js')

// Le moteur principal lit controls.V1 à chaque frame : le curseur agit donc
// directement sur la vitesse réelle des billes dans leur cellule.
const controllers=()=>document.querySelectorAll('.lil-gui .controller')
void controllers

GUI.prototype.add=originalGuiAdd
