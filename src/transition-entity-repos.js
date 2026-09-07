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
  Object.assign(f.style,{position:'absolute',inset:'0',width:'100%',height:'100%',border:'0',zIndex:String(z),background:'#1d1f22',willChange:'opacity',pointerEvents:'none'})
  app.appendChild(f)
  return f
}

const repos=makeFrame('/repos-frame.html',1)
const entity=makeFrame('/entity-frame.html',2)
repos.style.opacity='0'

const label=document.createElement('div')
label.textContent='ENTITY → REPOS'
Object.assign(label.style,{position:'fixed',left:'18px',top:'18px',zIndex:'10',font:'14px system-ui',color:'white',background:'rgba(0,0,0,.45)',padding:'8px 10px',borderRadius:'8px',pointerEvents:'none'})
document.body.appendChild(label)

const wait=ms=>new Promise(r=>setTimeout(r,ms))

function captureAxisBead(){
  const src=entity.contentDocument?.querySelector('canvas')
  if(!src) return null
  const w=src.width,h=src.height
  const shot=document.createElement('canvas');shot.width=w;shot.height=h
  const ctx=shot.getContext('2d',{willReadFrequently:true});ctx.drawImage(src,0,0,w,h)
  const im=ctx.getImageData(0,0,w,h),d=im.data
  const cx=w/2,cy=h/2,rx=w*.30,ry=h*.30
  const step=Math.max(1,Math.round(w/innerWidth))
  const isBall=(x,y)=>{
    if(x<0||y<0||x>=w||y>=h)return false
    const p=(y*w+x)*4,r=d[p],g=d[p+1],b=d[p+2]
    const bg=Math.abs(r-29)+Math.abs(g-31)+Math.abs(b-34)
    const chroma=Math.max(r,g,b)-Math.min(r,g,b)
    return bg>34&&(chroma>12||r+g+b>150)
  }
  let seed=null,best=1e18
  for(let y=Math.max(0,cy-ry);y<Math.min(h,cy+ry);y+=step){
    for(let x=Math.max(0,cx-rx);x<Math.min(w,cx+rx);x+=step){
      if(!isBall(x,y))continue
      const score=(x-cx)*(x-cx)+(y-cy)*(y-cy)
      if(score<best){best=score;seed=[x,y]}
    }
  }
  if(!seed)return null

  const seen=new Uint8Array(w*h),q=[seed],pts=[]
  seen[Math.round(seed[1])*w+Math.round(seed[0])]=1
  while(q.length&&pts.length<180000){
    const [x,y]=q.pop();pts.push([x,y])
    for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){
      if(nx<0||ny<0||nx>=w||ny>=h)continue
      const k=ny*w+nx
      if(seen[k]||!isBall(nx,ny))continue
      seen[k]=1;q.push([nx,ny])
    }
  }
  if(pts.length<40)return null
  let minX=w,minY=h,maxX=0,maxY=0
  for(const [x,y] of pts){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y}
  const pad=Math.max(6,Math.round((maxX-minX)*.12))
  minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);maxX=Math.min(w-1,maxX+pad);maxY=Math.min(h-1,maxY+pad)
  const bw=maxX-minX+1,bh=maxY-minY+1
  const crop=document.createElement('canvas');crop.width=bw;crop.height=bh
  const c=crop.getContext('2d');c.drawImage(shot,minX,minY,bw,bh,0,0,bw,bh)
  const ci=c.getImageData(0,0,bw,bh),cd=ci.data
  for(let i=0;i<cd.length;i+=4){
    const r=cd[i],g=cd[i+1],b=cd[i+2],bg=Math.abs(r-29)+Math.abs(g-31)+Math.abs(b-34)
    if(bg<28)cd[i+3]=0
    else if(bg<55)cd[i+3]=Math.round(cd[i+3]*(bg-28)/27)
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
  await wait(4500)
  const cap=captureAxisBead()
  if(!cap){label.textContent='BILLE AXE NON TROUVÉE';return}
  const bridge=makeBridge(cap)
  const bx=cap.x+cap.width/2,by=cap.y+cap.height/2
  const fill=Math.max(innerWidth/cap.width,innerHeight/cap.height)*1.45

  label.textContent='BILLE RÉELLE → CAMÉRA'
  await bridge.animate([
    {transform:'translate(0px,0px) scale(1)'},
    {transform:`translate(${innerWidth/2-bx}px,${innerHeight/2-by}px) scale(${fill})`}
  ],{duration:2600,easing:'cubic-bezier(.45,0,.2,1)',fill:'forwards'}).finished

  label.textContent='RACCORD CACHÉ'
  repos.style.opacity='1'
  entity.style.opacity='0'
  await wait(120)

  label.textContent='LA BILLE RETOURNE DANS REPOS'
  const dx=innerWidth/2-bx,dy=innerHeight/2-by
  await bridge.animate([
    {offset:0,transform:`translate(${dx}px,${dy}px) scale(${fill})`,opacity:1,filter:'brightness(1)'},
    {offset:.72,transform:`translate(${dx}px,${dy}px) scale(.72)`,opacity:1,filter:'brightness(.9)'},
    {offset:.88,transform:`translate(${dx}px,${dy}px) scale(.42)`,opacity:.72,filter:'brightness(.7)'},
    {offset:1,transform:`translate(${dx}px,${dy}px) scale(.22)`,opacity:0,filter:'brightness(.45)'}
  ],{duration:3300,easing:'cubic-bezier(.2,.7,.15,1)',fill:'forwards'}).finished

  bridge.remove()
  entity.style.display='none'
  label.textContent='REPOS · 40 / 1 / 60 · 0,35'
}

Promise.all([
  new Promise(r=>entity.addEventListener('load',r,{once:true})),
  new Promise(r=>repos.addEventListener('load',r,{once:true}))
]).then(run)
