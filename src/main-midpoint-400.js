import * as THREE from 'three'
import GUI from 'lil-gui'

let controlsRef=null
let entityGroupRef=null
const originalBodies=[]

const originalGuiAdd=GUI.prototype.add
GUI.prototype.add=function(object,property,...args){
  if(property==='RELATION_GLOBALE'||property==='V1')controlsRef=object
  return originalGuiAdd.call(this,object,property,...args)
}

const outerOriginalAdd=THREE.Object3D.prototype.add
THREE.Object3D.prototype.add=function(...objects){
  const result=outerOriginalAdd.apply(this,objects)
  for(const object of objects){
    if(object?.userData?.textureUnitScale&&originalBodies.length<200){
      originalBodies.push(object)
      entityGroupRef=this
    }
  }
  return result
}

await import('./main-first-connection-panel.js')

THREE.Object3D.prototype.add=outerOriginalAdd
GUI.prototype.add=originalGuiAdd

if(controlsRef){
  controlsRef.RELATION_GLOBALE=52
  controlsRef.V1=1
}

const GOLDEN=Math.PI*(3-Math.sqrt(5))
function outerPoint(i,n=200){
  const y=1-(i+.5)*(2/n)
  const r=Math.sqrt(Math.max(0,1-y*y))
  const a=i*GOLDEN+1.73
  const p=new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r).multiplyScalar(3.46*28)
  p.applyEuler(new THREE.Euler(.24,-.31,.18))
  return p
}
function randomUnit(){
  return new THREE.Vector3(Math.random()*2-1,Math.random()*2-1,Math.random()*2-1).normalize()
}
function firstMeshColor(object){
  let color=new THREE.Color(0xffffff)
  object.traverse(node=>{
    if(node.isMesh&&node.material&&!node.userData.__pickedColor){
      const m=Array.isArray(node.material)?node.material[0]:node.material
      if(m?.color){color=m.color.clone();node.userData.__pickedColor=true}
    }
  })
  return color
}
function boostMaterial(material){
  const m=material.clone()
  if(m.color){
    const h={};m.color.getHSL(h)
    m.color.setHSL(h.h,Math.min(1,h.s*1.08),h.l)
  }
  if(m.isMeshStandardMaterial){
    m.emissive.set(0x000000)
    m.emissiveIntensity=0
  }
  m.needsUpdate=true
  return m
}
function cloneBody(source){
  const c=source.clone(true)
  c.traverse(node=>{
    if(!node.material)return
    node.material=Array.isArray(node.material)?node.material.map(boostMaterial):boostMaterial(node.material)
    if(node.isMesh){node.castShadow=true;node.receiveShadow=true}
  })
  return c
}
function isHistoryHalo(node){
  return node.isSprite&&node.visible&&node.material?.isSpriteMaterial&&node.material.opacity>.5&&node.scale.x>2
}

const textured=originalBodies.filter(o=>(o.userData.textureUnitScale||1)>1)
const plain=originalBodies.filter(o=>(o.userData.textureUnitScale||1)<=1)
const evolved=[]
for(let i=0;i<200;i++){
  const source=Math.random()<.58&&textured.length
    ? textured[Math.floor(Math.random()*textured.length)]
    : plain[Math.floor(Math.random()*plain.length)]
  const c=cloneBody(source)
  c.userData.__midpointClone=true
  c.userData.textureUnitScale=source.userData.textureUnitScale||1
  c.position.copy(outerPoint(i))
  entityGroupRef.add(c)
  evolved.push(c)
}

const allBodies=[...originalBodies,...evolved]
let haloTemplate=null
for(const o of originalBodies){
  o.traverse(n=>{if(!haloTemplate&&isHistoryHalo(n))haloTemplate=n})
}
function hasHalo(o){let yes=false;o.traverse(n=>{if(isHistoryHalo(n))yes=true});return yes}
if(haloTemplate){
  const target=Math.round(allBodies.length*.56)
  let current=allBodies.filter(hasHalo).length
  const candidates=allBodies.filter(o=>!hasHalo(o)).sort(()=>Math.random()-.5)
  for(const o of candidates){
    if(current>=target)break
    const h=haloTemplate.clone()
    h.material=haloTemplate.material.clone()
    h.material.color.copy(firstMeshColor(o))
    const unit=o.userData.textureUnitScale||1
    h.scale.setScalar(19.2/unit)
    h.renderOrder=0
    o.add(h)
    current++
  }
}

const cloneData=evolved.map((o,i)=>({
  o,
  center:outerPoint(i),
  travel:new THREE.Vector3(),
  dir:randomUnit(),
  target:randomUnit(),
  timer:Math.random()*2,
  axis:randomUnit(),
  spin:.85+Math.random()*.3,
  migrating:false,
  migrationT:0,
  migrationDur:0,
  from:new THREE.Vector3(),
  to:new THREE.Vector3()
}))

let capacityTimer=2.5+Math.random()*3
const clock=new THREE.Clock()
function animateMidpoint(){
  requestAnimationFrame(animateMidpoint)
  const dt=Math.min(clock.getDelta(),.04)
  const maxR=28*.15*1.45
  const speed=28*.42*(1+.52)

  capacityTimer-=dt
  if(capacityTimer<=0){
    capacityTimer=3.2+Math.random()*3.8
    const d=cloneData[Math.floor(Math.random()*cloneData.length)]
    if(!d.migrating){
      d.migrating=true
      d.migrationT=0
      d.migrationDur=1.8+Math.random()*.7
      d.from.copy(d.center)
      d.to.copy(outerPoint(Math.floor(Math.random()*200)))
    }
  }

  for(const d of cloneData){
    if(d.migrating){
      d.migrationT+=dt
      const u=Math.min(1,d.migrationT/d.migrationDur)
      const s=u*u*(3-2*u)
      d.center.copy(d.from).lerp(d.to,s)
      d.center.y+=Math.sin(Math.PI*u)*3.4
      if(u>=1)d.migrating=false
    }

    d.timer-=dt
    if(d.timer<=0){d.timer=.8+Math.random()*2.2;d.target=randomUnit()}
    const inward=d.travel.clone()
    if(inward.lengthSq())inward.normalize().multiplyScalar(-1)
    const ret=maxR>0?THREE.MathUtils.smoothstep(d.travel.length()/maxR,.55,1):1
    d.dir.addScaledVector(d.target,.3*dt).addScaledVector(inward,ret*1.5*dt).normalize()
    d.travel.addScaledVector(d.dir,speed*dt)
    if(d.travel.length()>maxR)d.travel.setLength(maxR*.96)
    d.o.position.copy(d.center).add(d.travel)
    d.o.rotateOnAxis(d.axis,6*.46*d.spin*dt)
  }
}
animateMidpoint()

const label=[...document.querySelectorAll('div')].find(el=>el.textContent?.startsWith('ENTITY — Première connexion'))
if(label)label.textContent='ENTITY — Mi-parcours · 400 billes · Relation 52 % · Connaissances ~60 % · Monde propre ~46 % · Histoire vécue 56 % · Capacités ~48 %'
const title=document.querySelector('.lil-gui.root > .title')
if(title)title.textContent='ENTITY — MI-PARCOURS / 400 BILLES'
