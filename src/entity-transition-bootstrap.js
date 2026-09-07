import * as THREE from 'three'

const marbles=[]
let capturedScene=null,capturedCamera=null,capturedRenderer=null
let transitionRequested=false,serial=-1,state='idle',travelBead=null
let overlayRenderer=null,overlayScene=null,overlayCanvas=null
let flightStart=0,returnStart=0
const startWorld=new THREE.Vector3(),control1=new THREE.Vector3(),control2=new THREE.Vector3(),cameraTarget=new THREE.Vector3(),returnFrom=new THREE.Vector3(),returnTo=new THREE.Vector3()
let originalCanvas=null,materialStates=[]

const originalAdd=THREE.Object3D.prototype.add
THREE.Object3D.prototype.add=function(...objects){
  for(const object of objects){
    if(object?.userData?.textureUnitScale!==undefined && marbles.length<200 && !marbles.includes(object)) marbles.push(object)
  }
  return originalAdd.apply(this,objects)
}

const originalRender=THREE.WebGLRenderer.prototype.render
let renderHookActive=true
THREE.WebGLRenderer.prototype.render=function(scene,camera){
  if(!capturedScene && marbles.length>=200){capturedScene=scene;capturedCamera=camera;capturedRenderer=this;originalCanvas=this.domElement}
  return originalRender.call(this,scene,camera)
}

// Intercept the exact Map.set used by ENTITY's native startCapacitySwap().
// No speed heuristic and no forced choice: the next naturally selected bead is used.
const originalMapSet=Map.prototype.set
let nativeMigrationCaught=false
Map.prototype.set=function(key,value){
  const result=originalMapSet.call(this,key,value)
  const looksLikeNativeMigration=Number.isInteger(key)&&key>=0&&key<200&&value&&value.from&&value.to&&typeof value.duration==='number'&&'targetSlot' in value
  if(transitionRequested&&state==='idle'&&!nativeMigrationCaught&&looksLikeNativeMigration){
    nativeMigrationCaught=true
    const v=new THREE.Vector3().subVectors(value.to,value.from)
    window.parent.postMessage({type:'ENTITY_NATIVE_MIGRATION_CAUGHT',serial:key},'*')
    // Let the genuine migration visibly begin before releasing that same 3D bead.
    setTimeout(()=>detachNaturalBead(key,v),450)
  }
  return result
}

await import('./main-entity-50.js')
THREE.Object3D.prototype.add=originalAdd

function restoreRenderHook(){if(renderHookActive){THREE.WebGLRenderer.prototype.render=originalRender;renderHookActive=false}}
function waitForScene(){
  if(capturedScene&&capturedCamera&&capturedRenderer&&marbles.length>=200){
    restoreRenderHook()
    for(let i=0;i<marbles.length;i++)marbles[i].userData.serialId=i
    window.entityTransitionAPI={
      request(){transitionRequested=true;nativeMigrationCaught=false;return true},
      returnToTarget(target){
        if(state!=='covered'||!travelBead)return false
        const ndc=new THREE.Vector3(target.x,target.y,.35).unproject(capturedCamera),dir=ndc.sub(capturedCamera.position).normalize()
        returnFrom.copy(travelBead.position);returnTo.copy(capturedCamera.position).addScaledVector(dir,345);returnStart=performance.now();state='returning';return true
      },
      state(){return{state,serial,transitionRequested,nativeMigrationCaught}}
    }
    window.parent.postMessage({type:'ENTITY_TRANSITION_READY'},'*')
    requestAnimationFrame(watch)
  }else setTimeout(waitForScene,50)
}
waitForScene()

function makeOverlay(){
  if(overlayRenderer)return
  overlayRenderer=new THREE.WebGLRenderer({antialias:true,alpha:true});overlayRenderer.setPixelRatio(Math.min(devicePixelRatio,2));overlayRenderer.setSize(innerWidth,innerHeight)
  overlayRenderer.shadowMap.enabled=true;overlayRenderer.shadowMap.type=THREE.PCFSoftShadowMap;overlayRenderer.toneMapping=THREE.ACESFilmicToneMapping;overlayRenderer.setClearColor(0x000000,0)
  overlayCanvas=overlayRenderer.domElement;Object.assign(overlayCanvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'9998',pointerEvents:'none',background:'transparent'});document.body.appendChild(overlayCanvas)
  overlayScene=new THREE.Scene();capturedScene.traverse(o=>{if(o.isLight)overlayScene.add(o.clone())})
}
function cubic(out,a,b,c,d,t){const u=1-t,uu=u*u,tt=t*t;return out.set(0,0,0).addScaledVector(a,uu*u).addScaledVector(b,3*uu*t).addScaledVector(c,3*u*tt).addScaledVector(d,tt*t)}
function detachNaturalBead(i,velocity){
  if(state!=='idle'||!transitionRequested||!marbles[i])return
  serial=i;travelBead=marbles[i];state='outbound';transitionRequested=false;makeOverlay()
  travelBead.updateMatrixWorld(true);const q=new THREE.Quaternion(),s=new THREE.Vector3();travelBead.getWorldPosition(startWorld);travelBead.getWorldQuaternion(q);travelBead.getWorldScale(s)
  travelBead.parent?.remove(travelBead);overlayScene.add(travelBead);travelBead.position.copy(startWorld);travelBead.quaternion.copy(q);travelBead.scale.copy(s)
  const forward=new THREE.Vector3();capturedCamera.getWorldDirection(forward);cameraTarget.copy(capturedCamera.position).addScaledVector(forward,7.2)
  const tangent=velocity?.lengthSq()>.0001?velocity.clone().normalize():cameraTarget.clone().sub(startWorld).normalize();control1.copy(startWorld).addScaledVector(tangent,42);control2.copy(cameraTarget).addScaledVector(forward,-62);flightStart=performance.now()
  materialStates=[];travelBead.traverse(o=>{if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material]))materialStates.push({m,opacity:m.opacity})})
  window.parent.postMessage({type:'ENTITY_TRANSITION_BEAD',serial},'*')
}
function setFade(alpha){for(const s of materialStates){s.m.transparent=true;s.m.opacity=s.opacity*alpha;s.m.needsUpdate=true}}
function hideEntityBehindOverlay(){if(originalCanvas)originalCanvas.style.visibility='hidden';document.documentElement.style.background='transparent';document.body.style.background='transparent';const app=document.querySelector('#app');if(app)app.style.background='transparent'}
function updateTravel(now){
  if(!travelBead||!overlayRenderer)return
  if(state==='outbound'){
    const t=Math.min(1,(now-flightStart)/2700),e=t*t*(3-2*t);cubic(travelBead.position,startWorld,control1,control2,cameraTarget,e)
    if(t>=1){state='covered';hideEntityBehindOverlay();window.parent.postMessage({type:'ENTITY_TRANSITION_FULL',serial},'*')}
  }else if(state==='returning'){
    const t=Math.min(1,(now-returnStart)/3600),e=t*t*(3-2*t);travelBead.position.lerpVectors(returnFrom,returnTo,e);if(t>.78)setFade(Math.max(0,1-(t-.78)/.22))
    if(t>=1){state='done';travelBead.visible=false;window.parent.postMessage({type:'ENTITY_TRANSITION_DONE',serial},'*')}
  }
  overlayRenderer.render(overlayScene,capturedCamera)
}
function watch(now){requestAnimationFrame(watch);updateTravel(now)}
addEventListener('resize',()=>{if(overlayRenderer)overlayRenderer.setSize(innerWidth,innerHeight)})
