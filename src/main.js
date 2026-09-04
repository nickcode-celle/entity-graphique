import * as THREE from 'three'
import GUI from 'lil-gui'
import './style.css'

// ENTITY — REFERENCE-1
// Normal flocking reference based on the published StarEscape structure:
// asynchronous perception -> social steering forces -> acceleration -> velocity -> position.
// No leader, no shared path, no screen-edge steering, no global reconnect force.

const app = document.querySelector('#app')
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x16181b)

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 200)
camera.position.set(0, 0, 18)

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
  physicsDt: 0.001,
  reactionTime: 0.050,
  neighbours: 7,
  avoidNeighbours: 1,
  fovDeg: 270,
  bodyMass: 0.08,
  cruiseSpeed: 9,
  minSpeed: 5,
  maxSpeed: 15,
  alignWeight: 0.5,
  cohesionWeight: 1.5,
  avoidWeight: 0.5,
  avoidDistance: 0.8,
  cohesionFullDistance: 5,
  wiggleWeight: 0.1,
  roostWeight: 0.25,
  roostRadius: 100,
  altitudeWeight: 0.1,
  levelWeight: 0.1,
  initialRadius: 10,
  initialDirectionDeviationDeg: 0.001,
})

const view = {
  simToView: 0.42,
  cameraFollow: 3.2,
  showMetrics: true,
}

const gui = new GUI({ title: 'ENTITY — REFERENCE-1' })
gui.add(view, 'simToView', 0.25, 0.65, 0.01).name('Échelle visuelle')
gui.add(view, 'cameraFollow', 0.5, 8, 0.1).name('Suivi caméra')
gui.add(view, 'showMetrics').name('Mesures')

const metrics = {
  polarisation: '—',
  vitesseMoy: '—',
  ecartVitesse: '—',
  voisinProche: '—',
  composantes: '—',
}
const mf = gui.addFolder('Diagnostic')
mf.add(metrics, 'polarisation').listen().disable()
mf.add(metrics, 'vitesseMoy').listen().disable()
mf.add(metrics, 'ecartVitesse').listen().disable()
mf.add(metrics, 'voisinProche').listen().disable()
mf.add(metrics, 'composantes').listen().disable()

const geometry = new THREE.SphereGeometry(0.105, 20, 20)
const material = new THREE.MeshStandardMaterial({
  color: 0xf1f3f5,
  roughness: 0.32,
  metalness: 0.04,
})

const agents = []
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)
const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()
const tmpC = new THREE.Vector3()
const centroid = new THREE.Vector3()
const cameraTarget = new THREE.Vector3()
const renderOffset = new THREE.Vector3()

function smootherstep(x, edge0, edge1) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function randomNormal() {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function makeLocalFrame(forward, previousUp = Y_AXIS) {
  const f = forward.clone().normalize()
  let side = new THREE.Vector3().crossVectors(f, previousUp)
  if (side.lengthSq() < 1e-8) side.crossVectors(f, new THREE.Vector3(0, 0, 1))
  side.normalize()
  const up = new THREE.Vector3().crossVectors(side, f).normalize()
  return { forward: f, side, up }
}

function initialise() {
  const dev = THREE.MathUtils.degToRad(REF.initialDirectionDeviationDeg)

  for (let i = 0; i < REF.N; i++) {
    const mesh = new THREE.Mesh(geometry, material.clone())
    scene.add(mesh)

    // StarEscape 'flock' initial condition: random positions in a cube,
    // almost identical initial headings and common cruise speed.
    const position = new THREE.Vector3(
      Math.random() * REF.initialRadius,
      Math.random() * REF.initialRadius,
      Math.random() * REF.initialRadius
    )
    position.subScalar(REF.initialRadius * 0.5)

    const yaw = randomNormal() * dev
    const direction = X_AXIS.clone().applyAxisAngle(Y_AXIS, yaw).normalize()
    const velocity = direction.clone().multiplyScalar(REF.cruiseSpeed)
    const frame = makeLocalFrame(direction)

    agents.push({
      mesh,
      position,
      velocity,
      acceleration: new THREE.Vector3(),
      steering: new THREE.Vector3(),
      frame,
      speed: REF.cruiseSpeed,
      // Same 50 ms period, one stable asynchronous phase chosen once.
      nextReaction: Math.random() * REF.reactionTime,
      lastNeighbours: [],
    })
  }
}
initialise()

const cosHalfFov = Math.cos(THREE.MathUtils.degToRad(REF.fovDeg * 0.5))

function inFov(agent, other) {
  tmpA.copy(other.position).sub(agent.position)
  const len2 = tmpA.lengthSq()
  if (len2 < 1e-10) return true
  tmpA.multiplyScalar(1 / Math.sqrt(len2))
  return agent.frame.forward.dot(tmpA) >= cosHalfFov
}

function sortedVisibleNeighbours(index) {
  const self = agents[index]
  const list = []
  for (let j = 0; j < REF.N; j++) {
    if (j === index) continue
    const other = agents[j]
    const d2 = self.position.distanceToSquared(other.position)
    if (inFov(self, other)) list.push({ index: j, d2 })
  }
  list.sort((a, b) => a.d2 - b.d2)
  return list
}

function behaviouralUpdate(index) {
  const self = agents[index]
  const visible = sortedVisibleNeighbours(index)
  const social = visible.slice(0, REF.neighbours)
  self.lastNeighbours = social.map(n => n.index)
  self.steering.set(0, 0, 0)

  // Alignment: normalized sum of the headings of the topological neighbours.
  tmpA.set(0, 0, 0)
  for (const n of social) tmpA.add(agents[n.index].frame.forward)
  if (tmpA.lengthSq() > 1e-10) {
    tmpA.normalize().multiplyScalar(REF.alignWeight)
    self.steering.add(tmpA)
  }

  // Cohesion: direction to the local centroid; magnitude rises smoothly
  // with distance to that centroid and reaches the published maximum at 5 m.
  if (social.length) {
    tmpA.set(0, 0, 0)
    for (const n of social) tmpA.add(agents[n.index].position)
    tmpA.multiplyScalar(1 / social.length)
    tmpB.copy(tmpA).sub(self.position)
    const d = tmpB.length()
    if (d > 1e-8) {
      const w = REF.cohesionWeight * smootherstep(d, 0, REF.cohesionFullDistance)
      self.steering.add(tmpB.multiplyScalar(w / d))
    }
  }

  // Avoidance: closest visible neighbour only.
  const closest = visible[0]
  if (closest && closest.d2 < REF.avoidDistance * REF.avoidDistance) {
    tmpA.copy(self.position).sub(agents[closest.index].position)
    if (tmpA.lengthSq() > 1e-10) self.steering.add(tmpA.normalize().multiplyScalar(REF.avoidWeight))
  }

  // Roost analogue in simulation units: weak horizontal return outside radius.
  // It is a territory field, never a screen-edge bounce.
  const horizontalR = Math.hypot(self.position.x, self.position.z)
  if (horizontalR > REF.roostRadius) {
    const excess = smootherstep(horizontalR, REF.roostRadius, REF.roostRadius * 1.35)
    tmpA.set(-self.position.x, 0, -self.position.z)
    if (tmpA.lengthSq() > 1e-10) self.steering.add(tmpA.normalize().multiplyScalar(REF.roostWeight * excess))
  }

  // Very weak altitude tendency. It acts independently of horizontal territory.
  // We keep the reference flock centred around altitude y=0 for the visual test.
  const alt = Math.abs(self.position.y)
  if (alt > REF.initialRadius * 0.55) {
    const aw = smootherstep(alt, REF.initialRadius * 0.55, REF.initialRadius * 1.5)
    self.steering.y += -Math.sign(self.position.y) * REF.altitudeWeight * aw
  }

  // Published wiggle principle: a small random lateral force in the agent's
  // own local frame, sampled only at behavioural updates.
  const wiggle = THREE.MathUtils.lerp(-REF.wiggleWeight, REF.wiggleWeight, Math.random())
  self.steering.addScaledVector(self.frame.side, wiggle)
}

function integrateAgent(a, dt) {
  // Cruise-speed control is a force, not a hard speed assignment.
  const speed = a.velocity.length()
  const cruiseForce = (REF.cruiseSpeed - speed) * REF.bodyMass
  tmpA.copy(a.velocity)
  if (tmpA.lengthSq() < 1e-10) tmpA.copy(a.frame.forward)
  else tmpA.normalize()

  tmpB.copy(a.steering).addScaledVector(tmpA, cruiseForce)
  a.acceleration.copy(tmpB).multiplyScalar(1 / REF.bodyMass)

  // Midpoint integration: acceleration bends the existing velocity instead
  // of replacing its direction.
  tmpC.copy(a.velocity).addScaledVector(a.acceleration, dt * 0.5)
  a.position.addScaledVector(tmpC, dt)
  a.velocity.addScaledVector(a.acceleration, dt)

  let newSpeed = a.velocity.length()
  if (!Number.isFinite(newSpeed) || newSpeed < 1e-8) {
    a.velocity.copy(a.frame.forward).multiplyScalar(REF.minSpeed)
    newSpeed = REF.minSpeed
  }
  if (newSpeed < REF.minSpeed) a.velocity.multiplyScalar(REF.minSpeed / newSpeed)
  else if (newSpeed > REF.maxSpeed) a.velocity.multiplyScalar(REF.maxSpeed / newSpeed)

  a.speed = a.velocity.length()
  a.frame = makeLocalFrame(a.velocity, a.frame.up)
}

let simTime = 0
let accumulator = 0
let metricTimer = 0

function physicsStep(dt) {
  // Perception/decision is asynchronous; steering is held between reactions.
  for (let i = 0; i < REF.N; i++) {
    const a = agents[i]
    if (simTime + 1e-12 >= a.nextReaction) {
      behaviouralUpdate(i)
      do a.nextReaction += REF.reactionTime
      while (a.nextReaction <= simTime)
    }
  }

  for (const a of agents) integrateAgent(a, dt)
  simTime += dt
}

function computeCentroid() {
  centroid.set(0, 0, 0)
  for (const a of agents) centroid.add(a.position)
  centroid.multiplyScalar(1 / REF.N)
}

function connectedComponents() {
  const seen = new Array(REF.N).fill(false)
  let components = 0
  for (let root = 0; root < REF.N; root++) {
    if (seen[root]) continue
    components++
    const stack = [root]
    seen[root] = true
    while (stack.length) {
      const i = stack.pop()
      for (const j of agents[i].lastNeighbours) {
        if (!seen[j]) {
          seen[j] = true
          stack.push(j)
        }
      }
    }
  }
  return components
}

function updateMetrics() {
  const meanDir = new THREE.Vector3()
  let speedSum = 0
  let speed2Sum = 0
  let nndSum = 0

  for (let i = 0; i < REF.N; i++) {
    const a = agents[i]
    meanDir.add(a.frame.forward)
    speedSum += a.speed
    speed2Sum += a.speed * a.speed

    let best = Infinity
    for (let j = 0; j < REF.N; j++) {
      if (i === j) continue
      best = Math.min(best, a.position.distanceToSquared(agents[j].position))
    }
    nndSum += Math.sqrt(best)
  }

  const meanSpeed = speedSum / REF.N
  const variance = Math.max(0, speed2Sum / REF.N - meanSpeed * meanSpeed)
  metrics.polarisation = (meanDir.length() / REF.N).toFixed(3)
  metrics.vitesseMoy = meanSpeed.toFixed(2)
  metrics.ecartVitesse = Math.sqrt(variance).toFixed(2)
  metrics.voisinProche = (nndSum / REF.N).toFixed(2)
  metrics.composantes = String(connectedComponents())
}

function renderAgents(dt) {
  computeCentroid()

  // Camera follows the flock visually. This has zero effect on its physics and
  // replaces every artificial per-marble screen-edge force used in old versions.
  cameraTarget.lerp(centroid, 1 - Math.exp(-view.cameraFollow * dt))
  renderOffset.copy(cameraTarget).multiplyScalar(-view.simToView)

  for (const a of agents) {
    a.mesh.position.copy(a.position).multiplyScalar(view.simToView).add(renderOffset)
    const depth = THREE.MathUtils.clamp((a.mesh.position.z + 3) / 6, 0, 1)
    a.mesh.scale.setScalar(THREE.MathUtils.lerp(0.88, 1.14, depth))
    a.mesh.material.color.setHSL(0.60, 0.04, THREE.MathUtils.lerp(0.58, 0.96, depth))
  }
}

// Invisible acclimatisation: let the reference flock organise itself before
// the first displayed frame, as done conceptually in the scientific workflow.
for (let i = 0; i < 3000; i++) physicsStep(REF.physicsDt)
updateMetrics()

const clock = new THREE.Clock()
function animate() {
  requestAnimationFrame(animate)
  const frameDt = Math.min(clock.getDelta(), 0.05)
  accumulator += frameDt

  let steps = 0
  const maxSteps = 60
  while (accumulator >= REF.physicsDt && steps < maxSteps) {
    physicsStep(REF.physicsDt)
    accumulator -= REF.physicsDt
    steps++
  }
  if (steps === maxSteps) accumulator = 0

  metricTimer += frameDt
  if (metricTimer >= 0.5) {
    metricTimer = 0
    if (view.showMetrics) updateMetrics()
  }

  renderAgents(frameDt)
  renderer.render(scene, camera)
}
animate()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})
