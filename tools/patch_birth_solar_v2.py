from pathlib import Path

p = Path('src/main-entity-50.js')
s = p.read_text()

old = '''const birthBurstCount=56
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
})'''
new = '''const solarCoreMaterial=new THREE.MeshBasicMaterial({color:0xfff4b0,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})
const solarCore=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),solarCoreMaterial)
solarCore.position.copy(birthPosition)
solarCore.layers.enable(1)
birthGroup.add(solarCore)
const solarCoronaMaterial=new THREE.MeshBasicMaterial({color:0xffc13b,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})
const solarCorona=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),solarCoronaMaterial)
solarCorona.position.copy(birthPosition)
solarCorona.layers.enable(1)
birthGroup.add(solarCorona)
const solarHaloMaterial=new THREE.MeshBasicMaterial({color:0xff7a18,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})
const solarHalo=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),solarHaloMaterial)
solarHalo.position.copy(birthPosition)
solarHalo.layers.enable(1)
birthGroup.add(solarHalo)'''
if old not in s:
    raise SystemExit('STOP: firework geometry block not found exactly')
s = s.replace(old, new, 1)

old = '''    birthBurstMaterial.opacity=0
    birthMarble.visible=false
    return'''
new = '''    solarCoreMaterial.opacity=0
    solarCoronaMaterial.opacity=0
    solarHaloMaterial.opacity=0
    solarCore.scale.setScalar(.001)
    solarCorona.scale.setScalar(.001)
    solarHalo.scale.setScalar(.001)
    birthMarble.visible=false
    return'''
if old not in s:
    raise SystemExit('STOP: pre-birth reset block not found exactly')
s = s.replace(old, new, 1)

old = '''    birthMarble.scale.setScalar(.001)
    birthBurstMaterial.opacity=0'''
new = '''    birthMarble.scale.setScalar(.001)
    solarCoreMaterial.opacity=.15+.62*u
    solarCoronaMaterial.opacity=.08+.34*u
    solarHaloMaterial.opacity=.03+.16*u
    solarCore.scale.setScalar(.35+1.75*u)
    solarCorona.scale.setScalar(.9+2.7*u)
    solarHalo.scale.setScalar(1.8+4.4*u)'''
if old not in s:
    raise SystemExit('STOP: pre-explosion light block not found exactly')
s = s.replace(old, new, 1)

old = '''  }else if(t<2.28){
    const u=(t-1.8)/.48
    const e=1-Math.pow(1-u,3)
    birthPoint.visible=u<.28
    birthLight.intensity=600*(1-u)+120
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
    const fade=Math.max(0,1-(t-2.5)/2.5)
    birthLight.intensity=120*fade
    birthMarble.scale.setScalar(controls.TAILLE_BILLES)'''
new = '''  }else if(t<4.15){
    const u=(t-1.8)/2.35
    const e=1-Math.pow(1-u,3)
    birthPoint.visible=u<.16
    birthLight.intensity=820*(1-.55*u)+220
    birthMarble.scale.setScalar(Math.max(.001,THREE.MathUtils.smoothstep(u,.04,.52)*controls.TAILLE_BILLES))
    solarCoreMaterial.opacity=.95*(1-u)+.12
    solarCoronaMaterial.opacity=.62*(1-u)+.10
    solarHaloMaterial.opacity=.38*(1-u)+.05
    solarCore.scale.setScalar(2.1+e*2.8)
    solarCorona.scale.setScalar(3.8+e*6.4)
    solarHalo.scale.setScalar(6.3+e*10.5)
  }else{
    birthPoint.visible=false
    const fade=Math.max(0,1-(t-4.15)/3.8)
    solarCoreMaterial.opacity=.12*fade
    solarCoronaMaterial.opacity=.10*fade
    solarHaloMaterial.opacity=.05*fade
    solarCore.scale.setScalar(4.9+2.2*(1-fade))
    solarCorona.scale.setScalar(10.2+4.2*(1-fade))
    solarHalo.scale.setScalar(16.8+6.2*(1-fade))
    birthLight.intensity=220*fade
    birthMarble.scale.setScalar(controls.TAILLE_BILLES)'''
if old not in s:
    raise SystemExit('STOP: firework animation block not found exactly')
s = s.replace(old, new, 1)

p.write_text(s)
