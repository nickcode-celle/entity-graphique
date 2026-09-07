import './style.css'

const app=document.querySelector('#app')
app.innerHTML=''
Object.assign(document.documentElement.style,{width:'100%',height:'100%',margin:'0',overflow:'hidden',background:'#1d1f22'})
Object.assign(document.body.style,{width:'100%',height:'100%',margin:'0',overflow:'hidden',background:'#1d1f22'})
Object.assign(app.style,{position:'fixed',inset:'0',overflow:'hidden',background:'#1d1f22'})

function makeFrame(src,z){
  const f=document.createElement('iframe')
  f.src=src
  f.setAttribute('frameborder','0')
  Object.assign(f.style,{position:'absolute',inset:'0',width:'100%',height:'100%',border:'0',zIndex:String(z),background:'transparent',pointerEvents:'none'})
  app.appendChild(f)
  return f
}

const repos=makeFrame('/repos-frame.html',1)
const entity=makeFrame('/entity-frame.html',2)
repos.style.opacity='0'

const label=document.createElement('div')
label.textContent='ENTITY → REPOS · attente ENTITY'
Object.assign(label.style,{position:'fixed',left:'18px',top:'18px',zIndex:'10',font:'14px system-ui',color:'white',background:'rgba(0,0,0,.45)',padding:'8px 10px',borderRadius:'8px',pointerEvents:'none'})
document.body.appendChild(label)

let entityReady=false,reposReady=false,requested=false,currentSerial=-1

function requestEntityDeparture(){
  if(requested)return
  const api=entity.contentWindow?.entityTransitionAPI
  if(!api?.request)return
  requested=true
  const ok=api.request()
  if(ok) label.textContent='Signal envoyé · attente de la prochaine migration naturelle'
  else {requested=false;setTimeout(requestEntityDeparture,100)}
}

function maybeStart(){
  if(!entityReady)return
  setTimeout(requestEntityDeparture,2200)
}

function waitForReposTarget(serialId){
  const api=repos.contentWindow?.reposTransitionAPI
  const target=api?.getTarget?.(serialId)
  if(target){
    entity.contentWindow?.entityTransitionAPI?.returnToTarget?.(target)
    label.textContent=`Bille ${serialId} → double REPOS`
    return
  }
  label.textContent=`Bille ${serialId} plein écran · attente REPOS`
  setTimeout(()=>waitForReposTarget(serialId),50)
}

addEventListener('message',e=>{
  if(e.source===entity.contentWindow){
    if(e.data?.type==='ENTITY_TRANSITION_READY'){
      entityReady=true
      maybeStart()
    }else if(e.data?.type==='ENTITY_NATIVE_MIGRATION_CAUGHT'){
      label.textContent=`Migration naturelle détectée · bille ${e.data.serial}`
    }else if(e.data?.type==='ENTITY_TRANSITION_BEAD'){
      currentSerial=e.data.serial
      label.textContent=`Bille ${currentSerial} · migration naturelle → caméra`
    }else if(e.data?.type==='ENTITY_TRANSITION_FULL'){
      currentSerial=e.data.serial
      repos.style.opacity='1'
      entity.style.background='transparent'
      waitForReposTarget(currentSerial)
    }else if(e.data?.type==='ENTITY_TRANSITION_DONE'){
      entity.style.display='none'
      label.textContent='REPOS · 40 / 1 / 60 · 0,35'
    }
  }else if(e.source===repos.contentWindow&&e.data?.type==='REPOS_TRANSITION_READY'){
    reposReady=true
  }
})

// Do not depend exclusively on postMessage timing: poll the real iframe APIs too.
const readinessPoll=setInterval(()=>{
  if(!entityReady&&entity.contentWindow?.entityTransitionAPI?.request){
    entityReady=true
    maybeStart()
  }
  if(!reposReady&&repos.contentWindow?.reposTransitionAPI?.getTarget) reposReady=true
  if(entityReady&&reposReady) clearInterval(readinessPoll)
},100)

setTimeout(()=>{
  if(!entityReady)label.textContent='ENTITY non prête'
},4000)
