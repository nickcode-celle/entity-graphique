export function createNewMarbleBirth(THREE,scene,bloomLayer){
  const group=new THREE.Group()
  scene.add(group)

  const position=new THREE.Vector3(72,8,18)

  const pointMaterial=new THREE.MeshBasicMaterial({color:0xfff3a0,transparent:true,opacity:1})
  const point=new THREE.Mesh(new THREE.SphereGeometry(.16,20,20),pointMaterial)
  point.position.copy(position)
  point.layers.enable(bloomLayer)
  group.add(point)

  const light=new THREE.PointLight(0xffd45a,0,80,2)
  light.position.copy(position)
  scene.add(light)

  const marbleMaterial=new THREE.MeshStandardMaterial({
    color:0xd9a51f,
    metalness:.78,
    roughness:.18,
    emissive:0x8b5a00,
    emissiveIntensity:.18
  })
  const marble=new THREE.Mesh(new THREE.SphereGeometry(3.35,48,48),marbleMaterial)
  marble.position.copy(position)
  marble.scale.setScalar(.001)
  marble.castShadow=true
  marble.receiveShadow=true
  group.add(marble)

  const burstCount=42
  const burstGeometry=new THREE.BufferGeometry()
  const burstPositions=new Float32Array(burstCount*3)
  burstGeometry.setAttribute('position',new THREE.BufferAttribute(burstPositions,3))
  const burstMaterial=new THREE.PointsMaterial({
    color:0xffd85a,
    size:1.15,
    transparent:true,
    opacity:0,
    depthWrite:false,
    blending:THREE.AdditiveBlending
  })
  const burst=new THREE.Points(burstGeometry,burstMaterial)
  burst.position.copy(position)
  burst.layers.enable(bloomLayer)
  group.add(burst)

  const directions=Array.from({length:burstCount},(_,i)=>{
    const a=i*2.399963229728653
    const y=1-2*(i+.5)/burstCount
    const r=Math.sqrt(Math.max(0,1-y*y))
    return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r)
  })

  const startedAt=performance.now()/1000

  function update(now){
    const t=now-startedAt

    if(t<.8){
      const u=THREE.MathUtils.smoothstep(t,0,.8)
      point.visible=true
      point.scale.setScalar(.8+u*2.4)
      pointMaterial.opacity=.65+.35*u
      light.intensity=20+180*u
      marble.scale.setScalar(.001)
      burstMaterial.opacity=0
      return
    }

    if(t<1.25){
      const u=(t-.8)/.45
      const e=1-Math.pow(1-u,3)
      point.visible=u<.22
      light.intensity=260*(1-u)+55
      marble.scale.setScalar(Math.max(.001,THREE.MathUtils.smoothstep(u,.08,.82)))
      burstMaterial.opacity=Math.sin(Math.PI*u)*.95
      for(let i=0;i<burstCount;i++){
        const d=directions[i]
        const dist=e*(5.5+(i%7)*.55)
        const j=i*3
        burstPositions[j]=d.x*dist
        burstPositions[j+1]=d.y*dist
        burstPositions[j+2]=d.z*dist
      }
      burstGeometry.attributes.position.needsUpdate=true
      return
    }

    if(t<4.25){
      point.visible=false
      burstMaterial.opacity=0
      light.intensity=35
      marble.scale.setScalar(1)
      return
    }

    point.visible=false
    burstMaterial.opacity=0
    light.intensity=18
    marble.scale.setScalar(1)
  }

  return {group,point,marble,light,burst,update}
}
