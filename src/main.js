import * as THREE from 'three'
import './style.css'

// ENTITY — ColT reference port
// Faithful browser port of the CURRENT marinapapa/ColT-Model configuration.
// No invented flocking weights. First validation uses the source configuration: 30 starlings + 1 predator, 2D, dt=0.005 s.

const DT = 0.005
const N = 30
const FOV_COS = Math.cos(THREE.MathUtils.degToRad(135)) // 270° FOV
const MAXDIST2 = 200 * 200
const FLOCK_THRESHOLD = 10

const STAR = {
  mass: 0.45, minSpeed: 5, maxSpeed: 20,
  normal: { tr: 0.05, cruise: 6, cruiseW: 0.3 },
  penalty: { tr: 0.05, duration: 2, cruise: 6, cruiseW: 0.3 },
  turn: { tr: 0.05, duration: 4, cruise: 6, cruiseW: 0.3 },
  alignW: 5, cohereW: 0.5, avoidW: 1, minSep: 1, wiggleW: 0.2,
  homeDist: 20, homeDirection: THREE.MathUtils.degToRad(90), homeW: 5,
}

const PRED = {
  mass: 0.8, minSpeed: 10, maxSpeed: 30,
  retreat: { tr: 0.05, cruise: 10, cruiseW: 1 },
  shadow: { tr: 0.05, duration: 30, cruise: 10, cruiseW: 5 },
  chase: { tr: 0.05, duration: 20, cruise: 18, cruiseW: 5 },
  hold: { tr: 0.05, duration: 10, cruise: 10, cruiseW: 5 },
}

const app = document.querySelector('#app')
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x16181b)
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 500)
camera.position.set(0, 0, 95)
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
app.appendChild(renderer.domElement)

scene.add(new THREE.HemisphereLight(0xffffff, 0x24272c, 1.5))
const light = new THREE.DirectionalLight(0xffffff, 2.3)
light.position.set(-20, 30, 50)
scene.add(light)

const sphereGeo = new THREE.SphereGeometry(0.55, 16, 12)
const starMat = new THREE.MeshStandardMaterial({ color: 0xf4f5f6, roughness: 0.32 })
const predMat = new THREE.MeshStandardMaterial({ color: 0xe15d5d, roughness: 0.4 })

const label = document.createElement('div')
Object.assign(label.style, { position:'fixed', left:'14px', bottom:'12px', color:'rgba(255,255,255,.7)', font:'12px Arial', lineHeight:'1.5', pointerEvents:'none' })
document.body.appendChild(label)

const v = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z)
const safeNorm = (a, fallback=v(1,0,0)) => a.lengthSq() > 1e-12 ? a.normalize() : a.copy(fallback)
const perp = a => v(-a.y, a.x, 0)
const rotateXY = (a, rad) => v(a.x*Math.cos(rad)-a.y*Math.sin(rad), a.x*Math.sin(rad)+a.y*Math.cos(rad), 0)
const gauss = () => { let u=0,w=0; while(!u)u=Math.random(); while(!w)w=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*w) }

function makeBody(material, scale=1) {
  const mesh = new THREE.Mesh(sphereGeo, material)
  mesh.scale.setScalar(scale)
  scene.add(mesh)
  return mesh
}

const starlings = []
for (let i=0;i<N;i++) {
  const angle = gauss() * THREE.MathUtils.degToRad(10)
  starlings.push({
    pos:v(Math.random()*20, Math.random()*20, 0),
    dir:v(Math.cos(angle), Math.sin(angle), 0), speed:10, accel:v(), steering:v(),
    state:0, stateExit:Infinity, nextUpdate:Math.random(),
    stressOfs:0.05 + gauss()*0.02, stress:0,
    copyDuration:0, copyState:0, homePos:v(),
    mesh:makeBody(starMat.clone()), neighbours:[],
  })
}

const predator = {
  pos:v(Math.random()*100,Math.random()*100,Math.random()*100),
  dir:safeNorm(v(Math.random()-.5,Math.random()-.5,0)), speed:10,
  accel:v(), steering:v(), state:0, stateExit:Infinity, nextUpdate:Math.random(),
  target:-1, holdPos:v(), mesh:makeBody(predMat,0.8),
}

let simTime=0, accumulator=0, last=performance.now()

function sortedStarNeighbours(i) {
  const s=starlings[i]
  const arr=[]
  for(let j=0;j<N;j++) if(j!==i) arr.push({idx:j,d2:s.pos.distanceToSquared(starlings[j].pos)})
  arr.sort((a,b)=>a.d2-b.d2)
  return arr
}
function visible(self, other, d2) {
  if(d2<=0 || d2>=MAXDIST2) return false
  const off=other.pos.clone().sub(self.pos)
  return self.dir.dot(off) > Math.sqrt(d2)*FOV_COS
}
function firstVisible(i,count,extra=()=>true) {
  const s=starlings[i], out=[]
  for(const ni of sortedStarNeighbours(i)) {
    if(out.length>=count) break
    const o=starlings[ni.idx]
    if(visible(s,o,ni.d2) && extra(ni,o)) out.push(ni)
  }
  return out
}

function components() {
  const seen=Array(N).fill(false), comps=[]
  for(let r=0;r<N;r++) if(!seen[r]) {
    const c=[], q=[r]; seen[r]=true
    while(q.length) {
      const i=q.pop(); c.push(i)
      for(let j=0;j<N;j++) if(!seen[j] && i!==j && starlings[i].pos.distanceTo(starlings[j].pos)<FLOCK_THRESHOLD) { seen[j]=true; q.push(j) }
    }
    comps.push(c)
  }
  return comps
}
function flockOf(i) { return components().find(c=>c.includes(i)) || [i] }
function flockCentroid(indices) {
  const c=v(); for(const i of indices)c.add(starlings[i].pos); return c.multiplyScalar(1/indices.length)
}
function flockVelocity(indices) {
  const m=v(); for(const i of indices)m.addScaledVector(starlings[i].dir,starlings[i].speed); return m
}

function enterStarState(i,state,t) {
  const s=starlings[i]; s.state=state; s.copyDuration=0; s.copyState=0
  if(state===0) { s.stateExit=Infinity; return }
  const cfg=state===1?STAR.penalty:STAR.turn
  s.stateExit=t+cfg.duration
  if(state===2) {
    const f=flockOf(i), gc=flockCentroid(f), head=safeNorm(flockVelocity(f),s.dir.clone())
    s.homePos.copy(gc).addScaledVector(rotateXY(head,STAR.homeDirection),STAR.homeDist)
  }
}

function chooseStarState(i,t) {
  const s=starlings[i]
  s.stress=s.stressOfs
  const d=s.pos.distanceTo(predator.pos)
  s.stress += 0.5*Math.exp(-d/20)
  const x=THREE.MathUtils.clamp(s.stress,0,1)
  let pTurn
  if(x<=0.5) pTurn=THREE.MathUtils.lerp(0,0.001,x/0.5)
  else pTurn=THREE.MathUtils.lerp(0.001,0.01,(x-0.5)/0.5)
  let next=Math.random()<pTurn?2:0
  if(s.copyDuration>DT) next=s.copyState
  enterStarState(i,next,t)
}

function starSocial(i, includeCopy) {
  const s=starlings[i]
  const align=firstVisible(i,7)
  const ad=v(); for(const ni of align)ad.add(starlings[ni.idx].dir)
  if(ad.lengthSq()>1e-12)s.steering.add(ad.normalize().multiplyScalar(STAR.alignW))

  const coh=firstVisible(i,7)
  const of=v(); for(const ni of coh)of.add(starlings[ni.idx].pos.clone().sub(s.pos))
  if(coh.length) {
    const w=STAR.cohereW*(of.clone().multiplyScalar(1/coh.length).length())
    if(of.lengthSq()>1e-12)s.steering.add(of.normalize().multiplyScalar(w))
  }

  const avoid=firstVisible(i,1,(ni)=>ni.d2<STAR.minSep*STAR.minSep)
  const av=v(); for(const ni of avoid)av.add(s.pos.clone().sub(starlings[ni.idx].pos))
  if(av.lengthSq()>1e-12)s.steering.add(av.normalize().multiplyScalar(STAR.avoidW))

  if(includeCopy) {
    s.copyDuration=0; s.copyState=0
    const nearest=sortedStarNeighbours(i).slice(0,7)
    for(const ni of nearest) {
      const o=starlings[ni.idx]
      if(visible(s,o,ni.d2) && o.state===2) { s.copyDuration=Math.max(0,o.stateExit-simTime); s.copyState=2; break }
    }
  }
}

function starUpdate(i) {
  const s=starlings[i]; s.steering.set(0,0,0)
  if(s.state===0) {
    starSocial(i,true)
    s.steering.addScaledVector(perp(s.dir), THREE.MathUtils.lerp(-STAR.wiggleW,STAR.wiggleW,Math.random()))
    chooseStarState(i,simTime)
  } else if(s.state===1) {
    s.steering.addScaledVector(perp(s.dir), THREE.MathUtils.lerp(-STAR.wiggleW,STAR.wiggleW,Math.random()))
    starSocial(i,false)
    if(simTime>=s.stateExit) chooseStarState(i,simTime)
  } else {
    const home=s.homePos.clone().sub(s.pos)
    if(home.lengthSq()>1e-12)s.steering.add(home.normalize().multiplyScalar(STAR.homeW))
    starSocial(i,false)
    s.steering.addScaledVector(perp(s.dir), THREE.MathUtils.lerp(-STAR.wiggleW,STAR.wiggleW,Math.random()))
    if(simTime>=s.stateExit) enterStarState(i,1,simTime)
  }
  s.nextUpdate=simTime+0.05
}

function nearestStar(pos) {
  let idx=0,b=Infinity
  for(let i=0;i<N;i++){const d=pos.distanceToSquared(starlings[i].pos);if(d<b){b=d;idx=i}}
  return idx
}
function enterPredState(state,t) {
  predator.state=state
  if(state===0){predator.stateExit=Infinity;return}
  if(state===3){predator.stateExit=t+10;predator.holdPos.copy(predator.pos)}
  if(state===1){
    predator.stateExit=t+30
    const cs=components().sort((a,b)=>b.length-a.length), target=cs[0]?.[0] ?? 0
    predator.target=target
    const s=starlings[target]
    predator.pos.copy(s.pos).addScaledVector(rotateXY(s.dir,THREE.MathUtils.degToRad(190)),20)
    predator.dir.copy(s.dir)
  }
  if(state===2) predator.stateExit=t+20
}
function nextPredState() {
  if(predator.state===0)return 3
  if(predator.state===3)return 1
  if(predator.state===1)return 2
  return 0
}
function predUpdate() {
  const p=predator; p.steering.set(0,0,0)
  if(p.state===0) {
    p.pos.addScaledVector(rotateXY(p.dir,Math.PI),400)
    p.dir.copy(rotateXY(p.dir,Math.PI)); p.speed=10
    enterPredState(3,simTime)
  } else if(p.state===3) {
    p.steering.addScaledVector(perp(p.dir),THREE.MathUtils.lerp(-1,1,Math.random()))
    const ni=nearestStar(p.pos), away=p.pos.clone().sub(starlings[ni].pos)
    if(away.lengthSq()>1e-12)p.steering.add(away.normalize().multiplyScalar(5))
    const home=p.holdPos.clone().sub(p.pos)
    if(home.lengthSq()>1e-12)p.steering.add(home.normalize().multiplyScalar(25))
    if(simTime>=p.stateExit)enterPredState(1,simTime)
  } else if(p.state===1) {
    const s=starlings[p.target>=0?p.target:0]
    const desired=s.pos.clone().addScaledVector(rotateXY(s.dir,THREE.MathUtils.degToRad(190)),20)
    const off=desired.sub(p.pos)
    if(off.lengthSq()>1e-12)p.steering.add(off.normalize().multiplyScalar(10))
    p.speed=1.2*s.speed
    if(simTime>=p.stateExit)enterPredState(2,simTime)
  } else {
    p.steering.addScaledVector(perp(p.dir),THREE.MathUtils.lerp(-1,1,Math.random()))
    const ni=nearestStar(p.pos), s=starlings[ni], off=s.pos.clone().sub(p.pos)
    if(off.lengthSq()>1e-12)p.steering.add(off.normalize().multiplyScalar(5))
    p.speed=1.5*s.speed
    if(simTime>=p.stateExit)enterPredState(0,simTime)
  }
  p.nextUpdate=simTime+0.05
}

function integrateBody(a,mass,minSpeed,maxSpeed,cruise,cruiseW) {
  const h=DT*0.5
  const dv=cruise-a.speed
  a.steering.addScaledVector(a.dir,cruiseW*dv*mass)
  const vel=a.dir.clone().multiplyScalar(a.speed).addScaledVector(a.accel,h)
  a.pos.addScaledVector(vel,DT)
  a.accel.copy(a.steering).multiplyScalar(1/mass)
  vel.addScaledVector(a.accel,h)
  let sp=vel.length(); if(sp<1e-12)sp=minSpeed
  a.dir.copy(safeNorm(vel,a.dir.clone()))
  a.speed=THREE.MathUtils.clamp(sp,minSpeed,maxSpeed)
  a.pos.z=0; a.dir.z=0
}
function integrateAll() {
  for(const s of starlings){
    const cfg=s.state===0?STAR.normal:(s.state===1?STAR.penalty:STAR.turn)
    integrateBody(s,STAR.mass,STAR.minSpeed,STAR.maxSpeed,cfg.cruise,cfg.cruiseW)
  }
  const pcfg=predator.state===0?PRED.retreat:predator.state===1?PRED.shadow:predator.state===2?PRED.chase:PRED.hold
  integrateBody(predator,PRED.mass,PRED.minSpeed,PRED.maxSpeed,pcfg.cruise,pcfg.cruiseW)
}

function physicsStep(){
  for(let i=0;i<N;i++)if(starlings[i].nextUpdate<=simTime+1e-12)starUpdate(i)
  if(predator.nextUpdate<=simTime+1e-12)predUpdate()
  integrateAll(); simTime+=DT
}

const centroid=v(), camTarget=v()
function render(){
  centroid.set(0,0,0); for(const s of starlings)centroid.add(s.pos); centroid.multiplyScalar(1/N)
  for(const s of starlings)s.mesh.position.copy(s.pos).sub(centroid)
  predator.mesh.position.copy(predator.pos).sub(centroid)
  camTarget.set(0,0,0); camera.lookAt(camTarget)

  const turning=starlings.filter(s=>s.state===2).length
  const penalty=starlings.filter(s=>s.state===1).length
  const predName=['retreat','shadowing','chase','hold'][predator.state]
  label.textContent=`ColT-Model original config — 30 étourneaux + 1 prédateur | t=${simTime.toFixed(1)} s | virage=${turning} | pénalité=${penalty} | prédateur=${predName}`
  renderer.render(scene,camera)
}

function animate(){
  requestAnimationFrame(animate)
  const now=performance.now(), realDt=Math.min((now-last)/1000,0.05); last=now; accumulator+=realDt
  let n=0; while(accumulator>=DT && n<20){physicsStep();accumulator-=DT;n++}
  if(n===20)accumulator=0
  render()
}
animate()

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2))})
