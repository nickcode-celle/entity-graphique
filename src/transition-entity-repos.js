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
label.textContent='ENTITY → REPOS · attente'
Object.assign(label.style,{position:'fixed',left:'18px',top:'18px',zIndex:'10',font:'14px system-ui',color:'white',background:'rgba(0,0,0,.45)',padding:'8px 10px',borderRadius:'8px',pointerEvents:'none'})
document.body.appendChild(label)

let entityReady=false,reposReady=false,requested=false,currentSerial=-1

function maybeStart(){
  if(requested||!entityReady||!reposReady)return
  requested=true
  label.textContent='Signal prêt · prochaine migration naturelle utilisée'
  setTimeout(()=>{
    const ok=entity.contentWindow?.entityTransitionAPI?.request?.()
    if(!ok){requested=false;label.textContent='ENTITY pas prête';setTimeout(maybeStart,300)}
  },2200)
}

addEventListener('message',e=>{
  if(e.source===entity.contentWindow){
    if(e.data?.type==='ENTITY_TRANSITION_READY'){
      entityReady=true
      maybeStart()
    }else if(e.data?.type==='ENTITY_TRANSITION_BEAD'){
      currentSerial=e.data.serial
      label.textContent=`Bille ${currentSerial} · migration naturelle → caméra`
    }else if(e.data?.type==='ENTITY_TRANSITION_FULL'){
      currentSerial=e.data.serial
      repos.style.opacity='1'
      entity.style.background='transparent'
      label.textContent=`Bille ${currentSerial} plein écran · REPOS derrière`
      requestAnimationFrame(()=>{
        const target=repos.contentWindow?.reposTransitionAPI?.getTarget?.(currentSerial)
        if(target){
          entity.contentWindow?.entityTransitionAPI?.returnToTarget?.(target)
          label.textContent=`Bille ${currentSerial} → double REPOS`
        }
      })
    }else if(e.data?.type==='ENTITY_TRANSITION_DONE'){
      entity.style.display='none'
      label.textContent='REPOS · 40 / 1 / 60 · 0,35'
    }
  }else if(e.source===repos.contentWindow&&e.data?.type==='REPOS_TRANSITION_READY'){
    reposReady=true
    maybeStart()
  }
})

setTimeout(()=>{
  if(!entityReady||!reposReady)label.textContent=`Attente modules · ENTITY ${entityReady?'OK':'…'} · REPOS ${reposReady?'OK':'…'}`
},4000)
