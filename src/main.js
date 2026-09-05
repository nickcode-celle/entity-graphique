import * as THREE from 'three'
import GUI from 'lil-gui'
import './style.css'

const N=200
const app=document.querySelector('#app')
const renderer=new THREE.WebGLRenderer({antialias:true})
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;app.appendChild(renderer.domElement)
const scene=new THREE.Scene();scene.background=new THREE.Color(0x16181b)
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,3000);camera.position.z=350
const group=new THREE.Group();scene.add(group)
const controls={RELATION:55,PORES:1,BRILLANCE:.62,ROTATION:.11,FREQUENCE_INVERSIONS:12,INTENSITE_LUMIERE:3.65,LUMIERE_AMBIANTE:1.90,ECART:28,TAILLE:.90,V1:1,LIBERTE:.15,CHEVAUCHEMENT:1.45,CAMERA:350}
const personality=[0xffe600,0xff6500,0xe5231f,0xa86a12,0x2468d8,0x7137c8,0x5146e5,0x28c95b,0xe95a9d,0x13bfc8]
function randDir(){return new THREE.Vector3(Math.random()*2-1,Math.random()*2-1,Math.random()*2-1).normalize()}
function fib(count,r,phase,rot){const a=[],ga=Math.PI*(3-Math.sqrt(5)),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot));for(let i=0;i<count;i++){const y=1-(i+.5)*2/count,rr=Math.sqrt(1-y*y),t=i*ga+phase,p=new THREE.Vector3(Math.cos(t)*rr,y,Math.sin(t)*rr).multiplyScalar(r).applyQuaternion(q);a.push(p)}return a}
const centers=[new THREE.Vector3(),...fib(12,.95,.18,[.22,-.14,.31]),...fib(32,1.58,1.07,[-.31,.27,.11]),...fib(56,2.18,2.16,[.17,.39,-.26]),...fib(99,2.82,2.91,[-.21,-.28,.37])]

// Gastronomie : carte couleur + relief haute définition. La bille reste sphérique ; les pores sont creusés visuellement.
function makePoreMaps(size=1024){const h=document.createElement('canvas'),c=document.createElement('canvas');h.width=h.height=c.width=c.height=size;const hg=h.getContext('2d'),cg=c.getContext('2d');hg.fillStyle='#b8b8b8';hg.fillRect(0,0,size,size);cg.fillStyle='#ffffff';cg.fillRect(0,0,size,size)
const pores=[];let seed=173
function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
for(let i=0;i<115;i++)pores.push({x:rnd()*size,y:rnd()*size,r:(.010+rnd()*.026)*size})
for(const p of pores){for(const ox of [-size,0,size]){const x=p.x+ox,y=p.y,r=p.r
let g=hg.createRadialGradient(x-r*.18,y-r*.18,r*.08,x,y,r);g.addColorStop(0,'#080808');g.addColorStop(.50,'#181818');g.addColorStop(.76,'#555555');g.addColorStop(.91,'#d8d8d8');g.addColorStop(1,'#b8b8b8');hg.fillStyle=g;hg.beginPath();hg.arc(x,y,r,0,Math.PI*2);hg.fill()
let col=cg.createRadialGradient(x-r*.12,y-r*.12,r*.06,x,y,r);col.addColorStop(0,'#090909');col.addColorStop(.48,'#101010');col.addColorStop(.70,'#292929');col.addColorStop(.84,'#777777');col.addColorStop(.94,'#d8d8d8');col.addColorStop(1,'#ffffff');cg.fillStyle=col;cg.beginPath();cg.arc(x,y,r,0,Math.PI*2);cg.fill()}}
}
// micro-grain entre les cavités
const img=hg.getImageData(0,0,size,size),d=img.data;for(let i=0;i<d.length;i+=4){const n=(rnd()-.5)*22;d[i]=d[i+1]=d[i+2]=THREE.MathUtils.clamp(d[i]+n,0,255)}hg.putImageData(img,0,0)
const bump=new THREE.CanvasTexture(h),map=new THREE.CanvasTexture(c);for(const t of [bump,map]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy())}map.colorSpace=THREE.SRGBColorSpace;bump.colorSpace=THREE.NoColorSpace;return{bump,map}}
const poreMaps=makePoreMaps()
const geometry=new THREE.SphereGeometry(6,64,48)
const materials=[],marbles=[],travel=[],dirs=[],targets=[],clocks=[]
const speedVar=Array.from({length:N},()=>.8+Math.random()*.4),mean=speedVar.reduce((a,b)=>a+b,0)/N;speedVar.forEach((_,i)=>speedVar[i]/=mean)
for(let i=0;i<N;i++){const base=new THREE.Color(personality[i%10]),h={};base.getHSL(h);base.setHSL(h.h,.82,h.l);const m=new THREE.MeshStandardMaterial({color:base,map:poreMaps.map,bumpMap:poreMaps.bump,bumpScale:1.15,roughness:.34,metalness:.02});m.userData.baseRoughness=.34;materials.push(m);const mesh=new THREE.Mesh(geometry,m);mesh.scale.setScalar(controls.TAILLE);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);marbles.push(mesh);travel.push(new THREE.Vector3());dirs.push(randDir());targets.push(randDir());clocks.push(Math.random()*2.5)}
const hemi=new THREE.HemisphereLight(0xffffff,0x30343b,controls.LUMIERE_AMBIANTE);scene.add(hemi)
const light=new THREE.SpotLight(0xffffff,controls.INTENSITE_LUMIERE,0,Math.PI/3.2,.55,0);light.castShadow=true;light.shadow.mapSize.set(4096,4096);light.shadow.bias=-.00015;light.shadow.normalBias=.015;light.shadow.radius=3;light.target.position.set(0,0,0);scene.add(light,light.target)
function updateLight(){light.position.copy(camera.position).add(new THREE.Vector3(42,28,0))}
function layout(){for(let i=0;i<N;i++){marbles[i].scale.setScalar(controls.TAILLE);marbles[i].position.copy(centers[i]).multiplyScalar(controls.ECART).add(travel[i])}}layout();updateLight()
function updatePores(){for(const m of materials){m.bumpScale=1.15*controls.PORES;m.map=poreMaps.map;m.needsUpdate=true}}
function updateShine(){for(const m of materials)m.roughness=THREE.MathUtils.clamp(1-controls.BRILLANCE-.04,.08,.9)}
const gui=new GUI({title:'ENTITY — TEST GASTRONOMIE / PORES'});gui.add(controls,'PORES',0,2,.05).name('INTENSITÉ PORES').onChange(updatePores);gui.add(controls,'RELATION',0,100,1).name('RELATION GLOBALE %');gui.add(controls,'ROTATION',0,2,.01).name('V2 — VITESSE ROTATION');gui.add(controls,'FREQUENCE_INVERSIONS',0,12,.1).name('FREQUENCE INVERSIONS / MIN');gui.add(controls,'BRILLANCE',0,1,.01).name('BRILLANCE BILLES').onChange(updateShine);gui.add(controls,'INTENSITE_LUMIERE',0,6,.05).name('INTENSITÉ LUMIÈRE').onChange(v=>light.intensity=v);gui.add(controls,'LUMIERE_AMBIANTE',0,3,.05).name('LUMIÈRE AMBIANTE').onChange(v=>hemi.intensity=v);gui.add(controls,'ECART',13,28,.25).name('TAILLE / ECART').onChange(layout);gui.add(controls,'TAILLE',.4,1.8,.02).name('TAILLE BILLES').onChange(layout);gui.add(controls,'V1',0,3,.05).name('V1 — VIE INTERNE');gui.add(controls,'LIBERTE',.05,.45,.01).name('LIBERTE CELLULE');gui.add(controls,'CHEVAUCHEMENT',1,1.8,.05).name('CHEVAUCHEMENT');gui.add(controls,'CAMERA',120,800,5).name('CAMERA').onChange(v=>{camera.position.z=v;updateLight()})
const tag=document.createElement('div');tag.textContent='ENTITY — GOÛTS : TEST GASTRONOMIE / PORES';Object.assign(tag.style,{position:'fixed',left:'14px',bottom:'12px',color:'rgba(255,255,255,.65)',font:'12px Arial'});document.body.appendChild(tag)
const clock=new THREE.Clock(),inward=new THREE.Vector3(),steer=new THREE.Vector3(),axis=randDir(),axisTarget=randDir(),dq=new THREE.Quaternion();let axisClock=8+Math.random()*8,sense=1
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04),maxR=controls.ECART*controls.LIBERTE*controls.CHEVAUCHEMENT,global=controls.V1*controls.ECART*.42*(1+controls.RELATION/100);for(let i=0;i<N;i++){const sp=global*speedVar[i];clocks[i]-=dt;if(clocks[i]<=0){clocks[i]=.8+Math.random()*2.4;targets[i].lerp(randDir(),.65).normalize()}const d=travel[i].length(),q=maxR?d/maxR:0,ret=THREE.MathUtils.smoothstep(q,.55,1);inward.copy(travel[i]);if(inward.lengthSq()>.000001)inward.normalize().multiplyScalar(-1);else inward.set(0,0,0);steer.copy(targets[i]).multiplyScalar(.30).addScaledVector(inward,ret*1.55);dirs[i].addScaledVector(steer,dt).normalize();travel[i].addScaledVector(dirs[i],sp*dt);if(travel[i].length()>maxR){travel[i].setLength(maxR);dirs[i].lerp(inward,.06).normalize()}marbles[i].position.copy(centers[i]).multiplyScalar(controls.ECART).add(travel[i])}axisClock-=dt;if(axisClock<=0){axisClock=8+Math.random()*10;axisTarget.copy(randDir());if(axisTarget.dot(axis)<-.7)axisTarget.multiplyScalar(-1)}axis.lerp(axisTarget,1-Math.exp(-dt*.22)).normalize();if(Math.random()<1-Math.exp(-(controls.FREQUENCE_INVERSIONS/60)*dt))sense*=-1;dq.setFromAxisAngle(axis,controls.ROTATION*sense*dt);group.quaternion.premultiply(dq).normalize();updateLight();renderer.render(scene,camera)}animate()
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})
