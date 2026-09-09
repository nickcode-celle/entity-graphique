from pathlib import Path

p=Path('src/main-entity-50.js')
s=p.read_text()
anchor="const entityGroup=new THREE.Group()\nscene.add(entityGroup)"
if anchor not in s:
    raise SystemExit('entityGroup anchor not found')
if '// NEW MARBLE BIRTH TEST' in s:
    raise SystemExit('birth effect already present')

code='''

// NEW MARBLE BIRTH TEST — a fixed light point bursts and gives birth to one real 3D golden marble.
const birthGroup=new THREE.Group()
scene.add(birthGroup)
const birthPosition=new THREE.Vector3(72,8,18)
const birthPointMaterial=new THREE.MeshBasicMaterial({color:0xfff3a0,transparent:true,opacity:1})
const birthPoint=new THREE.Mesh(new THREE.SphereGeometry(.16,20,20),birthPointMaterial)
birthPoint.position.copy(birthPosition)
birthPoint.layers.enable(1)
birthGroup.add(birthPoint)
const birthLight=new THREE.PointLight(0xffd45a,0,80,2)
birthLight.position.copy(birthPosition)
scene.add(birthLight)
const birthMarbleMaterial=new THREE.MeshStandardMaterial({color:0xd9a51f,metalness:.78,roughness:.18,emissive:0x8b5a00,emissiveIntensity:.18})
const birthMarble=new THREE.Mesh(new THREE.SphereGeometry(3.35,48,48),birthMarbleMaterial)
birthMarble.position.copy(birthPosition)
birthMarble.scale.setScalar(.001)
birthMarble.castShadow=true
birthMarble.receiveShadow=true
birthGroup.add(birthMarble)
const burstCount=42
const burstGeometry=new THREE.BufferGeometry()
const burstPositions=new Float32Array(burstCount*3)
burstGeometry.setAttribute('position',new THREE.BufferAttribute(burstPositions,3))
const burstMaterial=new THREE.PointsMaterial({color:0xffd85a,size:1.15,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})
const burstPoints=new THREE.Points(burstGeometry,burstMaterial)
burstPoints.position.copy(birthPosition)
burstPoints.layers.enable(1)
birthGroup.add(burstPoints)
const burstDirections=Array.from({length:burstCount},(_,i)=>{const a=i*2.399963229728653,y=1-2*(i+.5)/burstCount,r=Math.sqrt(Math.max(0,1-y*y));return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r)})
let birthStartedAt=performance.now()/1000
function updateNewMarbleBirth(now){
  const t=now-birthStartedAt
  if(t<.8){
    const u=THREE.MathUtils.smoothstep(t,0,.8)
    birthPoint.visible=true;birthPoint.scale.setScalar(.8+u*2.4);birthPointMaterial.opacity=.65+.35*u
    birthLight.intensity=20+180*u;birthMarble.scale.setScalar(.001);burstMaterial.opacity=0
    return
  }
  if(t<1.25){
    const u=(t-.8)/.45,e=1-Math.pow(1-u,3)
    birthPoint.visible=u<.22;birthLight.intensity=260*(1-u)+55
    birthMarble.scale.setScalar(Math.max(.001,THREE.MathUtils.smoothstep(u,.08,.82)))
    burstMaterial.opacity=Math.sin(Math.PI*u)*.95
    for(let i=0;i<burstCount;i++){
      const d=burstDirections[i],dist=e*(5.5+(i%7)*.55),j=i*3
      burstPositions[j]=d.x*dist;burstPositions[j+1]=d.y*dist;burstPositions[j+2]=d.z*dist
    }
    burstGeometry.attributes.position.needsUpdate=true
    return
  }
  if(t<4.25){
    birthPoint.visible=false;burstMaterial.opacity=0;birthLight.intensity=35;birthMarble.scale.setScalar(1)
    return
  }
  birthPoint.visible=false;burstMaterial.opacity=0;birthLight.intensity=18;birthMarble.scale.setScalar(1)
}
'''

s=s.replace(anchor,anchor+code,1)
for candidate in ['function animate(){','function animate() {']:
    if candidate in s:
        s=s.replace(candidate,candidate+'\n  updateNewMarbleBirth(performance.now()/1000)',1)
        break
else:
    raise SystemExit('animate function anchor not found')
p.write_text(s)
