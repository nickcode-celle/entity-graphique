import * as THREE from 'three'

const marbles=[]
let capturedScene=null,capturedCamera=null
let transitionRequested=false,serial=-1,state='idle',travelBead=null
let overlayRenderer=null,overlayScene=null,overlayCanvas=null
let flightStart=0,returnStart=0
const startWorld=new THREE.Vector3(),cameraTarget=new THREE.Vector3(),returnFrom=new THREE.Vector3(),returnTo=new THREE.Vector3()
let originalCanvas=null,materialStates=[]

const originalAdd=THREE.Object3D.prototype.add
THREE.Object3D.prototype.add=function(...objects){for(const object of objects){if(object?.isGroup&&!capturedScene){let p=this;while(p?.parent)p=p.parent;if(p?.isScene)capturedScene=p}if(object?.userData?.textureUnitScale!==undefined&&marbles.length<200&&!marbles.includes(object))marbles.push(object)}return originalAdd.apply(this,objects)}
const originalAppendChild=Element.prototype.appendChild
Element.prototype.appendChild=function(node){const result=originalAppendChild.call(this,node);if(node?.tagName==='CANVAS'&&!originalCanvas)originalCanvas=node;return result}
const originalCameraUpdate=THREE.PerspectiveCamera.prototype.updateProjectionMatrix
THREE.PerspectiveCamera.prototype.updateProjectionMatrix=function(){if(!capturedCamera&&this?.isPerspectiveCamera)capturedCamera=this;return originalCameraUpdate.call(this)}

const originalMapSet=Map.prototype.set
let nativeMigrationCaught=false
Map.prototype.set=function(key,value){
 const result=originalMapSet.call(this,key,value)
 const native=Number.isInteger(key)&&key>=0&&key<200&&value&&value.from&&value.to&&typeof value.duration==='number'&&'targetSlot'in value
 if(transitionRequested&&state==='idle'&&!nativeMigrationCaught&&native){nativeMigrationCaught=true;window.parent.postMessage({type:'ENTITY_NATIVE_MIGRATION_CAUGHT',serial:key},'*');setTimeout(()=>redirectNaturalBead(key),450)}
 return result
}

await import('./main-entity-50.js')
THREE.Object3D.prototype.add=originalAdd
Element.prototype.appendChild=originalAppendChild
THREE.PerspectiveCamera.prototype.updateProjectionMatrix=originalCameraUpdate
if(!capturedScene&&marbles[0]){let p=marbles[0];while(p.parent)p=p.parent;if(p.isScene)capturedScene=p}
if(!capturedCamera){capturedCamera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,3000);capturedCamera.position.z=280;capturedCamera.updateProjectionMatrix()}
capturedCamera.updateMatrixWorld(true)

function waitForScene(){
 if(capturedScene&&capturedCamera&&marbles.length>=200){
  for(let i=0;i<marbles.length;i++)marbles[i].userData.serialId=i
  window.entityTransitionAPI={request(){transitionRequested=true;nativeMigrationCaught=false;return true},returnToTarget(target){if(state!=='covered'||!travelBead)return false;capturedCamera.updateMatrixWorld(true);const ndc=new THREE.Vector3(target.x,target.y,0).unproject(capturedCamera),camPos=new THREE.Vector3();capturedCamera.getWorldPosition(camPos);const dir=ndc.sub(camPos).normalize();returnFrom.copy(travelBead.position);returnTo.copy(camPos).addScaledVector(dir,210);returnStart=performance.now();state='returning';return true},state(){return{state,serial,transitionRequested,nativeMigrationCaught}}}
  window.parent.postMessage({type:'ENTITY_TRANSITION_READY'},'*');requestAnimationFrame(watch)
 }else setTimeout(waitForScene,50)
}
waitForScene()

function makeOverlay(){if(overlayRenderer)return;overlayRenderer=new THREE.WebGLRenderer({antialias:true,alpha:true});overlayRenderer.setPixelRatio(Math.min(devicePixelRatio,2));overlayRenderer.setSize(innerWidth,innerHeight);overlayRenderer.shadowMap.enabled=true;overlayRenderer.shadowMap.type=THREE.PCFSoftShadowMap;overlayRenderer.toneMapping=THREE.ACESFilmicToneMapping;overlayRenderer.setClearColor(0x000000,0);overlayCanvas=overlayRenderer.domElement;Object.assign(overlayCanvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'9998',pointerEvents:'none',background:'transparent'});document.body.appendChild(overlayCanvas);overlayScene=new THREE.Scene();capturedScene.traverse(o=>{if(o.isLight)overlayScene.add(o.clone())})}
function redirectNaturalBead(i){
 if(state!=='idle'||!transitionRequested||!marbles[i])return
 serial=i;travelBead=marbles[i];state='outbound';transitionRequested=false;makeOverlay()
 travelBead.updateWorldMatrix(true,true)
 const q=new THREE.Quaternion(),s=new THREE.Vector3();travelBead.getWorldPosition(startWorld);travelBead.getWorldQuaternion(q);travelBead.getWorldScale(s)
 // Move the SAME object selected by ENTITY. No clone, image or replacement.
 travelBead.removeFromParent();overlayScene.add(travelBead);travelBead.position.copy(startWorld);travelBead.quaternion.copy(q);travelBead.scale.copy(s)
 capturedCamera.updateMatrixWorld(true);const camPos=new THREE.Vector3(),forward=new THREE.Vector3();capturedCamera.getWorldPosition(camPos);capturedCamera.getWorldDirection(forward);cameraTarget.copy(camPos).addScaledVector(forward,7.4);flightStart=performance.now()
 materialStates=[];travelBead.traverse(o=>{if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material]))materialStates.push({m,opacity:m.opacity})})
 window.parent.postMessage({type:'ENTITY_TRANSITION_BEAD',serial},'*')
}
function setFade(alpha){for(const s of materialStates){s.m.transparent=true;s.m.opacity=s.opacity*alpha;s.m.needsUpdate=true}}
function hideEntityBehindOverlay(){if(originalCanvas)originalCanvas.style.visibility='hidden';document.documentElement.style.background='transparent';document.body.style.background='transparent';const app=document.querySelector('#app');if(app)app.style.background='transparent'}
function updateTravel(now){if(!travelBead||!overlayRenderer)return;if(state==='outbound'){const t=Math.min(1,(now-flightStart)/3600),e=t*t*(3-2*t);travelBead.position.lerpVectors(startWorld,cameraTarget,e);if(t>=1){state='covered';hideEntityBehindOverlay();window.parent.postMessage({type:'ENTITY_TRANSITION_FULL',serial},'*')}}else if(state==='returning'){const t=Math.min(1,(now-returnStart)/3600),e=t*t*(3-2*t);travelBead.position.lerpVectors(returnFrom,returnTo,e);if(t>.78)setFade(Math.max(0,1-(t-.78)/.22));if(t>=1){state='done';travelBead.visible=false;window.parent.postMessage({type:'ENTITY_TRANSITION_DONE',serial},'*')}}overlayRenderer.render(overlayScene,capturedCamera)}
function watch(now){requestAnimationFrame(watch);updateTravel(now)}
addEventListener('resize',()=>{if(overlayRenderer)overlayRenderer.setSize(innerWidth,innerHeight)})
