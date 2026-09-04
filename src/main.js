import * as THREE from 'three'
import GUI from 'lil-gui'
import './style.css'

const app = document.querySelector('#app')
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x16181b)

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 0, 11)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
app.appendChild(renderer.domElement)

const params = {
  neighbours: 7,
  cruiseSpeed: 0.031,
  minSpeed: 0.024,
  maxSpeed: 0.040,
  alignment: 0.88,
  attraction: 0.32,
  preferredDistance: 0.72,
  separation: 1.25,
  dangerDistance: 0.27,
  reactionMin: 0.045,
  reactionMax: 0.085,
  turnInertia: 4.2,
  angularInertia: 5.6,
  depth: 0.55,
  depthForce: 0.30,
  anisotropy: 0.42,
  initiative: 0.18,
  initiativeRate: 0.055,
  tension: 0.18,
  frameX: 3.25,
  frameY: 1.95,
  reconnectDistance: 1.35,
  reconnectForce: 0.55,
}

const gui = new GUI({ title: 'ENTITY — Murmuration V13' })
gui.add(params, 'neighbours', 4, 10, 1).name('Voisins topologiques')
gui.add(params, 'cruiseSpeed', 0.018, 0.05, 0.001).name('Vitesse croisière')
gui.add(params, 'minSpeed', 0.012, 0.04, 0.001).name('Vitesse mini')
gui.add(params, 'maxSpeed', 0.025, 0.06, 0.001).name('Vitesse maxi')
gui.add(params, 'alignment', 0.3, 1.4, 0.02).name('Alignement')
gui.add(params, 'attraction', 0.05, 0.8, 0.01).name('Attraction locale')
gui.add(params, 'preferredDistance', 0.4, 1.1, 0.02).name('Distance confortable')
gui.add(params, 'separation', 0.2, 2.4, 0.05).name('Répulsion proche')
gui.add(params, 'dangerDistance', 0.16, 0.45, 0.01).name('Distance sécurité')
gui.add(params, 'turnInertia', 1.0, 8.0, 0.1).name('Fluidité direction')
gui.add(params, 'angularInertia', 1.0, 10.0, 0.1).name('Inertie virage')
gui.add(params, 'anisotropy', 0, 0.8, 0.02).name('Anisotropie')
gui.add(params, 'initiative', 0, 0.5, 0.01).name('Initiative locale')
gui.add(params, 'initiativeRate', 0, 0.15, 0.005).name('Fréquence initiative')
gui.add(params, 'depth', 0.15, 1.0, 0.02).name('Profondeur')
gui.add(params, 'depthForce', 0.05, 0.8, 0.02).name('Rappel profondeur')
gui.add(params, 'tension', 0, 0.5, 0.01).name('Tension du corps')
gui.add(params, 'frameX', 2.4, 4.0, 0.05).name('Cadre horizontal')
gui.add(params, 'frameY', 1.4, 2.6, 0.05).name('Cadre vertical')
gui.add(params, 'reconnectDistance', 0.9, 2.0, 0.05).name('Seuil reconnexion')
gui.add(params, 'reconnectForce', 0.1, 1.2, 0.05).name('Force reconnexion')

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

const geometry = new THREE.SphereGeometry(0.105, 20, 20)
const marbles = []
const clock = new THREE.Clock()
const N = 100

function bell() {
  return (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 0.5
}

for (let i = 0; i < N; i++) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xf1f3f5,
    roughness: 0.32,
    metalness: 0.04,
  })
  const mesh = new THREE.Mesh(geometry, material)

  // Broad, shallow, irregular initial body — no rows, no route.
  const a = Math.random() * Math.PI * 2
  const r = Math.sqrt(Math.random())
  mesh.position.set(
    Math.cos(a) * r * 1.72 + bell() * 0.22,
    Math.sin(a) * r * 0.88 + bell() * 0.16,
    bell() * params.depth * 0.42
  )

  const heading = new THREE.Vector3(
    1,
    bell() * 0.16,
    bell() * 0.035
  ).normalize()

  marbles.push({
    mesh,
    heading,
    desiredHeading: heading.clone(),
    angularVelocity: new THREE.Vector3(),
    speed: params.cruiseSpeed * THREE.MathUtils.lerp(0.93, 1.07, Math.random()),
    reactionPeriod: THREE.MathUtils.lerp(params.reactionMin, params.reactionMax, Math.random()),
    reactionTimer: Math.random() * 0.08,
    phase: Math.random() * Math.PI * 2,
    initiativeTimer: THREE.MathUtils.lerp(1.5, 6.0, Math.random()),
  })
  scene.add(mesh)
}

const tmp = new THREE.Vector3()
const tmp2 = new THREE.Vector3()
const tmp3 = new THREE.Vector3()
const centroid = new THREE.Vector3()
const meanHeading = new THREE.Vector3()
const environmentalBias = new THREE.Vector3()

function rotateAroundZ(v, angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return new THREE.Vector3(v.x * c - v.y * s, v.x * s + v.y * c, v.z).normalize()
}

function computeGlobalState() {
  centroid.set(0, 0, 0)
  meanHeading.set(0, 0, 0)
  for (const m of marbles) {
    centroid.add(m.mesh.position)
    meanHeading.add(m.heading)
  }
  centroid.multiplyScalar(1 / N)
  if (meanHeading.lengthSq() > 0.0001) meanHeading.normalize()

  // Same environmental influence for the whole body: no marble sees a screen edge.
  environmentalBias.set(0, 0, 0)
  const nx = Math.abs(centroid.x) / params.frameX
  const ny = Math.abs(centroid.y) / params.frameY
  if (nx > 0.46 || ny > 0.44) {
    environmentalBias.set(-centroid.x / params.frameX, -centroid.y / params.frameY, 0)
    const strength = THREE.MathUtils.clamp(Math.max(nx - 0.42, ny - 0.40) * 1.15, 0, 0.72)
    environmentalBias.multiplyScalar(strength)
  }
}

function nearestNeighbours(index, count) {
  const m = marbles[index]
  const list = []
  for (let j = 0; j < N; j++) {
    if (j === index) continue
    list.push({ index: j, d2: m.mesh.position.distanceToSquared(marbles[j].mesh.position) })
  }
  list.sort((a, b) => a.d2 - b.d2)
  return list.slice(0, count)
}

function neighbourWeight(m, other) {
  // Lateral neighbours matter more than agents directly ahead/behind.
  tmp.copy(other.mesh.position).sub(m.mesh.position)
  if (tmp.lengthSq() < 0.00001) return 1
  tmp.normalize()
  const foreAft = Math.abs(tmp.dot(m.heading))
  return THREE.MathUtils.lerp(1, 1 - params.anisotropy, foreAft)
}

function decide(index, elapsed) {
  const m = marbles[index]
  const neighbours = nearestNeighbours(index, Math.max(1, Math.round(params.neighbours)))
  const closest = neighbours[0]

  const align = new THREE.Vector3()
  const localCenter = new THREE.Vector3()
  let weightSum = 0
  let meanDistance = 0

  for (const n of neighbours) {
    const other = marbles[n.index]
    const w = neighbourWeight(m, other)
    align.addScaledVector(other.heading, w)
    localCenter.addScaledVector(other.mesh.position, w)
    weightSum += w
    meanDistance += Math.sqrt(n.d2)
  }

  if (weightSum > 0) {
    align.multiplyScalar(1 / weightSum)
    localCenter.multiplyScalar(1 / weightSum)
  }
  meanDistance /= neighbours.length

  const desired = m.heading.clone()

  // Alignment is the main social rule.
  if (align.lengthSq() > 0.0001) {
    align.normalize()
    desired.addScaledVector(align, params.alignment)
  }

  // Attraction exists only when the neighbourhood opens too much.
  const comfort = params.preferredDistance * (1 + Math.sin(elapsed * 0.09) * params.tension * 0.18)
  if (meanDistance > comfort) {
    tmp2.copy(localCenter).sub(m.mesh.position)
    if (tmp2.lengthSq() > 0.0001) {
      tmp2.normalize()
      const excess = THREE.MathUtils.clamp((meanDistance - comfort) / comfort, 0, 1.3)
      desired.addScaledVector(tmp2, params.attraction * excess)
    }
  }

  // Strong short-range avoidance: nearest neighbour only.
  if (closest) {
    const d = Math.sqrt(closest.d2)
    if (d < params.dangerDistance && d > 0.0001) {
      tmp2.copy(m.mesh.position).sub(marbles[closest.index].mesh.position).normalize()
      const urgency = 1 - d / params.dangerDistance
      desired.addScaledVector(tmp2, params.separation * urgency * urgency)
    }
  }

  // Shallow volume, but never a flat plane.
  const zLimit = Math.max(0.08, params.depth)
  const zNorm = Math.abs(m.mesh.position.z) / zLimit
  if (zNorm > 0.28) {
    desired.z += -m.mesh.position.z * params.depthForce * THREE.MathUtils.clamp(zNorm, 0, 1.6)
  }

  // Collective territory influence.
  desired.addScaledVector(environmentalBias, 0.72)

  // Rare local initiative — smooth, never frame-by-frame noise.
  m.initiativeTimer -= m.reactionPeriod
  if (m.initiativeTimer <= 0 && Math.random() < params.initiativeRate) {
    const sign = Math.random() < 0.5 ? -1 : 1
    const angle = sign * THREE.MathUtils.lerp(0.07, 0.20, Math.random()) * params.initiative
    const impulse = rotateAroundZ(m.heading, angle)
    desired.addScaledVector(impulse, 0.55)
    m.initiativeTimer = THREE.MathUtils.lerp(2.0, 7.0, Math.random())
  } else if (m.initiativeTimer <= 0) {
    m.initiativeTimer = THREE.MathUtils.lerp(0.5, 2.0, Math.random())
  }

  // Emergency network safety only if the 7th neighbour is abnormally far away.
  const outerDistance = Math.sqrt(neighbours[neighbours.length - 1].d2)
  if (outerDistance > params.reconnectDistance) {
    tmp3.copy(centroid).sub(m.mesh.position)
    if (tmp3.lengthSq() > 0.0001) {
      tmp3.normalize()
      const rescue = THREE.MathUtils.clamp(
        (outerDistance - params.reconnectDistance) / params.reconnectDistance,
        0,
        1
      )
      desired.addScaledVector(tmp3, params.reconnectForce * rescue)
    }
  }

  if (desired.lengthSq() > 0.0001) desired.normalize()

  // Never authorize an actual reversal.
  if (desired.dot(m.heading) < 0.18) {
    desired.lerp(m.heading, 0.76).normalize()
  }

  m.desiredHeading.copy(desired)

  // Speed can breathe, but it always remains strictly positive.
  const localCompression = THREE.MathUtils.clamp((comfort - meanDistance) / Math.max(comfort, 0.01), -1, 1)
  const targetSpeed = THREE.MathUtils.clamp(
    params.cruiseSpeed * (1 - localCompression * 0.12),
    params.minSpeed,
    params.maxSpeed
  )
  m.speed = THREE.MathUtils.lerp(m.speed, targetSpeed, 0.22)
}

function integrate(m, dt) {
  // Behavioural inertia: direction does not jump to the latest decision.
  tmp.copy(m.desiredHeading).sub(m.heading)
  m.angularVelocity.lerp(tmp.multiplyScalar(params.turnInertia), 1 - Math.exp(-params.angularInertia * dt))
  m.heading.addScaledVector(m.angularVelocity, dt).normalize()

  // Final hard guard against pathological backwards dynamics.
  if (m.heading.lengthSq() < 0.0001) m.heading.set(1, 0, 0)
  m.speed = THREE.MathUtils.clamp(m.speed, Math.max(0.001, params.minSpeed), params.maxSpeed)
  m.mesh.position.addScaledVector(m.heading, m.speed * dt * 60)
}

function updateDepthCue(m) {
  const zNorm = THREE.MathUtils.clamp((m.mesh.position.z / Math.max(params.depth, 0.01) + 1) * 0.5, 0, 1)
  m.mesh.scale.setScalar(THREE.MathUtils.lerp(0.86, 1.16, zNorm))
  m.mesh.material.color.setHSL(0.60, 0.05, THREE.MathUtils.lerp(0.55, 0.96, zNorm))
}

function updateSwarm(dt, elapsed) {
  computeGlobalState()

  for (let i = 0; i < N; i++) {
    const m = marbles[i]
    m.reactionTimer -= dt
    if (m.reactionTimer <= 0) {
      decide(i, elapsed)
      m.reactionPeriod = THREE.MathUtils.lerp(params.reactionMin, params.reactionMax, Math.random())
      m.reactionTimer += m.reactionPeriod
    }
  }

  for (const m of marbles) {
    integrate(m, dt)
    updateDepthCue(m)
  }
}

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 1 / 30)
  updateSwarm(dt, clock.elapsedTime)
  renderer.render(scene, camera)
}
animate()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})
