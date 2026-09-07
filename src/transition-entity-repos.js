import './style.css'

const app=document.querySelector('#app')
app.innerHTML=''
Object.assign(document.documentElement.style,{width:'100%',height:'100%',margin:'0',overflow:'hidden',background:'#1d1f22'})
Object.assign(document.body.style,{width:'100%',height:'100%',margin:'0',overflow:'hidden',background:'#1d1f22'})
Object.assign(app.style,{position:'fixed',inset:'0',overflow:'hidden',background:'#1d1f22'})

const makeFrame=(src,z)=>{
  const f=document.createElement('iframe')
  f.setAttribute('frameborder','0')
  Object.assign(f.style,{position:'absolute',inset:'0',width:'100%',height:'100%',border:'0',zIndex:String(z),background:'#1d1f22',willChange:'opacity',pointerEvents:'none'})
  app.appendChild(f)
  f.src=src
  return f
}

const repos=makeFrame('/repos-frame.html',1)
const entity=makeFrame('/entity-frame.html',2)
repos.style.opacity='0'

const label=document.createElement('div')
label.textContent='ENTITY → REPOS · préparation'
Object.assign(label.style,{position:'fixed',left:'18px',top:'18px',zIndex:'10',font:'14px system-ui',color:'white',background:'rgba(0,0,0,.45)',padding:'8px 10px',borderRadius:'8px',pointerEvents:'none'})
document.body.appendChild(label)

const wait=ms=>new Promise(r=>setTimeout(r,ms))
const waitFrame=f=>new Promise(resolve=>{
  const done=()=>resolve()
  try{if(f.contentDocument&&f.contentDocument.readyState==='complete')return done()}catch{}
  f.addEventListener('load',done,{once:true})
})

function captureAxisBead(){
  const src=entity.contentDocument?.querySelector('canvas')
  if(!src)return null
  const w=src.width,h=src.height
  if(!w||!h)return null
  const shot=document.createElement('canvas');shot.width=w;shot.height=h
  const ctx=shot.getContext('2d',{willReadFrequently:true})
  ctx.drawImage(src,0,0,w,h)
  const im=ctx.getImageData(0,0,w,h),d=im.data
  const cx=w/2,cy=h/2,rx=w*.34,ry=h*.34
  const step=Math.max(1,Math.round(w/innerWidth))
  const isBall=(x,y)=>{
    if(x<0||y<0||x>=w||y>=h)return false
    const p=(y*w+x)*4,r=d[p],g=d[p+1],b=d[p+2]
    const bg=Math.abs(r-29)+Math.abs(g-31)+Math.abs(b-34)
    const chroma=Math.max(r,g,b)-Math.min(r,g,b)
    return bg>30&&(chroma>8||r+g+b>135)
  }
  let seed=null,best=1e18
  for(let y=Math.max(0,Math.floor(cy-ry));y<Math.min(h,Math.ceil(cy+ry));y+=step){
    for(let x=Math.max(0,Math.floor(cx-rx));x<Math.min(w,Math.ceil(cx+rx));x+=step){
      if(!isBall(x,y))continue
      const score=(x-cx)*(x-cx)+(y-cy)*(y-cy)
      if(score<best){best=score;seed=[x,y]}
    }
  }
  if(!seed)return null

  const seen=new Uint8Array(w*h),q=[seed],pts=[]
  seen[seed[1]*w+seed[0]]=1
  while(q.length&&pts.length<180000){
    const [x,y]=q.pop();pts.push([x,y])
    const ns=[[x+1,y],[x-1,y],[x,y+1],[x,y-1]]
    for(const [nx,ny] of ns){
      if(nx<0||ny<0||nx>=w||ny>=h)continue
      const k=ny*w+nx
      if(seen[k]||!isBall(nx,ny))continue
      seen[k]=1;q.push([nx,ny])
    }
  }
  if(pts.length<25)return null
  let minX=w,minY=h,maxX=0,maxY=0
  for(const [x,y] of pts){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y}
  const pad=Math.max(5,Math.round((maxX-minX)*.10))
  minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);maxX=Math.min(w-1,maxX+pad);maxY=Math.min(h-1,maxY+pad)
  const bw=maxX-minX+1,bh=maxY-minY+1
  const crop=document.createElement('canvas');crop.width=bw;crop.height=bh
  const c=crop.getContext('2d');c.drawImage(shot,minX,minY,bw,bh,0,0,bw,bh)
  const ci=c.getImageData(0,0,bw,bh),cd=ci.data
  for(let i=0;i<cd.length;i+=4){
    const r=cd[i],g=cd[i+1],b=cd[i+2],bg=Math.abs(r-29)+Math.abs(g-31)+Math.abs(b-34)
    if(bg<22)cd[i+3]=0
    else if(bg<48)cd[i+3]=Math.round(cd[i+3]*(bg-22)/26)
  }
  c.putImageData(ci,0,0)
  return {crop,x:minX/w*innerWidth,y:minY/h*innerHeight,width:bw/w*innerWidth,height:bh/h*innerHeight}
}

function makeBridge(cap){
  const bridge=cap.crop
  Object.assign(bridge.style,{position:'fixed',left:`${cap.x}px`,top:`${cap.y}px`,width:`${cap.width}px`,height:`${cap.height}px`,zIndex:'6',pointerEvents:'none',transformOrigin:'50% 50%',willChange:'transform,opacity,filter'})
  app.appendChild(bridge)
  return bridge
}

async function run(){
  label.textContent='ENTITY → REPOS · départ dans 3 s'
  await wait(3000)
  label.textContent='RECHERCHE BILLE AXE'
  let cap=null
  for(let n=0;n<20&&!cap;n++){
    try{cap=captureAxisBead()}catch{}
    if(!cap)await wait(150)
  }
  if(!cap){label.textContent='BILLE AXE NON TROUVÉE';return}

  const bridge=makeBridge(cap)
  const bx=cap.x+cap.width/2,by=cap.y+cap.height/2
  const dx=innerWidth/2-bx,dy=innerHeight/2-by
  const fill=Math.max(innerWidth/cap.width,innerHeight/cap.height)*1.55

  label.textContent='BILLE RÉELLE → CAMÉRA'
  await bridge.animate([
    {transform:'translate(0px,0px) scale(1)'},
    {transform:`translate(${dx}px,${dy}px) scale(${fill})`}
  ],{duration:2600,easing:'cubic-bezier(.45,0,.2,1)',fill:'forwards'}).finished

  label.textContent='RACCORD CACHÉ'
  repos.style.opacity='1'
  entity.style.opacity='0'
  await wait(120)

  label.textContent='LA BILLE S’ENFONCE DANS REPOS'
  await bridge.animate([
    {offset:0,transform:`translate(${dx}px,${dy}px) scale(${fill})`,opacity:1},
    {offset:.62,transform:`translate(${dx}px,${dy}px) scale(.9)`,opacity:1},
    {offset:.82,transform:`translate(${dx}px,${dy}px) scale(.48)`,opacity:.9},
    {offset:1,transform:`translate(${dx}px,${dy}px) scale(.18)`,opacity:0}
  ],{duration:3600,easing:'cubic-bezier(.2,.7,.15,1)',fill:'forwards'}).finished

  bridge.remove()
  entity.style.display='none'
  label.textContent='REPOS · 40 / 1 / 60 · 0,35'
}

Promise.all([waitFrame(entity),waitFrame(repos)]).then(run).catch(e=>{label.textContent='ERREUR TRANSITION';console.error(e)})
