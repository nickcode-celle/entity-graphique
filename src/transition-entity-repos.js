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
label.textContent='ENTITY → REPOS · diagnostic'
Object.assign(label.style,{position:'fixed',left:'18px',top:'18px',zIndex:'10',font:'14px system-ui',color:'white',background:'rgba(0,0,0,.62)',padding:'8px 10px',borderRadius:'8px',pointerEvents:'none',whiteSpace:'pre-line'})
document.body.appendChild(label)

let entityReady=false,reposReady=false,requested=false,currentSerial=-1,startAt=performance.now()

function requestEntityDeparture(){
  if(requested)return
  const api=entity.contentWindow?.entityTransitionAPI
  if(!api?.request)return
  requested=true
  api.request()
}

function sendReturnToRepos(serialId){
  const rapi=repos.contentWindow?.reposTransitionAPI
  const eapi=entity.contentWindow?.entityTransitionAPI
  const target=rapi?.getTarget?.(serialId)
  if(!target||!eapi?.returnToTarget){setTimeout(()=>sendReturnToRepos(serialId),50);return}
  if(!eapi.returnToTarget(target))setTimeout(()=>sendReturnToRepos(serialId),50)
}

addEventListener('message',e=>{
  if(e.source===entity.contentWindow){
    if(e.data?.type==='ENTITY_TRANSITION_READY')entityReady=true
    else if(e.data?.type==='ENTITY_NATIVE_MIGRATION_CAUGHT')currentSerial=e.data.serial
    else if(e.data?.type==='ENTITY_TRANSITION_BEAD')currentSerial=e.data.serial
    else if(e.data?.type==='ENTITY_TRANSITION_FULL'){
      currentSerial=e.data.serial
      repos.style.opacity='1'
      sendReturnToRepos(currentSerial)
    }else if(e.data?.type==='ENTITY_TRANSITION_DONE'){
      entity.style.display='none'
      repos.style.zIndex='3'
    }
  }else if(e.source===repos.contentWindow&&e.data?.type==='REPOS_TRANSITION_READY')reposReady=true
})

setInterval(()=>{
  const eapi=entity.contentWindow?.entityTransitionAPI
  const rapi=repos.contentWindow?.reposTransitionAPI
  if(eapi?.request){entityReady=true;if(!requested&&performance.now()-startAt>2200)requestEntityDeparture()}
  if(rapi?.getTarget)reposReady=true
  const s=eapi?.state?.()
  const elapsed=((performance.now()-startAt)/1000).toFixed(1)
  label.textContent=`DIAG ${elapsed}s\nENTITY API: ${eapi?.request?'OK':'NON'}\nREPOS API: ${rapi?.getTarget?'OK':'NON'}\nSignal envoyé: ${requested?'OUI':'NON'}\ntransitionRequested: ${s?.transitionRequested??'—'}\nnativeMigrationCaught: ${s?.nativeMigrationCaught??'—'}\nstate: ${s?.state??'—'}\nserial: ${s?.serial??currentSerial}`
},200)
