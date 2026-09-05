import * as THREE from 'three'
import './style.css'

const app=document.querySelector('#app')
const renderer=new THREE.WebGLRenderer({antialias:true})
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight)
renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08
app.appendChild(renderer.domElement)
const scene=new THREE.Scene();scene.background=new THREE.Color(0x08090b)
const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,100);camera.position.z=18
const root=new THREE.Group();scene.add(root)
const RED=0xe5231f
const material=()=>new THREE.MeshPhysicalMaterial({color:RED,roughness:.3,metalness:.01,clearcoat:.55,clearcoatRoughness:.2})

// Seulement les 8 signatures pour lesquelles nous avons retenu une méthode standard existante.
const specs=[
 ['1. MUSIQUE','ONDES','wave'],
 ['2. CINÉMA','FACETTES','facets'],
 ['4. CULTURE','RÉSEAU','network'],
 ['5. GASTRONOMIE','PEAU D’AGRUME','orange'],
 ['6. LIEUX','RELIEF TOPOGRAPHIQUE','terrain'],
 ['7. ACTIVITÉS','STRIES','stripes'],
 ['9. NATURE','CELLULES ORGANIQUES','cells'],
 ['10. SENSATIONS','RELIEF MOU','soft']
]
const fract=x=>x-Math.floor(x)
const hash=(x,y,z)=>fract(Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453)
function noise(x,y,z){const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),fx=x-X,fy=y-Y,fz=z-Z;const s=t=>t*t*(3-2*t),sx=s(fx),sy=s(fy),sz=s(fz),h=(a,b,c)=>hash(X+a,Y+b,Z+c);const a=THREE.MathUtils.lerp(h(0,0,0),h(1,0,0),sx),b=THREE.MathUtils.lerp(h(0,1,0),h(1,1,0),sx),c=THREE.MathUtils.lerp(h(0,0,1),h(1,0,1),sx),d=THREE.MathUtils.lerp(h(0,1,1),h(1,1,1),sx);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a,b,sy),THREE.MathUtils.lerp(c,d,sy),sz)*2-1}
function fbm(x,y,z,o=4){let v=0,a=.5,f=1;for(let i=0;i<o;i++){v+=a*noise(x*f,y*f,z*f);a*=.5;f*=2}return v}
function vorEdge(x,y,z,s=4){x*=s;y*=s;z*=s;const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z);let d1=99,d2=99;for(let k=-1;k<=1;k++)for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const a=X+i,b=Y+j,c=Z+k,px=a+hash(a,b,c),py=b+hash(b,c,a),pz=c+hash(c,a,b),d=(x-px)**2+(y-py)**2+(z-pz)**2;if(d<d1){d2=d1;d1=d}else if(d<d2)d2=d}return Math.sqrt(d2)-Math.sqrt(d1)}
function displaced(fn,segments=112){const g=new THREE.SphereGeometry(1.12,segments,Math.floor(segments*.75)),p=g.attributes.position,n=new THREE.Vector3();for(let i=0;i<p.count;i++){n.set(p.getX(i),p.getY(i),p.getZ(i)).normalize();const d=fn(n);p.setXYZ(i,n.x*(1.12+d),n.y*(1.12+d),n.z*(1.12+d))}p.needsUpdate=true;g.computeVertexNormals();return g}
function geometry(kind){
 if(kind==='facets') return new THREE.IcosahedronGeometry(1.14,3)
 if(kind==='wave') return displaced(n=>{const t=Math.acos(n.y),p=Math.atan2(n.z,n.x);return .045*Math.sin(t*18+p*2)})
 if(kind==='network') return displaced(n=>.055*Math.max(0,.12-vorEdge(n.x,n.y,n.z,3.5)*1.8))
 if(kind==='orange') return displaced(n=>.018*fbm(n.x*18,n.y*18,n.z*18,3))
 if(kind==='terrain') return displaced(n=>.075*fbm(n.x*2.8,n.y*2.8,n.z*2.8,5))
 if(kind==='stripes') return displaced(n=>.035*Math.sin((Math.atan2(n.z,n.x)+Math.acos(n.y)*.3)*24))
 if(kind==='cells') return displaced(n=>.045*Math.max(0,.14-vorEdge(n.x,n.y,n.z,4.2)*2.1))
 return displaced(n=>.09*fbm(n.x*.95,n.y*.95,n.z*.95,4))
}
const xs=[-4.5,-1.5,1.5,4.5],ys=[2.15,-2.15],meshes=[]
specs.forEach((s,i)=>{const m=new THREE.Mesh(geometry(s[2]),material());m.position.set(xs[i%4],ys[Math.floor(i/4)],0);m.castShadow=m.receiveShadow=true;if(s[2]==='facets')m.material.flatShading=true;root.add(m);meshes.push(m)})
scene.add(new THREE.HemisphereLight(0xffffff,0x111318,1.5));const key=new THREE.DirectionalLight(0xffffff,4);key.position.set(6,8,10);scene.add(key);const rim=new THREE.PointLight(0xff3020,2.2,40);rim.position.set(-8,-2,5);scene.add(rim)
const title=document.createElement('div');title.innerHTML='<b>ENTITY — 8 MÉTHODES APPLICABLES</b><span>Les deux signatures non validées ont été retirées</span>';Object.assign(title.style,{position:'fixed',top:'18px',left:'50%',transform:'translateX(-50%)',color:'#fff',font:'14px Arial',letterSpacing:'.12em',textAlign:'center'});title.querySelector('span').style.cssText='display:block;margin-top:6px;font-size:10px;opacity:.55';document.body.appendChild(title)
const labels=[];specs.forEach(s=>{const d=document.createElement('div');d.innerHTML=`<b>${s[0]}</b><span>${s[1]}</span>`;Object.assign(d.style,{position:'fixed',color:'#fff',font:'10px Arial',textAlign:'center',transform:'translate(-50%,0)',whiteSpace:'nowrap'});d.querySelector('span').style.cssText='display:block;margin-top:3px;font-size:9px;opacity:.55';document.body.appendChild(d);labels.push(d)})
const v=new THREE.Vector3(),clock=new THREE.Clock();function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);meshes.forEach((m,i)=>{m.rotation.y+=dt*(.1+i*.008);m.rotation.x+=dt*.02;v.copy(m.position).add(new THREE.Vector3(0,-1.5,0)).project(camera);labels[i].style.left=`${(v.x*.5+.5)*innerWidth}px`;labels[i].style.top=`${(-v.y*.5+.5)*innerHeight}px`});renderer.render(scene,camera)}animate()
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})
