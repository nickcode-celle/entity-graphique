let BIRDS=0
let positions=null,velocities=null,nextVel=null
let controls=null
let running=false,last=0

function stepDonut(dt){
  const d=dt*controls.VITESSE
  const zone=controls.SEPARATION+controls.ALIGNEMENT+controls.COHESION
  const zone2=zone*zone
  const sepT=zone>0?controls.SEPARATION/zone:0
  const alignT=zone>0?(controls.SEPARATION+controls.ALIGNEMENT)/zone:0
  const centre=controls.CENTRE,twoPI=Math.PI*2
  for(let i=0;i<BIRDS;i++){
    const qi=i*3,spx=positions[qi],spy=positions[qi+1],spz=positions[qi+2]
    let vx=velocities[qi],vy=velocities[qi+1],vz=velocities[qi+2]
    let dx=spx,dy=spy*2.5,dz=spz,dist2=dx*dx+dy*dy+dz*dz
    if(dist2>1e-9){const inv=1/Math.sqrt(dist2),f=-d*centre;vx+=dx*inv*f;vy+=dy*inv*f;vz+=dz*inv*f}
    if(zone>0)for(let j=0;j<BIRDS;j++){
      if(i===j)continue
      const qj=j*3
      dx=positions[qj]-spx;dy=positions[qj+1]-spy;dz=positions[qj+2]-spz
      dist2=dx*dx+dy*dy+dz*dz
      if(dist2<1e-8||dist2>zone2)continue
      const percent=dist2/zone2,invDist=1/Math.sqrt(dist2)
      if(percent<sepT){
        const f=(sepT/percent-1)*d
        vx-=dx*invDist*f;vy-=dy*invDist*f;vz-=dz*invDist*f
      }else if(percent<alignT){
        const td=alignT-sepT,ap=td===0?1:(percent-sepT)/td,f=(.5-Math.cos(ap*twoPI)*.5+.5)*d
        const bvx=velocities[qj],bvy=velocities[qj+1],bvz=velocities[qj+2],bl2=bvx*bvx+bvy*bvy+bvz*bvz
        if(bl2>1e-9){const bi=1/Math.sqrt(bl2);vx+=bvx*bi*f;vy+=bvy*bi*f;vz+=bvz*bi*f}
      }else{
        const td=1-alignT,ap=td===0?1:(percent-alignT)/td,f=(.5-(Math.cos(ap*twoPI)*-.5+.5))*d
        vx+=dx*invDist*f;vy+=dy*invDist*f;vz+=dz*invDist*f
      }
    }
    const speed2=vx*vx+vy*vy+vz*vz
    if(speed2>81){const k=9/Math.sqrt(speed2);vx*=k;vy*=k;vz*=k}
    nextVel[qi]=vx;nextVel[qi+1]=vy;nextVel[qi+2]=vz
  }
  const move=d*15
  for(let i=0;i<BIRDS;i++){
    const q=i*3,vx=nextVel[q],vy=nextVel[q+1],vz=nextVel[q+2]
    velocities[q]=vx;velocities[q+1]=vy;velocities[q+2]=vz
    positions[q]+=vx*move;positions[q+1]+=vy*move;positions[q+2]+=vz*move
  }
}

function loop(){
  if(!running)return
  const now=performance.now()
  let dt=(now-last)/1000
  if(dt>1)dt=1
  if(dt<1/240)dt=1/240
  last=now
  stepDonut(dt)
  const snapshot=new Float64Array(positions)
  postMessage({type:'snapshot',positions:snapshot.buffer,intervalMs:dt*1000},[snapshot.buffer])
  setTimeout(loop,0)
}

onmessage=e=>{
  const data=e.data
  if(data.type==='init'){
    BIRDS=data.birds
    controls={...data.controls}
    positions=new Float64Array(data.positions)
    velocities=new Float64Array(data.velocities)
    nextVel=new Float64Array(BIRDS*3)
    last=performance.now()
    running=true
    loop()
  }else if(data.type==='controls'&&controls){
    Object.assign(controls,data.controls)
  }else if(data.type==='stop'){
    running=false
  }
}
