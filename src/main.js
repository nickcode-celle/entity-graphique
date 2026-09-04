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
  alignment: 0.82,
  attraction: 0.18,
  repulsion: 0.90,
  preferredDistance: 0.82,
  dangerDistance: 0.34,
  speed: 0.034,
  turnRate: 1.55,
  initiative: 0.55,
  initiativeRate: 0.11,
  initiativeLife: 0.55,
  reactionMin: 0.07,
  reactionMax: 0.18,
  propagationMin: 0.10,
  propagationMax: 0.34,
  linkDistance: 1.45,
  linkTension: 0.030,
  depth: 0.55,
  edgeForce: 0.020,
}

const gui = new GUI({ title: 'ENTITY — Murmuration V9' })
gui.add(params, 'neighbours', 3, 12, 1).name('Voisins suivis')
gui.add(params, 'alignment', 0, 1.5, 0.01).name('Alignement')
gui.add(params, 'attraction', 0, 0.6, 0.01).name('Attraction locale')
gui.add(params, 'repulsion', 0, 1.8, 0.02).name('Répulsion')
gui.add(params, 'preferredDistance', 0.45, 1.4, 0.01).name('Distance confortable')
gui.add(params, 'dangerDistance', 0.2, 0.7, 0.01).name('Distance sécurité')
gui.add(params, 'speed', 0.015, 0.08, 0.001).name('Vitesse')
gui.add(params, 'turnRate', 0.3, 3.5, 0.05).name('Fluidité virage')
gui.add(params, 'initiative', 0, 1.2, 0.01).name('Initiative')
gui.add(params, 'initiativeRate', 0.02, 0.5, 0.01).name('Fréquence initiative')
gui.add(params, 'propagationMin', 0.03, 0.5, 0.01).name('Délai min propagation')
gui.add(params, 'propagationMax', 0.08, 0.8, 0.01).name('Délai max propagation')
gui.add(params, 'linkDistance', 0.8, 2.5, 0.02).name('Seuil continuité')
gui.add(params, 'linkTension', 0, 0.08, 0.001).name('Tension continuité')
gui.add(params, 'depth', 0.10, 1.4, 0.02).name('Profondeur')
gui.add(params, 'edgeForce', 0, 0.05, 0.001).name('Rappel écran')

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

for (let i = 0; i < 100; i++) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xf1f3f5,
    roughness: 0.32,
    metalness: 0.04,
  })
  const mesh = new THREE.Mesh(geometry, material)

  mesh.position.set(
    (Math.random() - 0.5) * 6.5,
    (Math.random() - 0.5) * 2.8,
    (Math.random() - 0.5) * params.depth
  )

  const heading = new THREE.Vector3(
    1,
    (Math.random() - 0.5) * 0.22,
    (Math.random() - 0.5) * 0.08
  ).normalize()

  marbles.push({
    mesh,
    heading: heading.clone(),
    desiredHeading: heading.clone(),
    velocity: heading.clone().multiplyScalar(params.speed),
    reactionTimer: params.reactionMin + Math.random() * (params.reactionMax - params.reactionMin),
    propagationDelay: params.propagationMin + Math.random() * (params.propagationMax - params.propagationMin),
    initiativeTimer: 1.2 + Math.random() * 6.0,
    initiativeDirection: new THREE.Vector3(),
    initiativeLife: 0,
    history: [{ t: 0, heading: heading.clone() }],
  })

  scene.add(mesh)
}

const tmp = new THREE.Vector3()
const tmp2 = new THREE.Vector3()
const alignment = new THREE.Vector3()
const attraction = new THREE.Vector3()
const repulsion = new THREE.Vector3()
const desired = new THREE.Vector3()
const center = new THREE.Vector3()

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

function delayedHeading(m, targetTime) {
  const h = m.history
  for (let i = h.length - 1; i >= 0; i--) {
    if (h[i].t <= targetTime) return h[i].heading
  }
  return h[0].heading
}

function recordHistory(m) {
  m.history.push({ t: simTime, heading: m.heading.clone() })
  const keepAfter = simTime - 1.5
  while (m.history.length > 2 && m.history[1].t < keepAfter) hshift(m.history)
}

function hshift(arr) {
  arr.shift()
}

function updateDecision(i) {
  const m = marbles[i]
  const neighbours = nearestNeighbours(i)

  alignment.set(0, 0, 0)
  attraction.set(0, 0, 0)
  repulsion.set(0, 0, 0)

  let meanDistance = 0
  const lookBack = simTime - m.propagationDelay

  for (const n of neighbours) {
    const other = marbles[n.j]
    const distance = Math.sqrt(n.d2)
    meanDistance += distance

    // La bille ne voit pas la direction actuelle de sa voisine, mais une direction
    // légèrement passée : le virage se propage de proche en proche au lieu d'être instantané.
    alignment.add(delayedHeading(other, lookBack))

    tmp.copy(other.mesh.position).sub(m.mesh.position)
    if (distance < params.dangerDistance && distance > 0.0001) {
      const strength = 1 - distance / params.dangerDistance
      repulsion.add(tmp2.copy(tmp).normalize().multiplyScalar(-strength))
    }
  }

  meanDistance /= Math.max(neighbours.length, 1)

  if (neighbours.length) {
    alignment.divideScalar(neighbours.length).normalize()

    if (meanDistance > params.preferredDistance) {
      for (const n of neighbours) attraction.add(marbles[n.j].mesh.position)
      attraction.divideScalar(neighbours.length).sub(m.mesh.position).normalize()
    }
  }

  desired.copy(m.heading)
  desired.addScaledVector(alignment, params.alignment)
  desired.addScaledVector(attraction, params.attraction)
  desired.addScaledVector(repulsion, params.repulsion)

  if (m.initiativeLife > 0) {
    desired.addScaledVector(m.initiativeDirection, params.initiative)
  }

  if (desired.lengthSq() > 0.0001) m.desiredHeading.copy(desired.normalize())
}

// Arbre couvrant minimum de l'essaim : il ne dessine aucune forme,
// mais garantit qu'il existe toujours un chemin continu reliant les 100 billes.
// La tension n'agit que lorsqu'un lien nécessaire à cette continuité devient trop long.
function continuityEdges() {
  const n = marbles.length
  const inTree = new Array(n).fill(false)
  const best = new Array(n).fill(Infinity)
  const parent = new Array(n).fill(-1)
  best[0] = 0

  for (let step = 0; step < n; step++) {
    let u = -1
    let min = Infinity
    for (let i = 0; i < n; i++) {
      if (!inTree[i] && best[i] < min) {
        min = best[i]
        u = i
      }
    }
    if (u < 0) break
    inTree[u] = true

    for (let v = 0; v < n; v++) {
      if (inTree[v] || v === u) continue
      const d2 = marbles[u].mesh.position.distanceToSquared(marbles[v].mesh.position)
      if (d2 < best[v]) {
        best[v] = d2
        parent[v] = u
      }
    }
  }

  return parent
}

function applyContinuity(dt) {
  const parent = continuityEdges()
  for (let i = 1; i < marbles.length; i++) {
    const p = parent[i]
    if (p < 0) continue

    const a = marbles[i]
    const b = marbles[p]
    tmp.copy(b.mesh.position).sub(a.mesh.position)
    const d = tmp.length()
    if (d <= params.linkDistance || d < 0.0001) continue

    const excess = d - params.linkDistance
    const strength = excess * params.linkTension * dt * 60
    tmp.normalize()

    // Même correction opposée sur les deux côtés du lien : on évite la rupture
    // sans aspirer tout l'essaim vers un centre commun.
    a.velocity.addScaledVector(tmp, strength)
    b.velocity.addScaledVector(tmp, -strength)
  }
}

function updateDepthCue(m) {
  const zNorm = THREE.MathUtils.clamp((m.mesh.position.z / Math.max(params.depth, 0.01) + 1) * 0.5, 0, 1)
  const scale = THREE.MathUtils.lerp(0.88, 1.14, zNorm)
  m.mesh.scale.setScalar(scale)

  const lightness = THREE.MathUtils.lerp(0.58, 0.94, zNorm)
  m.mesh.material.color.setHSL(0.60, 0.05, lightness)
}

function updateSwarm(dt) {
  simTime += dt

  center.set(0, 0, 0)
  for (const m of marbles) center.add(m.mesh.position)
  center.divideScalar(marbles.length)

  const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * camera.position.z
  const halfWidth = halfHeight * camera.aspect
  const edgeX = halfWidth * 0.79
  const edgeY = halfHeight * 0.73

  for (let i = 0; i < marbles.length; i++) {
    const m = marbles[i]

    m.reactionTimer -= dt
    if (m.reactionTimer <= 0) {
      updateDecision(i)
      m.reactionTimer = params.reactionMin + Math.random() * (params.reactionMax - params.reactionMin)
      m.propagationDelay = params.propagationMin + Math.random() * (params.propagationMax - params.propagationMin)
    }

    m.initiativeTimer -= dt
    m.initiativeLife -= dt
    if (m.initiativeTimer <= 0 && Math.random() < params.initiativeRate) {
      const side = new THREE.Vector3(-m.heading.y, m.heading.x, 0).normalize()
      m.initiativeDirection
        .copy(side)
        .multiplyScalar((Math.random() - 0.5) * 1.25)
        .add(new THREE.Vector3(0, (Math.random() - 0.5) * 0.55, (Math.random() - 0.5) * 0.16))
        .normalize()
      m.initiativeLife = params.initiativeLife * (0.75 + Math.random() * 0.6)
      m.initiativeTimer = 2.5 + Math.random() * 6.0
    }

    // Virage par courbure : la direction pivote progressivement vers la direction désirée.
    const turn = 1 - Math.exp(-params.turnRate * dt)
    m.heading.lerp(m.desiredHeading, turn).normalize()

    const desiredVelocity = tmp.copy(m.heading).multiplyScalar(params.speed)
    m.velocity.lerp(desiredVelocity, 1 - Math.exp(-3.2 * dt))

    // Courbure douce près des limites de l'écran.
    const x = m.mesh.position.x
    const y = m.mesh.position.y
    if (Math.abs(x) > edgeX) {
      const excess = Math.abs(x) - edgeX
      m.velocity.x += -Math.sign(x) * excess * params.edgeForce * dt * 60
    }
    if (Math.abs(y) > edgeY) {
      const excess = Math.abs(y) - edgeY
      m.velocity.y += -Math.sign(y) * excess * params.edgeForce * dt * 60
    }

    // Profondeur libre mais contenue : assez pour lire des plans distincts.
    const depthLimit = params.depth
    if (Math.abs(m.mesh.position.z) > depthLimit) {
      m.velocity.z += -Math.sign(m.mesh.position.z) * (Math.abs(m.mesh.position.z) - depthLimit) * 0.025 * dt * 60
    }

    m.mesh.position.addScaledVector(m.velocity, dt * 60)
    updateDepthCue(m)
    recordHistory(m)
  }

  applyContinuity(dt)
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
