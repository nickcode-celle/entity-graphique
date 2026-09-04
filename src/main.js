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
  alignment: 0.055,
  attraction: 0.014,
  repulsion: 0.11,
  preferredDistance: 0.82,
  dangerDistance: 0.34,
  speed: 0.034,
  turnRate: 1.35,
  initiativeRate: 0.10,
  turnAngle: 0.78,
  gateWidth: 0.52,
  depth: 0.52,
  groupRadius: 2.65,
  groupTether: 0.012,
  frameX: 2.65,
  frameY: 1.85,
}

const gui = new GUI({ title: 'ENTITY — Murmuration V11.2' })
gui.add(params, 'neighbours', 3, 12, 1).name('Voisins suivis')
gui.add(params, 'alignment', 0, 0.15, 0.001).name('Alignement')
gui.add(params, 'attraction', 0, 0.04, 0.0005).name('Attraction locale')
gui.add(params, 'repulsion', 0, 0.25, 0.002).name('Répulsion')
gui.add(params, 'preferredDistance', 0.45, 1.4, 0.01).name('Distance confortable')
gui.add(params, 'dangerDistance', 0.2, 0.7, 0.01).name('Distance sécurité')
gui.add(params, 'speed', 0.015, 0.08, 0.001).name('Vitesse constante')
gui.add(params, 'turnRate', 0.35, 2.5, 0.05).name('Fluidité virage')
gui.add(params, 'initiativeRate', 0.02, 0.35, 0.01).name('Fréquence virage')
gui.add(params, 'turnAngle', 0.25, 1.25, 0.01).name('Angle virage libre')
gui.add(params, 'gateWidth', 0.15, 1.2, 0.01).name('Largeur zone virage')
gui.add(params, 'depth', 0.10, 1.2, 0.02).name('Profondeur')
gui.add(params, 'groupRadius', 1.8, 4.0, 0.05).name('Rayon cohésion')
gui.add(params, 'groupTether', 0, 0.03, 0.0005).name('Rappel groupe')
gui.add(params, 'frameX', 1.8, 4.0, 0.05).name('Cadre horizontal')
gui.add(params, 'frameY', 1.2, 3.0, 0.05).name('Cadre vertical')

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
let simTime = 0
let nextTurnAt = 2.0 + Math.random() * 3.0
let activeTurn = null

for (let i = 0; i < 100; i++) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xf1f3f5,
    roughness: 0.32,
    metalness: 0.04,
  })
  const mesh = new THREE.Mesh(geometry, material)

  mesh.position.set(
    (Math.random() - 0.5) * 3.8,
    (Math.random() - 0.5) * 1.9,
    (Math.random() - 0.5) * params.depth
  )

  const heading = new THREE.Vector3(
    1,
    (Math.random() - 0.5) * 0.20,
    (Math.random() - 0.5) * 0.06
  ).normalize()

  marbles.push({
    mesh,
    heading,
    desiredHeading: heading.clone(),
    hasCrossedGate: false,
  })

  scene.add(mesh)
}

const center = new THREE.Vector3()
const avgHeading = new THREE.Vector3()
const alignmentForce = new THREE.Vector3()
const attractionForce = new THREE.Vector3()
const repulsionForce = new THREE.Vector3()
const tmp = new THREE.Vector3()
const tmp2 = new THREE.Vector3()
const desired = new THREE.Vector3()
const toCenter = new THREE.Vector3()

function nearestNeighbours(index) {
  const origin = marbles[index].mesh.position
  const distances = []
  for (let j = 0; j < marbles.length; j++) {
    if (j === index) continue
    distances.push({ j, d2: origin.distanceToSquared(marbles[j].mesh.position) })
  }
  distances.sort((a, b) => a.d2 - b.d2)
  return distances.slice(0, params.neighbours)
}

function computeCenterAndHeading() {
  center.set(0, 0, 0)
  avgHeading.set(0, 0, 0)
  for (const m of marbles) {
    center.add(m.mesh.position)
    avgHeading.add(m.heading)
  }
  center.divideScalar(marbles.length)
  if (avgHeading.lengthSq() > 0.0001) avgHeading.normalize()
}

function leadingMarbleIndex() {
  let best = -Infinity
  let idx = 0
  for (let i = 0; i < marbles.length; i++) {
    const score = marbles[i].mesh.position.dot(avgHeading)
    if (score > best) {
      best = score
      idx = i
    }
  }
  return idx
}

function rotatePlanar(vector, angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return new THREE.Vector3(
    vector.x * c - vector.y * s,
    vector.x * s + vector.y * c,
    vector.z
  ).normalize()
}

function chooseFreeTurnDirection(leader) {
  const sign = Math.random() < 0.5 ? -1 : 1
  const a = rotatePlanar(avgHeading, params.turnAngle * sign)
  const b = rotatePlanar(avgHeading, -params.turnAngle * sign)
  const inward = tmp.copy(leader.mesh.position).multiplyScalar(-1).setZ(0)
  if (inward.lengthSq() < 0.0001) return a
  inward.normalize()
  return a.dot(inward) >= b.dot(inward) ? a : b
}

function chooseEdgeTurnDirection(leader) {
  // Au bord, le virage n'est pas un petit écart : la tête vise franchement
  // l'intérieur du cadre. Elle continue toujours d'avancer, mais sa trajectoire
  // se courbe progressivement vers cette nouvelle direction.
  const inward = new THREE.Vector3(-leader.mesh.position.x, -leader.mesh.position.y, 0)
  if (inward.lengthSq() < 0.0001) return avgHeading.clone()
  inward.normalize()

  // On garde un peu de la direction actuelle afin d'éviter un retournement visuel sec.
  const candidate = avgHeading.clone().multiplyScalar(0.18).add(inward.multiplyScalar(0.82)).normalize()
  return candidate
}

function startTurn(force = false) {
  if (activeTurn) return

  const leaderIndex = leadingMarbleIndex()
  const leader = marbles[leaderIndex]

  if (!force && Math.random() > params.initiativeRate) {
    nextTurnAt = simTime + 0.8 + Math.random() * 1.8
    return
  }

  const oldHeading = avgHeading.clone()
  const newHeading = force ? chooseEdgeTurnDirection(leader) : chooseFreeTurnDirection(leader)

  activeTurn = {
    point: leader.mesh.position.clone(),
    oldHeading,
    newHeading,
    crossedCount: 0,
  }

  for (const m of marbles) m.hasCrossedGate = false
  leader.hasCrossedGate = true
  leader.desiredHeading.copy(newHeading)
  activeTurn.crossedCount = 1
  nextTurnAt = simTime + 2.0 + Math.random() * 4.0
}

function maybeStartEdgeTurn() {
  if (activeTurn) return

  const leader = marbles[leadingMarbleIndex()]
  const p = leader.mesh.position

  if (Math.abs(p.x) >= params.frameX || Math.abs(p.y) >= params.frameY) {
    startTurn(true)
  } else if (simTime >= nextTurnAt) {
    startTurn(false)
  }
}

function updateGateState(m) {
  if (!activeTurn || m.hasCrossedGate) return

  const rel = tmp.copy(m.mesh.position).sub(activeTurn.point)
  const longitudinal = rel.dot(activeTurn.oldHeading)

  if (longitudinal >= -params.gateWidth * 0.08) {
    m.hasCrossedGate = true
    m.desiredHeading.copy(activeTurn.newHeading)
    activeTurn.crossedCount++
  }
}

function localDesiredHeading(i) {
  const m = marbles[i]
  const neighbours = nearestNeighbours(i)

  alignmentForce.set(0, 0, 0)
  attractionForce.set(0, 0, 0)
  repulsionForce.set(0, 0, 0)

  let meanDistance = 0

  for (const n of neighbours) {
    const other = marbles[n.j]
    const distance = Math.sqrt(n.d2)
    meanDistance += distance

    if (!activeTurn || m.hasCrossedGate === other.hasCrossedGate) {
      alignmentForce.add(other.heading)
    }

    tmp.copy(other.mesh.position).sub(m.mesh.position)
    if (distance < params.dangerDistance && distance > 0.0001) {
      const pressure = 1 - distance / params.dangerDistance
      repulsionForce.add(tmp2.copy(tmp).normalize().multiplyScalar(-pressure))
    }
  }

  meanDistance /= Math.max(neighbours.length, 1)

  if (neighbours.length) {
    if (alignmentForce.lengthSq() > 0.0001) alignmentForce.normalize()

    if (meanDistance > params.preferredDistance) {
      for (const n of neighbours) attractionForce.add(marbles[n.j].mesh.position)
      attractionForce.divideScalar(neighbours.length).sub(m.mesh.position)
      if (attractionForce.lengthSq() > 0.0001) attractionForce.normalize()
    }
  }

  const base = activeTurn
    ? (m.hasCrossedGate ? activeTurn.newHeading : activeTurn.oldHeading)
    : m.heading

  desired.copy(base)
  desired.addScaledVector(alignmentForce, params.alignment)
  desired.addScaledVector(attractionForce, params.attraction)
  desired.addScaledVector(repulsionForce, params.repulsion)

  if (desired.lengthSq() > 0.0001) desired.normalize()
  if (desired.dot(m.heading) < 0.12) {
    desired.lerp(m.heading, 0.72).normalize()
  }

  m.desiredHeading.copy(desired)
}

function applySoftCohesion(m, dt) {
  toCenter.copy(center).sub(m.mesh.position)
  const radialDistance = Math.hypot(toCenter.x, toCenter.y)
  if (radialDistance <= params.groupRadius) return

  const excess = radialDistance - params.groupRadius
  const inward = tmp.set(toCenter.x, toCenter.y, 0)
  if (inward.lengthSq() < 0.0001) return
  inward.normalize()

  const correction = Math.min(excess * params.groupTether * dt * 60, 0.08)
  const candidate = tmp2.copy(m.desiredHeading).lerp(inward, correction).normalize()
  if (candidate.dot(m.heading) > 0.10) m.desiredHeading.copy(candidate)
}

function updateDepthCue(m) {
  const zNorm = THREE.MathUtils.clamp((m.mesh.position.z / Math.max(params.depth, 0.01) + 1) * 0.5, 0, 1)
  const scale = THREE.MathUtils.lerp(0.86, 1.16, zNorm)
  m.mesh.scale.setScalar(scale)
  const lightness = THREE.MathUtils.lerp(0.55, 0.96, zNorm)
  m.mesh.material.color.setHSL(0.60, 0.05, lightness)
}

function updateSwarm(dt) {
  simTime += dt
  computeCenterAndHeading()
  maybeStartEdgeTurn()

  for (let i = 0; i < marbles.length; i++) {
    const m = marbles[i]

    updateGateState(m)
    localDesiredHeading(i)
    applySoftCohesion(m, dt)

    const turn = 1 - Math.exp(-params.turnRate * dt)
    m.heading.lerp(m.desiredHeading, turn).normalize()

    // Toujours en mouvement, toujours vers l'avant, vitesse strictement positive.
    const velocity = tmp.copy(m.heading).multiplyScalar(params.speed)

    if (Math.abs(m.mesh.position.z) > params.depth) {
      const zCorrection = -Math.sign(m.mesh.position.z) * 0.10
      velocity.z += zCorrection * params.speed
      if (velocity.lengthSq() > 0.0001) velocity.setLength(params.speed)
    }

    m.mesh.position.addScaledVector(velocity, dt * 60)
    updateDepthCue(m)
  }

  if (activeTurn && activeTurn.crossedCount >= marbles.length) {
    activeTurn = null
  }
}

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 1 / 30)
  updateSwarm(dt)
  renderer.render(scene, camera)
}
animate()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})
