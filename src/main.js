import * as THREE from 'three'
import GUI from 'lil-gui'
import './style.css'

// ENTITY — STARESCAPE PORT 1 / TRAJECTORY DIAGNOSTIC
// Physics unchanged. The camera is fixed and the centroid path is drawn in world space.

const app = document.querySelector('#app')
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x16181b)

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 500)
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
app.appendChild(renderer.domElement)

scene.add(new THREE.HemisphereLight(0xf4f6ff, 0x20242a, 1.15))
const keyLight = new THREE.DirectionalLight(0xffffff, 2.6)
keyLight.position.set(4.5, 5.5, 7)
scene.add(keyLight)
const rimLight = new THREE.DirectionalLight(0xbfd6ff, 2.2)
rimLight.position.set(-6, 2, -3)
scene.add(rimLight)
const lowLight = new THREE.DirectionalLight(0xffffff, 0.65)
lowLight.position.set(1, -5, 4)
scene.add(lowLight)

const REF = Object.freeze({
  N: 100,
  dt: 0.001,
  reactionTime: 0.05,
  firstUpdateWindow: 1.0,
  topo: 7,
  avoidTopo: 1,
  fovDeg: 270,
  maxDist: 200,
  bodyMass: 0.08,
  cruiseSpeed: 9,
  minSpeed: 5,
  maxSpeed: 15,
  cruiseWeight: 0.5,
  betaIn: THREE.MathUtils.degToRad(120),
  alignWeight: 0.5,
  cohesionWeight: 1.5,
  cohesionMinDistance: 0,
  cohesionMaxDistance: 5,
  avoidWeight: 0.5,
  minSep: 0.8,
  roostRadius: 100,
  roostX: 50,
  roostZ: 100,
  roostWeight: 0.25,
  altitudePreferred: 0,
  altitudeSmoothRange: 200,
  altitudeMaxPitchDeg: 45,
  altitudeWeight: 0.1,
  levelMaxPitchDeg: 45,
  levelWeight: 0.1,
  wiggleWeight: 0.1,
  initRadius: 10,
  initAltitude: 0,
  initDir: new THREE.Vector3(1, 0, 0),
  initDegDev: 0.001,
})

const view = {
  worldScale: 0.10,
  cameraX: 8,
  cameraY: 14,
  cameraZ: 24,
  targetX: 7,
  targetY: 1,
  targetZ: 6,
}

const gui = new GUI({ title: 'ENTITY — Trajectoire StarEscape' })
gui.add(view, 'worldScale', 0.05, 0.20, 0.01).name('Échelle monde')
gui.add(view, 'cameraX', -10, 30, 1).name('Caméra X')
gui.add(view, 'cameraY', 5, 40, 1).name('Caméra Y')
gui.add(view, 'cameraZ', 10, 50, 1).name('Caméra Z')

const diagnostics = {
  polarisation: '—',
  vitesse: '—',
  ecartVitesse: '—',
  nnd: '—',
  composantes: '—',
  distanceCentroid: '—',
}
const folder = gui.addFolder('Diagnostic')
folder.add(diagnostics, 'polarisation').listen().disable()
folder.add(diagnostics, 'vitesse').listen().disable()
folder.add(diagnostics, 'ecartVitesse').listen().disable()
folder.add(diagnostics, 'nnd').listen().disable()
folder.add(diagnostics, 'composantes').listen().disable()
folder.add(diagnostics, 'distanceCentroid').listen().disable()

const geometry = new THREE.SphereGeometry(0.105, 20, 20)
const baseMaterial = new THREE.MeshStandardMaterial({
  color: 0xf1f3f5,
  roughness: 0.32,
  metalness: 0.04,
})

const agents = []
const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)
const tmp1 = new THREE.Vector3()
const tmp2 = new THREE.Vector3()
const tmp3 = new THREE.Vector3()
const centroid = new THREE.Vector3()
const initialCentroid = new THREE.Vector3()
const trailPoints = []
let lastTrailSample = -Infinity

const trailGeometry = new THREE.BufferGeometry()
const trailMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })
const trailLine = new THREE.Line(trailGeometry, trailMaterial)
scene.add(trailLine)

function smootherstep(x, edge0, edge1) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function smootherstepBipolar(x, edge0, edge1) {
  return -1 + 2 * smootherstep(x, edge0, edge1)
}

function gaussian() {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function safeNormalize(v, fallback) {
  const l2 = v.lengthSq()
  if (l2 > 1e-12 && Number.isFinite(l2)) return v.multiplyScalar(1 / Math.sqrt(l2))
  return v.copy(fallback)
}

function buildHead(direction, position) {
  const forward = direction.clone().normalize()
  const side = new THREE.Vector3().crossVectors(Y, forward)
  if (side.lengthSq() < 1e-12) side.crossVectors(Z, forward)
  side.normalize()
  const up = new THREE.Vector3().crossVectors(forward, side).normalize()
  return {
    forward,
    up,
    side,
    position: position.clone(),
    beta: 0,
    previousVelocity: forward.clone().multiplyScalar(REF.cruiseSpeed),
  }
}

function initialise() {
  const dev = THREE.MathUtils.degToRad(REF.initDegDev)
  for (let i = 0; i < REF.N; i++) {
    const mesh = new THREE.Mesh(geometry, baseMaterial.clone())
    scene.add(mesh)

    const position = new THREE.Vector3(
      Math.random() * REF.initRadius,
      Math.random() * REF.initRadius + REF.initAltitude,
      Math.random() * REF.initRadius
    )

    const yaw = gaussian() * dev
    const direction = REF.initDir.clone().applyAxisAngle(Y, yaw).normalize()
    const head = buildHead(direction, position)

    agents.push({
      mesh,
      position,
      direction,
      speed: REF.cruiseSpeed,
      acceleration: new THREE.Vector3(),
      steering: new THREE.Vector3(),
      head,
      cruiseWeight: 0,
      nextUpdate: Math.floor(Math.random() * (REF.firstUpdateWindow / REF.dt + 1)) * REF.dt,
      neighbours: [],
    })
  }
}
initialise()

const cfov = Math.cos(THREE.MathUtils.degToRad(180 - 0.5 * (360 - REF.fovDeg)))
const maxDist2 = REF.maxDist * REF.maxDist
const minSep2 = REF.minSep * REF.minSep
const roostRadius2 = REF.roostRadius * REF.roostRadius
const maxPitchY = Math.sin(THREE.MathUtils.degToRad(REF.altitudeMaxPitchDeg))
const levelMaxY = Math.sin(THREE.MathUtils.degToRad(REF.levelMaxPitchDeg))
const levelMinSmooth = Math.sin(THREE.MathUtils.degToRad(3))

function sortedNeighbours(index) {
  const self = agents[index]
  const list = []
  for (let j = 0; j < REF.N; j++) {
    if (j === index) continue
    list.push({ index: j, d2: self.position.distanceToSquared(agents[j].position) })
  }
  list.sort((a, b) => a.d2 - b.d2)
  return list
}

function inFov(self, other, d2) {
  if (d2 === 0 || d2 >= maxDist2) return false
  tmp1.copy(other.position).sub(self.position)
  safeNormalize(tmp1, self.direction)
  return self.direction.dot(tmp1) > cfov
}

function topological(index, topo, predicate) {
  const self = agents[index]
  const sorted = sortedNeighbours(index)
  const selected = []
  for (const ni of sorted) {
    if (selected.length >= topo) break
    const other = agents[ni.index]
    if (predicate(self, other, ni)) selected.push(ni)
  }
  return selected
}

function behaviouralUpdate(index) {
  const self = agents[index]
  self.steering.set(0, 0, 0)
  self.cruiseWeight = REF.cruiseWeight

  const alignN = topological(index, REF.topo, (s, o, ni) => inFov(s, o, ni.d2))
  tmp1.set(0, 0, 0)
  for (const ni of alignN) tmp1.add(agents[ni.index].direction)
  if (tmp1.lengthSq() > 1e-12) self.steering.add(tmp1.normalize().multiplyScalar(REF.alignWeight))

  const cohN = topological(index, REF.topo, (s, o, ni) => inFov(s, o, ni.d2))
  tmp1.set(0, 0, 0)
  for (const ni of cohN) tmp1.add(tmp2.copy(agents[ni.index].position).sub(self.position))
  if (cohN.length) {
    const centroidOffset = tmp1.clone().multiplyScalar(1 / cohN.length)
    const d = centroidOffset.length()
    const w = REF.cohesionWeight * smootherstep(d, REF.cohesionMinDistance, REF.cohesionMaxDistance)
    if (tmp1.lengthSq() > 1e-12) self.steering.add(tmp1.normalize().multiplyScalar(w))
  }

  const avoidN = topological(index, REF.avoidTopo, (s, o, ni) => inFov(s, o, ni.d2) && ni.d2 < minSep2)
  tmp1.set(0, 0, 0)
  for (const ni of avoidN) tmp1.add(tmp2.copy(self.position).sub(agents[ni.index].position))
  if (tmp1.lengthSq() > 1e-12) self.steering.add(tmp1.normalize().multiplyScalar(REF.avoidWeight))

  const dx = REF.roostX - self.position.x
  const dz = REF.roostZ - self.position.z
  const r2 = dx * dx + dz * dz
  const rw = REF.roostWeight * smootherstep(r2, roostRadius2, 500000)
  if (r2 > 1e-12 && rw !== 0) {
    const inv = 1 / Math.sqrt(r2)
    self.steering.x += dx * inv * rw
    self.steering.z += dz * inv * rw
  }

  const altDev = self.position.y - REF.altitudePreferred
  const desiredY = -maxPitchY * smootherstepBipolar(altDev, -REF.altitudeSmoothRange, REF.altitudeSmoothRange)
  self.steering.addScaledVector(self.head.up, REF.altitudeWeight * (desiredY - self.direction.y))

  const pitchNow = self.direction.y
  const lw = REF.levelWeight * smootherstep(Math.abs(pitchNow), levelMinSmooth, levelMaxY)
  if (pitchNow < 0) self.steering.addScaledVector(self.head.up, lw)
  else if (pitchNow > 0) self.steering.addScaledVector(self.head.up, -lw)

  const wiggle = THREE.MathUtils.lerp(-REF.wiggleWeight, REF.wiggleWeight, Math.random())
  self.steering.addScaledVector(self.head.side, wiggle)
  self.neighbours = cohN.map(n => n.index)
}

function updateHead(a, dt) {
  const p0 = a.head.position
  const p1 = a.position
  const v = tmp1.copy(p1).sub(p0).multiplyScalar(1 / dt)
  const accelMeasured = tmp2.copy(v).sub(a.head.previousVelocity).multiplyScalar(1 / dt)
  const F = tmp3.copy(accelMeasured).add(new THREE.Vector3(0, -9.81, 0)).multiplyScalar(REF.bodyMass)
  let Flat = a.head.side.dot(F)

  const s = v.length()
  const L = 9.81 * REF.bodyMass * (s * s) / (REF.cruiseSpeed * REF.cruiseSpeed)
  const bankSide = a.head.side.clone().applyAxisAngle(a.head.forward, a.head.beta)
  const bankUp = new THREE.Vector3().crossVectors(a.head.forward, bankSide)
  const Llat = a.head.side.dot(bankUp.multiplyScalar(L))
  Flat = THREE.MathUtils.clamp(Flat, -L / 1.1, L / 1.1)

  if (Llat < Flat) a.head.beta -= dt * REF.betaIn
  else if (Llat > Flat) a.head.beta += dt * REF.betaIn

  const rebuilt = buildHead(a.direction, a.position)
  rebuilt.beta = a.head.beta
  rebuilt.previousVelocity.copy(v)
  a.head = rebuilt
}

function integrate(a, dt) {
  const hdt = 0.5 * dt
  const dv = REF.cruiseSpeed - a.speed
  const linearForce = a.cruiseWeight * dv * REF.bodyMass
  a.steering.addScaledVector(a.direction, linearForce)

  const vel = tmp1.copy(a.direction).multiplyScalar(a.speed)
  vel.addScaledVector(a.acceleration, hdt)
  a.position.addScaledVector(vel, dt)
  a.acceleration.copy(a.steering).multiplyScalar(1 / REF.bodyMass)
  vel.addScaledVector(a.acceleration, hdt)

  let speed = vel.length()
  if (!Number.isFinite(speed) || speed < 1e-12) {
    speed = REF.minSpeed
    a.direction.set(1, 0, 0)
  } else {
    a.direction.copy(vel).multiplyScalar(1 / speed)
  }
  a.speed = THREE.MathUtils.clamp(speed, REF.minSpeed, REF.maxSpeed)
  updateHead(a, dt)
}

let simTime = 0
let accumulator = 0
let metricsTimer = 0
const clock = new THREE.Clock()

function physicsStep() {
  for (let i = 0; i < REF.N; i++) {
    const a = agents[i]
    if (a.nextUpdate <= simTime + 1e-12) {
      behaviouralUpdate(i)
      a.nextUpdate = simTime + REF.reactionTime
    }
  }
  for (const a of agents) integrate(a, REF.dt)
  simTime += REF.dt
}

function computeCentroid() {
  centroid.set(0, 0, 0)
  for (const a of agents) centroid.add(a.position)
  centroid.multiplyScalar(1 / REF.N)
}

computeCentroid()
initialCentroid.copy(centroid)

function componentCount() {
  const seen = new Array(REF.N).fill(false)
  let count = 0
  for (let root = 0; root < REF.N; root++) {
    if (seen[root]) continue
    count++
    const stack = [root]
    seen[root] = true
    while (stack.length) {
      const i = stack.pop()
      for (const j of agents[i].neighbours) {
        if (!seen[j]) {
          seen[j] = true
          stack.push(j)
        }
      }
    }
  }
  return count
}

function updateDiagnostics() {
  const mean = new THREE.Vector3()
  let speedSum = 0
  let speed2 = 0
  let nnd = 0

  for (let i = 0; i < REF.N; i++) {
    const a = agents[i]
    mean.add(a.direction)
    speedSum += a.speed
    speed2 += a.speed * a.speed
    let best = Infinity
    for (let j = 0; j < REF.N; j++) {
      if (i === j) continue
      best = Math.min(best, a.position.distanceToSquared(agents[j].position))
    }
    nnd += Math.sqrt(best)
  }

  const meanSpeed = speedSum / REF.N
  const variance = Math.max(0, speed2 / REF.N - meanSpeed * meanSpeed)
  diagnostics.polarisation = (mean.length() / REF.N).toFixed(3)
  diagnostics.vitesse = meanSpeed.toFixed(2)
  diagnostics.ecartVitesse = Math.sqrt(variance).toFixed(2)
  diagnostics.nnd = (nnd / REF.N).toFixed(2)
  diagnostics.composantes = String(componentCount())
  diagnostics.distanceCentroid = centroid.distanceTo(initialCentroid).toFixed(1)
}

function updateTrail() {
  if (simTime - lastTrailSample < 0.05) return
  lastTrailSample = simTime
  trailPoints.push(centroid.clone().multiplyScalar(view.worldScale))
  if (trailPoints.length > 2500) trailPoints.shift()
  trailGeometry.setFromPoints(trailPoints)
}

function renderScene() {
  computeCentroid()
  updateTrail()

  for (const a of agents) {
    a.mesh.position.copy(a.position).multiplyScalar(view.worldScale)
    const depth = THREE.MathUtils.clamp(a.mesh.position.z / 18 + 0.5, 0, 1)
    a.mesh.scale.setScalar(THREE.MathUtils.lerp(0.88, 1.13, depth))
  }

  camera.position.set(view.cameraX, view.cameraY, view.cameraZ)
  camera.lookAt(view.targetX, view.targetY, view.targetZ)
  renderer.render(scene, camera)
}

function animate() {
  requestAnimationFrame(animate)
  const realDt = Math.min(clock.getDelta(), 0.05)
  accumulator += realDt

  const maxSteps = 80
  let steps = 0
  while (accumulator >= REF.dt && steps < maxSteps) {
    physicsStep()
    accumulator -= REF.dt
    steps++
  }
  if (steps === maxSteps) accumulator = 0

  metricsTimer += realDt
  if (metricsTimer >= 0.25) {
    computeCentroid()
    updateDiagnostics()
    metricsTimer = 0
  }

  renderScene()
}
animate()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})