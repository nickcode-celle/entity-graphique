from pathlib import Path
p=Path('src/main-entity-50.js')
s=p.read_text()
anchor="const entityGroup=new THREE.Group()\nscene.add(entityGroup)"
if anchor not in s: raise SystemExit('entityGroup anchor not found')
if 'NEW_MARBLE_BIRTH_SPHERE_TEST' in s: raise SystemExit('birth already patched')
code="""

// NEW_MARBLE_BIRTH_SPHERE_TEST
const birthGroup=new THREE.Group()
scene.add(birthGroup)
const birthPosition=new THREE.Vector3(72,8,18)
const birthPointMaterial=new THREE.MeshBasicMaterial({color:0xfff4b0,transparent:true,opacity:1})
const birthPoint=new THREE.Mesh(new THREE.SphereGeometry(.18,20,20),birthPointMaterial)
birthPoint.position.copy(birthPosition)
birthPoint.layers.enable(1)
birthGroup.add(birthPoint)
const birthLight=new THREE.PointLight(0xffd75b,0,90,2)
birthLight.position.copy(birthPosition)
scene.add(birthLight)
const birthMarbleMaterial=new THREE.MeshStandardMaterial({color:0xd7a52a,metalness:.72,roughness:.20,emissive:0x7a4a00,emissiveIntensity:.16})
const birthMarble=new THREE.Mesh(new THREE.SphereGeometry(6,28,20),birthMarbleMaterial)
birthMarble.position.copy(birthPosition)
birthMarble.scale.setScalar(.001)
birthMarble.castShadow=true
birthMarble.receiveShadow=true
birthGroup.add(birthMarble)
const birthBurstCount=56
const birthBurstPositions=new Float32Array(birthBurstCount*3)
const birthBurstGeometry=new THREE.BufferGeometry()
birthBurstGeometry.setAttribute('position',new THREE.BufferAttribute(birthBurstPositions,3))
const birthBurstMaterial=new THREE.PointsMaterial({color:0xffd75b,size:1.35,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})
const birthBurst=new THREE.Points(birthBurstGeometry,birthBurstMaterial)
birthBurst.position.copy(birthPosition)
birthBurst.layers.enable(1)
birthGroup.add(birthBurst)
const birthBurstDirections=Array.from({length:birthBurstCount},(_,i)=>{
  const a=i*2.399963229728653
  const y=1-2*(i+.5)/birthBurstCount
  const r=Math.sqrt(Math.max(0,1-y*y))
  return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r)
})
const birthStart=performance.now()/1000
function updateNewMarbleBirth(now){
  const t=now-birthStart
  birthMarble.visible=true
  if(t<.8){
    const u=THREE.MathUtils.smoothstep(t,0,.8)
    birthPoint.visible=true
    birthPoint.scale.setScalar(.8+u*2.8)
    birthLight.intensity=25+210*u
    birthMarble.scale.setScalar(.001)
    birthBurstMaterial.opacity=0
  }else if(t<1.28){
    const u=(t-.8)/.48
    const e=1-Math.pow(1-u,3)
    birthPoint.visible=u<.16
    birthLight.intensity=300*(1-u)+45
    birthMarble.scale.setScalar(Math.max(.001,THREE.MathUtils.smoothstep(u,.08,.78)*controls.TAILLE_BILLES))
    birthBurstMaterial.opacity=Math.sin(Math.PI*u)
    for(let i=0;i<birthBurstCount;i++){
      const d=birthBurstDirections[i]
      const dist=e*(6+(i%8)*.62)
      const j=i*3
      birthBurstPositions[j]=d.x*dist
      birthBurstPositions[j+1]=d.y*dist
      birthBurstPositions[j+2]=d.z*dist
    }
    birthBurstGeometry.attributes.position.needsUpdate=true
  }else{
    birthPoint.visible=false
    birthBurstMaterial.opacity=0
    birthLight.intensity=25
    birthMarble.scale.setScalar(controls.TAILLE_BILLES)
  }
}
"""
s=s.replace(anchor,anchor+code,1)
old="function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);elapsed+=dt;"
new="function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);elapsed+=dt;updateNewMarbleBirth(performance.now()/1000);"
if old not in s: raise SystemExit('animate anchor not found')
s=s.replace(old,new,1)
p.write_text(s)
