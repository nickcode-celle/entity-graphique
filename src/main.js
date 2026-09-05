import * as THREE from 'three'
import GUI from 'lil-gui'
import './style.css'

const N=200,R=6
const app=document.querySelector('#app')
const renderer=new THREE.WebGLRenderer({antialias:true})
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;app.appendChild(renderer.domElement)
const scene=new THREE.Scene();scene.background=new THREE.Color(0x16181b)
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,3000);camera.position.z=350
const entityGroup=new THREE.Group();scene.add(entityGroup)
const controls={RELATION:55,BRILLANCE:.62,ROTATION:.11,FREQUENCE_INVERSIONS:12,INTENSITE_LUMIERE:3.65,LUMIERE_AMBIANTE:1.90,ECART:28,TAILLE:.90,V1:1,LIBERTE:.15,CHEVAUCHEMENT:1.45,CAMERA:350}
const personality=[0xffe600,0xff6500,0xe5231f,0xa86a12,0x2468d8,0x7137c8,0x5146e5,0x28c95b,0xe95a9d,0x13bfc8]
const tasteNames=['Musique','Cinéma / fiction','Arts / esthétique','Culture / idées','Gastronomie / saveurs','Lieux / atmosphères','Activités / expériences','Architecture / design','Nature / vivant','Sensations / ambiances']
const tasteLevels=[50,50,50,50,50,50,50,50,50,50]
function randDir(){return new THREE.Vector3(Math.random()*2-1,Math.random()*2-1,Math.random()*2-1).normalize()}
function fib(count,r,phase,rot){const a=[],ga=Math.PI*(3-Math.sqrt(5)),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot));for(let i=0;i<count;i++){const y=1-(i+.5)*2/count,rr=Math.sqrt(1-y*y),t=i*ga+phase,p=new THREE.Vector3(Math.cos(t)*rr,y,Math.sin(t)*rr).multiplyScalar(r).applyQuaternion(q);a.push(p)}return a}
const centers=[new THREE.Vector3(),...fib(12,.95,.18,[.22,-.14,.31]),...fib(32,1.58,1.07,[-.31,.27,.11]),...fib(56,2.18,2.16,[.17,.39,-.26]),...fib(99,2.82,2.91,[-.21,-.28,.37])]

function seeded(seed=1){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
function deform(fn,detail=4){const g=new THREE.IcosahedronGeometry(R,detail),p=g.attributes.position,v=new THREE.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const n=v.clone().normalize(),phi=Math.atan2(n.z,n.x),theta=Math.acos(THREE.MathUtils.clamp(n.y,-1,1));v.copy(n).multiplyScalar(R+fn(n,phi,theta));p.setXYZ(i,v.x,v.y,v.z)}p.needsUpdate=true;g.computeVertexNormals();return g}
const neutralGeo=new THREE.IcosahedronGeometry(R,4)
const master=[]
// 1 Musique : véritables ondes concentriques qui parcourent la surface.
master[0]=deform((n,p,t)=>.46*Math.sin(11*t+3*Math.sin(p*2))+.12*Math.sin(23*t+p*4),4)
// 2 Cinéma : facettes franches, géométrie volontairement polygonale.
master[1]=new THREE.IcosahedronGeometry(R,2);master[1].computeVertexNormals()
// 3 Arts : plis courbes croisés, continus et irréguliers.
master[2]=deform((n,p,t)=>.34*Math.sin(6*p+2.4*Math.sin(t*3))+.24*Math.sin(9*t-2*p),4)
// 4 Culture : cœur sphérique + réseau tubulaire réel (créé plus bas).
master[3]=new THREE.IcosahedronGeometry(R*.94,3)
// 5 Gastronomie : cavités réellement inscrites dans la géométrie par champs sphériques.
const poreRnd=seeded(505),pores=Array.from({length:32},()=>({d:randDir(),a:.10+poreRnd()*.13,depth:.55+poreRnd()*.85}))
master[4]=deform(n=>{let d=0;for(const q of pores){const a=Math.acos(THREE.MathUtils.clamp(n.dot(q.d),-1,1));if(a<q.a){const x=a/q.a;d-=q.depth*Math.pow(.5+.5*Math.cos(Math.PI*x),1.35)}}return d},5)
// 6 Lieux : relief topographique multi-échelle.
master[5]=deform((n,p,t)=>.30*Math.sin(p*5+t*4)+.20*Math.sin(p*11-t*7)+.11*Math.sin(p*23+t*17),4)
// 7 Activités : sillons hélicoïdaux profonds.
master[6]=deform((n,p,t)=>-.48*Math.pow(Math.max(0,Math.cos(9*p+5*t)),8)+.10*Math.sin(18*p+10*t),4)
// 8 Architecture : base sphérique, écailles 3D ajoutées comme éléments réels.
master[7]=new THREE.IcosahedronGeometry(R*.92,3)
// 9 Nature : base organique, ramifications 3D ajoutées comme tubes.
master[8]=deform((n,p,t)=>.10*Math.sin(p*7+t*5)+.08*Math.sin(p*15-t*9),3)
// 10 Sensations : bosses molles intégrées à la surface.
const blobDirs=[new THREE.Vector3(1,.2,.1).normalize(),new THREE.Vector3(-.4,.8,.2).normalize(),new THREE.Vector3(.1,-.7,.7).normalize(),new THREE.Vector3(-.7,-.3,-.5).normalize(),new THREE.Vector3(.5,.5,-.7).normalize()]
master[9]=deform(n=>blobDirs.reduce((s,d)=>s+.75*Math.pow(Math.max(0,n.dot(d)),8),0)-.08,4)

function mat(color,flat=false){return new THREE.MeshPhysicalMaterial({color,roughness:.34,metalness:.02,clearcoat:.32,clearcoatRoughness:.28,flatShading:flat})}
function orientOnSphere(obj,n){obj.position.copy(n).multiplyScalar(R*.98);obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),n)}
function addNetwork(root,material,seed){const rnd=seeded(seed);for(let k=0;k<7;k++){const pts=[];let a=randDir();for(let j=0;j<5;j++){a=a.clone().add(randDir().multiplyScalar(.35)).normalize();pts.push(a.clone().multiplyScalar(R*1.015))}const curve=new THREE.CatmullRomCurve3(pts,false,'centripetal');const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,32,.11,7,false),material);tube.castShadow=tube.receiveShadow=true;root.add(tube)}for(let k=0;k<12;k++){const n=randDir(),node=new THREE.Mesh(new THREE.SphereGeometry(.22+rnd()*.12,10,8),material);node.position.copy(n).multiplyScalar(R*1.02);root.add(node)}}
function addScales(root,material){const pts=fib(42,R*1.01,.4,[.2,.1,-.2]);for(const p of pts){const n=p.clone().normalize(),s=new THREE.Mesh(new THREE.SphereGeometry(.72,14,8,0,Math.PI*2,0,Math.PI*.52),material);s.scale.set(1,.22,1.35);orientOnSphere(s,n);s.rotateY((n.x+n.z)*2.4);s.castShadow=s.receiveShadow=true;root.add(s)}}
function addBranches(root,material){const rnd=seeded(909);for(let b=0;b<9;b++){const start=randDir(),pts=[];let n=start.clone();for(let j=0;j<6;j++){n=n.clone().add(randDir().multiplyScalar(.20)).normalize();pts.push(n.clone().multiplyScalar(R*1.02))}const curve=new THREE.CatmullRomCurve3(pts,false,'centripetal');const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,36,.10+rnd()*.06,7,false),material);tube.castShadow=tube.receiveShadow=true;root.add(tube)}}
function makeMarble(kind,color){const root=new THREE.Group(),material=mat(color,kind===1),body=new THREE.Mesh(kind<0?neutralGeo:master[kind],material);body.castShadow=body.receiveShadow=true;root.add(body);if(kind===3)addNetwork(root,material,404);if(kind===7)addScales(root,material);if(kind===8)addBranches(root,material);root.userData.material=material;return root}

const marbles=[],travel=[],dirs=[],targets=[],clocks=[],materials=[]
const speedVar=Array.from({length:N},()=>.8+Math.random()*.4),mean=speedVar.reduce((a,b)=>a+b,0)/N;speedVar.forEach((_,i)=>speedVar[i]/=mean)
// 20 billes par sous-domaine. Le % décide uniquement combien portent le motif complet.
for(let i=0;i<N;i++){const taste=Math.floor(i/20),rank=i%20,patterned=rank<Math.floor(20*tasteLevels[taste]/100),base=new THREE.Color(personality[i%10]),h={};base.getHSL(h);base.setHSL(h.h,.82,h.l);const marble=makeMarble(patterned?taste:-1,base);marble.scale.setScalar(controls.TAILLE);entityGroup.add(marble);marbles.push(marble);materials.push(marble.userData.material);travel.push(new THREE.Vector3());dirs.push(randDir());targets.push(randDir());clocks.push(Math.random()*2.5)}

const hemi=new THREE.HemisphereLight(0xffffff,0x30343b,controls.LUMIERE_AMBIANTE);scene.add(hemi)
const light=new THREE.SpotLight(0xffffff,controls.INTENSITE_LUMIERE,0,Math.PI/3.2,.55,0);light.castShadow=true;light.shadow.mapSize.set(4096,4096);light.shadow.bias=-.00015;light.shadow.normalBias=.015;light.shadow.radius=3;light.target.position.set(0,0,0);scene.add(light,light.target)
function updateLight(){light.position.copy(camera.position).add(new THREE.Vector3(42,28,0))}
function layout(){for(let i=0;i<N;i++){marbles[i].scale.setScalar(controls.TAILLE);marbles[i].position.copy(centers[i]).multiplyScalar(controls.ECART).add(travel[i])}}layout();updateLight()
function updateShine(){for(const m of materials){m.roughness=THREE.MathUtils.clamp(1-controls.BRILLANCE-.04,.08,.9);m.clearcoat=.18+controls.BRILLANCE*.32}}
const gui=new GUI({title:'ENTITY — 10 GOÛTS 3D'});gui.add(controls,'RELATION',0,100,1).name('RELATION GLOBALE %');gui.add(controls,'ROTATION',0,2,.01).name('V2 — VITESSE ROTATION');gui.add(controls,'FREQUENCE_INVERSIONS',0,12,.1).name('FREQUENCE INVERSIONS / MIN');gui.add(controls,'BRILLANCE',0,1,.01).name('BRILLANCE BILLES').onChange(updateShine);gui.add(controls,'INTENSITE_LUMIERE',0,6,.05).name('INTENSITÉ LUMIÈRE').onChange(v=>light.intensity=v);gui.add(controls,'LUMIERE_AMBIANTE',0,3,.05).name('LUMIÈRE AMBIANTE').onChange(v=>hemi.intensity=v);gui.add(controls,'ECART',13,28,.25).name('TAILLE / ECART').onChange(layout);gui.add(controls,'TAILLE',.4,1.8,.02).name('TAILLE BILLES').onChange(layout);gui.add(controls,'V1',0,3,.05).name('V1 — VIE INTERNE');gui.add(controls,'LIBERTE',.05,.45,.01).name('LIBERTE CELLULE');gui.add(controls,'CHEVAUCHEMENT',1,1.8,.05).name('CHEVAUCHEMENT');gui.add(controls,'CAMERA',90,800,5).name('CAMERA').onChange(v=>{camera.position.z=v;updateLight()})
const tag=document.createElement('div');tag.innerHTML='<b>ENTITY — 10 GOÛTS 3D</b><br>Chaque sous-domaine : 20 billes, niveau test 50 % → 10 billes motif complet + 10 neutres';Object.assign(tag.style,{position:'fixed',left:'14px',bottom:'12px',color:'rgba(255,255,255,.72)',font:'12px Arial',lineHeight:'18px'});document.body.appendChild(tag)
const legend=document.createElement('div');legend.innerHTML=tasteNames.map((n,i)=>`${i+1}. ${n}`).join('<br>');Object.assign(legend.style,{position:'fixed',left:'14px',top:'14px',color:'rgba(255,255,255,.55)',font:'11px Arial',lineHeight:'15px'});document.body.appendChild(legend)
const clock=new THREE.Clock(),inward=new THREE.Vector3(),steer=new THREE.Vector3(),axis=randDir(),axisTarget=randDir(),dq=new THREE.Quaternion();let axisClock=8+Math.random()*8,sense=1
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04),maxR=controls.ECART*controls.LIBERTE*controls.CHEVAUCHEMENT,global=controls.V1*controls.ECART*.42*(1+controls.RELATION/100);for(let i=0;i<N;i++){const sp=global*speedVar[i];clocks[i]-=dt;if(clocks[i]<=0){clocks[i]=.8+Math.random()*2.4;targets[i].lerp(randDir(),.65).normalize()}const d=travel[i].length(),q=maxR?d/maxR:0,ret=THREE.MathUtils.smoothstep(q,.55,1);inward.copy(travel[i]);if(inward.lengthSq()>.000001)inward.normalize().multiplyScalar(-1);else inward.set(0,0,0);steer.copy(targets[i]).multiplyScalar(.30).addScaledVector(inward,ret*1.55);dirs[i].addScaledVector(steer,dt).normalize();travel[i].addScaledVector(dirs[i],sp*dt);if(travel[i].length()>maxR){travel[i].setLength(maxR);dirs[i].lerp(inward,.06).normalize()}marbles[i].position.copy(centers[i]).multiplyScalar(controls.ECART).add(travel[i])}axisClock-=dt;if(axisClock<=0){axisClock=8+Math.random()*10;axisTarget.copy(randDir());if(axisTarget.dot(axis)<-.7)axisTarget.multiplyScalar(-1)}axis.lerp(axisTarget,1-Math.exp(-dt*.22)).normalize();if(Math.random()<1-Math.exp(-(controls.FREQUENCE_INVERSIONS/60)*dt))sense*=-1;dq.setFromAxisAngle(axis,controls.ROTATION*sense*dt);entityGroup.quaternion.premultiply(dq).normalize();updateLight();renderer.render(scene,camera)}animate()
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})
