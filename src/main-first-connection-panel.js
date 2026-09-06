import * as THREE from 'three'
import GUI from 'lil-gui'

let controlsRef=null
const bodyMarbles=[]

function randomUnit(){
  return new THREE.Vector3(Math.random()*2-1,Math.random()*2-1,Math.random()*2-1).normalize()
}

const originalGuiAdd=GUI.prototype.add
GUI.prototype.add=function(object,property,...args){
  if(property==='RELATION_GLOBALE'||property==='V1') controlsRef=object
  return originalGuiAdd.call(this,object,property,...args)
}

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

    if(object?.userData?.textureUnitScale && bodyMarbles.length<200){
      bodyMarbles.push(object)
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
            if(maxR<=0){this.set(0,0,0);return this}
            if(this.length()>maxR*.985){
              const normal=this.clone().normalize()
              const outward=direction.dot(normal)
              if(outward>0){
                direction.addScaledVector(normal,-2*outward)
                direction.addScaledVector(randomUnit(),.12)
                direction.normalize()
              }else direction.addScaledVector(normal,-.18).normalize()
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

// HISTOIRE VÉCUE : la bille reste 100 % soumise à l'éclairage et aux ombres.
// Seul un halo extérieur, de la couleur de la bille, porte la patine visuelle.
function makeHistoryHaloTexture(){
  const c=document.createElement('canvas')
  c.width=c.height=256
  const ctx=c.getContext('2d')
  const g=ctx.createRadialGradient(128,128,0,128,128,128)
  g.addColorStop(0,'rgba(255,255,255,0)')
  g.addColorStop(.60,'rgba(255,255,255,0)')
  g.addColorStop(.66,'rgba(255,255,255,.30)')
  g.addColorStop(.76,'rgba(255,255,255,.16)')
  g.addColorStop(.88,'rgba(255,255,255,.06)')
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
      if(!material?.isMeshStandardMaterial)continue
      if(material.emissiveIntensity>0 && !historyColor)historyColor=material.color.clone()
      // Aucune bille du corps ne doit produire sa propre lumière.
      material.emissive.set(0x000000)
      material.emissiveIntensity=0
      material.needsUpdate=true
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
  // Le centre transparent couvre entièrement la bille : le halo ne peut plus
  // éclaircir sa surface ni masquer une ombre portée.
  halo.scale.setScalar(19.2/unit)
  halo.renderOrder=0
  object.add(halo)
}

const controllers=()=>document.querySelectorAll('.lil-gui .controller')
void controllers
GUI.prototype.add=originalGuiAdd
