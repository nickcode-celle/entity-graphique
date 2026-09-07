import * as THREE from 'three'

const SERIAL_COUNT=500
let writeIndex=0,batches=0
const serialPositions=Array.from({length:SERIAL_COUNT},()=>new THREE.Vector3())
let capturedCamera=null

const originalSetMatrixAt=THREE.InstancedMesh.prototype.setMatrixAt
THREE.InstancedMesh.prototype.setMatrixAt=function(index,matrix){
  const e=matrix.elements
  serialPositions[writeIndex].set(e[12],e[13],e[14])
  writeIndex=(writeIndex+1)%SERIAL_COUNT
  if(writeIndex===0)batches++
  return originalSetMatrixAt.call(this,index,matrix)
}

const originalRender=THREE.WebGLRenderer.prototype.render
let renderHookActive=true
THREE.WebGLRenderer.prototype.render=function(scene,camera){
  if(!capturedCamera)capturedCamera=camera
  return originalRender.call(this,scene,camera)
}

await import('./main-repos-transition-300.js')

function restoreRenderHook(){if(renderHookActive){THREE.WebGLRenderer.prototype.render=originalRender;renderHookActive=false}}

function forceValidatedRepos(){
  const wanted={SEPARATION:'40',ALIGNEMENT:'1',COHESION:'60',VITESSE:'0.35'}
  let changed=0
  for(const row of document.querySelectorAll('.controller')){
    const name=row.querySelector('.name')?.textContent.trim()
    if(!(name in wanted))continue
    const input=row.querySelector('input')
    if(!input)continue
    input.value=wanted[name]
    input.dispatchEvent(new Event('input',{bubbles:true}))
    input.dispatchEvent(new Event('change',{bubbles:true}))
    changed++
  }
  return changed===4
}
let tries=0
const timer=setInterval(()=>{tries++;if(forceValidatedRepos()||tries>100)clearInterval(timer)},50)

function expose(){
  if(capturedCamera&&batches>=2){
    restoreRenderHook()
    window.reposTransitionAPI={
      getTarget(serialId){
        const i=((serialId%SERIAL_COUNT)+SERIAL_COUNT)%SERIAL_COUNT
        const p=serialPositions[i].clone().project(capturedCamera)
        return {serialId:i,x:p.x,y:p.y,z:p.z}
      },
      state(){return {batches}}
    }
    window.parent.postMessage({type:'REPOS_TRANSITION_READY'},'*')
  }else setTimeout(expose,50)
}
expose()
