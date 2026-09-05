import * as THREE from 'three'
import './style.css'

const app=document.querySelector('#app')
const renderer=new THREE.WebGLRenderer({antialias:true})
renderer.setPixelRatio(Math.min(devicePixelRatio,2))
renderer.setSize(innerWidth,innerHeight)
renderer.shadowMap.enabled=true
renderer.shadowMap.type=THREE.PCFSoftShadowMap
renderer.outputColorSpace=THREE.SRGBColorSpace
renderer.toneMapping=THREE.ACESFilmicToneMapping
renderer.toneMappingExposure=1.12
app.appendChild(renderer.domElement)

const scene=new THREE.Scene()
scene.background=new THREE.Color(0x0a0b0e)
const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,100)
camera.position.set(0,0,18)

const root=new THREE.Group()
scene.add(root)

const red=new THREE.MeshPhysicalMaterial({
  color:0xe5231f,
  roughness:.22,
  metalness:.015,
  clearcoat:.72,
  clearcoatRoughness:.16
})

const labels=[
  ['1. MUSIQUE','ONDES'],
  ['2. CINÉMA','FACETTES'],
  ['3. ARTS','PLIS DOUX'],
  ['4. CULTURE','RÉSEAU'],
  ['5. GASTRONOMIE','PEAU D’AGRUME'],
  ['6. LIEUX','RELIEF TOPOGRAPHIQUE'],
  ['7. ACTIVITÉS','STRIES'],
  ['8. ARCHITECTURE','ÉCAILLES'],
  ['9. NATURE','CELLULES ORGANIQUES'],
  ['10. SENSATIONS','RELIEF MOU']
]

const fract=x=>x-Math.floor(x)
const hash=(x,y,z)=>fract(Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453)
function noise3(x,y,z){
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z)
  const fx=x-ix,fy=y-iy,fz=z-iz
  const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),sz=fz*fz*(3-2*fz)
  const h=(a,b,c)=>hash(ix+a,iy+b,iz+c)
  const x00=THREE.MathUtils.lerp(h(0,0,0),h(1,0,0),sx)
  const x10=THREE.MathUtils.lerp(h(0,1,0),h(1,1,0),sx)
  const x01=THREE.MathUtils.lerp(h(0,0,1),h(1,0,1),sx)
  const x11=THREE.MathUtils.lerp(h(0,1,1),h(1,1,1),sx)
  const y0=THREE.MathUtils.lerp(x00,x10,sy),y1=THREE.MathUtils.lerp(x01,x11,sy)
  return THREE.MathUtils.lerp(y0,y1,sz)*2-1
}
function fbm(x,y,z,oct=4){
  let a=.5,f=1,v=0
  for(let i=0;i<oct;i++){v+=a*noise3(x*f,y*f,z*f);f*=2.03;a*=.5}
  return v
}
function voronoiEdge(x,y,z,scale=3){
  x*=scale;y*=scale;z*=scale
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z)
  let d1=99,d2=99
  for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const cx=ix+dx,cy=iy+dy,cz=iz+dz
    const px=cx+hash(cx,cy,cz),py=cy+hash(cy,cz,cx),pz=cz+hash(cz,cx,cy)
    const d=(x-px)**2+(y-py)**2+(z-pz)**2
    if(d<d1){d2=d1;d1=d}else if(d<d2)d2=d
  }
  return Math.sqrt(d2)-Math.sqrt(d1)
}

function displacement(type,n,p){
  const {x,y,z}=n
  const phi=Math.atan2(z,x)
  const theta=Math.acos(THREE.MathUtils.clamp(y,-1,1))
  switch(type){
    case 0: return .11*Math.sin(theta*11+1.8*Math.sin(phi*3))+.035*Math.sin(phi*8)
    case 1: return .055*(Math.round((fbm(x*2.2,y*2.2,z*2.2,2)+1)*3)/3-.5)
    case 2: return .12*fbm(x*1.5,y*3.2,z*1.5,3)
    case 3: {
      const e=voronoiEdge(x,y,z,3.6)
      return .095*Math.max(0,.18-e*2.2)
    }
    case 4: return .032*fbm(x*14,y*14,z*14,3)
    case 5: return .13*fbm(x*2.4,y*2.4,z*2.4,5)
    case 6: return .085*Math.sin(phi*18+theta*4+fbm(x*2,y*2,z*2,2)*2)
    case 7: {
      const a=Math.sin(theta*10+phi*2)
      return .075*Math.pow(Math.max(0,a),3)
    }
    case 8: {
      const e=voronoiEdge(x,y,z,4.5)
      return .07*Math.max(0,.15-e*2.6)
    }
    case 9: return .16*fbm(x*.9,y*.9,z*.9,4)
    default:return 0
  }
}

function makeSphere(type){
  const g=new THREE.SphereGeometry(1.15,128,96)
  const pos=g.attributes.position
  const n=new THREE.Vector3()
  for(let i=0;i<pos.count;i++){
    n.set(pos.getX(i),pos.getY(i),pos.getZ(i)).normalize()
    const d=displacement(type,n,n)
    pos.setXYZ(i,n.x*(1.15+d),n.y*(1.15+d),n.z*(1.15+d))
  }
  pos.needsUpdate=true
  g.computeVertexNormals()
  const m=new THREE.Mesh(g,red.clone())
  m.castShadow=m.receiveShadow=true
  return m
}

const xs=[-5.2,-2.6,0,2.6,5.2]
const ys=[2.2,-2.1]
const meshes=[]
for(let i=0;i<10;i++){
  const mesh=makeSphere(i)
  mesh.position.set(xs[i%5],ys[Math.floor(i/5)],0)
  mesh.rotation.set(.22*(i%3),.35*i,.1*(i%2))
  root.add(mesh)
  meshes.push(mesh)
}

const hemi=new THREE.HemisphereLight(0xffffff,0x101216,1.5)
scene.add(hemi)
const key=new THREE.DirectionalLight(0xffffff,4.1)
key.position.set(6,8,10);key.castShadow=true
key.shadow.mapSize.set(2048,2048)
scene.add(key)
const fill=new THREE.PointLight(0xff5a46,1.25,40)
fill.position.set(-8,2,8);scene.add(fill)
const rim=new THREE.PointLight(0xff2018,2.0,40)
rim.position.set(8,-2,-3);scene.add(rim)

const title=document.createElement('div')
title.innerHTML='<b>ENTITY — 10 TEXTURES 3D</b><span>Une seule sphère de base · relief géométrique réel</span>'
Object.assign(title.style,{position:'fixed',top:'18px',left:'50%',transform:'translateX(-50%)',color:'#fff',font:'14px Arial',letterSpacing:'.12em',textAlign:'center'})
title.querySelector('span').style.cssText='display:block;margin-top:6px;font-size:11px;opacity:.55;letter-spacing:.08em'
document.body.appendChild(title)

const labelNodes=[]
for(let i=0;i<10;i++){
  const d=document.createElement('div')
  d.innerHTML=`<b>${labels[i][0]}</b><span>${labels[i][1]}</span>`
  Object.assign(d.style,{position:'fixed',color:'white',font:'11px Arial',letterSpacing:'.07em',textAlign:'center',pointerEvents:'none',transform:'translate(-50%,0)',whiteSpace:'nowrap'})
  d.querySelector('span').style.cssText='display:block;margin-top:3px;font-size:9px;opacity:.58;letter-spacing:.09em'
  document.body.appendChild(d);labelNodes.push(d)
}

function updateLabels(){
  const v=new THREE.Vector3()
  for(let i=0;i<10;i++){
    v.copy(meshes[i].position).add(new THREE.Vector3(0,-1.55,0)).project(camera)
    labelNodes[i].style.left=`${(v.x*.5+.5)*innerWidth}px`
    labelNodes[i].style.top=`${(-v.y*.5+.5)*innerHeight}px`
  }
}

const clock=new THREE.Clock()
function animate(){
  requestAnimationFrame(animate)
  const dt=Math.min(clock.getDelta(),.04)
  meshes.forEach((m,i)=>{m.rotation.y+=dt*(.12+.012*i);m.rotation.x+=dt*.025})
  updateLabels()
  renderer.render(scene,camera)
}
animate()

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth,innerHeight)
})
