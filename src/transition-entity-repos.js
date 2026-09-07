import './style.css'

const app=document.querySelector('#app')
app.innerHTML=''
Object.assign(document.documentElement.style,{width:'100%',height:'100%',margin:'0',overflow:'hidden',background:'#1d1f22'})
Object.assign(document.body.style,{width:'100%',height:'100%',margin:'0',overflow:'hidden',background:'#1d1f22'})
Object.assign(app.style,{position:'fixed',inset:'0',overflow:'hidden',background:'#1d1f22'})

const makeFrame=(src,z)=>{
  const f=document.createElement('iframe')
  f.src=src
  f.setAttribute('frameborder','0')
  Object.assign(f.style,{position:'absolute',inset:'0',width:'100%',height:'100%',border:'0',zIndex:String(z),transformOrigin:'50% 50%',background:'#1d1f22',willChange:'transform,opacity',pointerEvents:'none'})
  app.appendChild(f)
  return f
}

const repos=makeFrame('/repos-frame.html',1)
const entity=makeFrame('/entity-frame.html',2)
repos.style.opacity='0'
repos.style.transform='scale(28)'
entity.style.opacity='1'
entity.style.transform='scale(1)'

const label=document.createElement('div')
label.textContent='ENTITY → REPOS'
Object.assign(label.style,{position:'fixed',left:'18px',top:'18px',zIndex:'10',font:'14px system-ui',color:'white',background:'rgba(0,0,0,.45)',padding:'8px 10px',borderRadius:'8px',pointerEvents:'none'})
document.body.appendChild(label)

const wait=ms=>new Promise(r=>setTimeout(r,ms))
const nextFrame=()=>new Promise(r=>requestAnimationFrame(()=>r()))

async function run(){
  await wait(4500)
  label.textContent='ZOOM SUR UNE BILLE'
  entity.style.transition='transform 2600ms cubic-bezier(.45,0,.2,1)'
  entity.style.transform='scale(28)'
  await wait(2550)

  label.textContent='RACCORD'
  repos.style.opacity='1'
  await nextFrame()
  entity.style.transition='opacity 120ms linear'
  entity.style.opacity='0'
  await wait(140)

  label.textContent='DÉZOOM → REPOS'
  repos.style.transition='transform 3000ms cubic-bezier(.2,.7,.15,1)'
  repos.style.transform='scale(1)'
  await wait(3050)

  entity.style.display='none'
  label.textContent='REPOS · 40 / 1 / 60 · 0,35'
}

Promise.all([
  new Promise(r=>entity.addEventListener('load',r,{once:true})),
  new Promise(r=>repos.addEventListener('load',r,{once:true}))
]).then(run)
