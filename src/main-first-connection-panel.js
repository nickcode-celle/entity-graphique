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

// HISTOIRE VÉCUE — restitution du rendu validé :
// la bille reste un matériau éclairé normal ; le vécu apparaît comme un halo séparé.
function makeHistoryHaloTexture(){
  const c=document.createElement('canvas')
  c.width=c.height=256
  const ctx=c.getContext('2d')
  const g=ctx.createRadialGradient(128,128,44,128,128,128)
  g.addColorStop(0,'rgba(255,255,255,0)')
  g.addColorStop(.36,'rgba(255,255,255,0)')
  g.addColorStop(.48,'rgba(255,255,255,.34)')
  g.addColorStop(.62,'rgba(255,255,255,.18)')
  g.addColorStop(.78,'rgba(255,255,255,.07)')
  g.addColorStop(1,'rgba(255,255,255,0)')
  ctx.fillStyle=g
  ctx.fillRect(0,0,256,256)
  const t=new THREE.CanvasTexture(c)
  t.minFilter=THREE.LinearFilter
  t.magFilter=THREE.LinearFilter
  t.generateMipmaps=false
  return t
}

const historyHaloTexture=makeHistoryHaloTexture()
for(const object of bodyMarbles){
  let historyColor=null
  object.traverse(node=>{
    if(!node.isMesh)return
    const materials=Array.isArray(node.material)?node.material:[node.material]
    for(const material of materials){
      if(material?.isMeshStandardMaterial && material.emissiveIntensity>0){
        if(!historyColor)historyColor=material.color.clone()
        material.emissive.set(0x000000)
        material.emissiveIntensity=0
        material.needsUpdate=true
      }
    }
  })
  if(!historyColor)continue

  const halo=new THREE.Sprite(new THREE.SpriteMaterial({
    map:historyHaloTexture,
    color:historyColor,
    transparent:true,
    opacity:.72,
    depthWrite:false,
    depthTest:true,
    blending:THREE.AdditiveBlending,
    toneMapped:false
  }))
  const unit=object.userData.textureUnitScale||1
  halo.scale.setScalar(17.2/unit)
  halo.renderOrder=1
  object.add(halo)
}

// Le moteur principal lit controls.V1 à chaque frame : le curseur agit donc
// directement sur la vitesse réelle des billes dans leur cellule.
const controllers=()=>document.querySelectorAll('.lil-gui .controller')
void controllers

GUI.prototype.add=originalGuiAdd
