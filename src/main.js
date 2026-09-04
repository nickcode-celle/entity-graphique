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
  alignment: 0.72,
  attraction: 0.24,
  repulsion: 1.0,
  preferredDistance: 0.78,
  dangerDistance: 0.34,
  speed: 0.032,
  turnRate: 1.35,
  initiative: 0.42,
  initiativeRate: 0.08,
  initiativeLife: 0.50,
  reactionMin: 0.08,
  reactionMax: 0.18,
  propagationMin: 0.10,
  propagationMax: 0.36,
  continuityStart: 0.95,
  continuityLimit: 1.30,
  continuityStrength: 0.055,
  depth: 0.55,
  groupEdgeTurn: 1.35,
}

const gui = new GUI({ title: 'ENTITY — Murmuration V10' })
gui.add(params, 'neighbours', 3, 12, 1).name('Voisins suivis')
gui.add(params, 'alignment', 0, 1.5, 0.01).name('Alignement')
gui.add(params, 'attraction', 0, 0.7, 0.01).name('Attraction locale')
gui.add(params, 'repulsion', 0, 2.0, 0.02).name('Répulsion')
gui.add(params, 'preferredDistance', 0.45, 1.3, 0.01).name('Distance confortable')
gui.add(params, 'dangerDistance', 0.2, 0.7, 0.01).name('Distance sécurité')
gui.add(params, 'speed', 0.015, 0.07, 0.001).name('Vitesse')
gui.add(params, 'turnRate', 0.3, 3.5, 0.05).name('Fluidité virage')
gui.add(params, 'initiative', 0, 1.2, 0.01).name('Initiative')
gui.add(params, 'initiativeRate', 0.01, 0.4, 0.01).name('Fréquence initiative')
gui.add(params, 'propagationMin', 0.03, 0.5, 0.01).name('Délai min propagation')
gui.add(params, 'propagationMax', 0.08, 0.8, 0.01).name('Délai max propagation')
gui.add(params, 'continuityStart', 0.65, 1.5, 0.01).name('Début tension réseau')
gui.add(params, 'continuityLimit', 0.85, 2.0, 0.01).name('Limite réseau')
gui.add(params, 'continuityStrength', 0, 0.12, 0.001).name('Tension réseau')
gui.add(params, 'depth', 0.10, 1.4, 0.02).name('Profondeur')
gui.add(params, 'groupEdgeTurn', 0.2, 3.0, 0.05).name('Virage bord groupe')

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

  // Départ large, peu profond et irrégulier.
  mesh.position.set(
    (Math.random() - 0.5) * 6.0,
    (Math.random() - 0.5) * 2.6,
    (Math.random() - 0.5) * params.depth
  )

  const heading = new THREE.Vector3(
    1,
    (Math.random() - 0.5) * 0.20,
    (Math.random() - 0.5) * 0.06
  ).normalize()

  marbles.push({
    mesh,
    heading: heading.clone(),
    desiredHeading: heading.clone(),
    velocity: heading.clone().multiplyScalar(params.speed),
    reactionTimer: params.reactionMin + Math.random() * (params.reactionMax - params.reactionMin),
    propagationDelay: params.propagationMin + Math.random() * (params.propagationMax - params.propagationMin),
    initiativeTimer: 1.5 + Math.random() * 7.0,
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
const groupTurn = new THREE.Vector3()
const boundsCenter = new THREE.Vector3()

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
  const keepAfter = simTime - 1.6
  while (m.history.length > 2 && m.history[1].t < keepAfter) m.history.shift()
}

function updateDecision(i) {
  const m = marbles[i]
  const neighbours = nearestNeighbours(i)

  alignment.set(0, 0, 0)
  attraction.set(0, 0, 0)
  repulsion.set(0, 0, 0)

  const lookBack = simTime - m.propagationDelay

  for (const n of neighbours) {
    const other = marbles[n.j]
    const distance = Math.sqrt(n.d2)

    // Direction passée de la voisine : l'information traverse le réseau par relais.
    alignment.add(delayedHeading(other, lookBack))

    tmp.copy(other.mesh.position).sub(m.mesh.position)
    if (distance > 0.0001) {
      const dir = tmp2.copy(tmp).normalize()

      // Attraction progressive, pas un déclenchement tardif : le réseau se tend avant de casser.
      if (distance > params.preferredDistance) {
        const stretch = Math.min((distance - params.preferredDistance) / params.preferredDistance, 1.5)
        attraction.addScaledVector(dir, stretch)
      }

      if (distance < params.dangerDistance) {
        const pressure = 1 - distance / params.dangerDistance
        repulsion.addScaledVector(dir, -pressure)
      }
    }
  }

  if (neighbours.length) {
    alignment.divideScalar(neighbours.length)
    attraction.divideScalar(neighbours.length)
    repulsion.divideScalar(neighbours.length)
    if (alignment.lengthSq() > 0.0001) alignment.normalize()
  }

  desired.copy(m.heading)
  desired.addScaledVector(alignment, params.alignment)
  desired.addScaledVector(attraction, params.attraction)
  desired.addScaledVector(repulsion, params.repulsion)

  if (m.initiativeLife > 0) desired.addScaledVector(m.initiativeDirection, params.initiative)
  if (desired.lengthSq() > 0.0001) m.desiredHeading.copy(desired.normalize())
}

// Arbre couvrant recalculé : utilisé seulement comme ceinture de sécurité.
// La tension commence AVANT toute rupture visible et augmente continûment.
function continuityParents() {
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
  const parent = continuityParents()

  for (let i = 1; i < marbles.length; i++) {
    const p = parent[i]
    if (p < 0) continue

    const a = marbles[i]
    const b = marbles[p]
    tmp.copy(b.mesh.position).sub(a.mesh.position)
    const d = tmp.length()
    if (d <= params.continuityStart || d < 0.0001) continue

    const range = Math.max(params.continuityLimit - params.continuityStart, 0.01)
    const normalized = THREE.MathUtils.clamp((d - params.continuityStart) / range, 0, 1.5)
    const strength = normalized * normalized * params.continuityStrength * dt * 60

    tmp.normalize()
    a.velocity.addScaledVector(tmp, strength)
    b.velocity.addScaledVector(tmp, -strength)

    // Si un lien approche la limite, on infléchit aussi les directions,
    // pour éviter qu'il continue à s'étirer pendant que la vitesse est corrigée.
    if (d > params.continuityLimit) {
      const correction = Math.min((d - params.continuityLimit) * 0.22, 0.35)
      a.desiredHeading.lerp(tmp, correction).normalize()
      b.desiredHeading.lerp(tmp2.copy(tmp).multiplyScalar(-1), correction).normalize()
    }
  }
}

function computeGroupTurn() {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const m of marbles) {
    const p = m.mesh.position
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }

  boundsCenter.set((minX + maxX) * 0.5, (minY + maxY) * 0.5, 0)

  const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * camera.position.z
  const halfWidth = halfHeight * camera.aspect
  const safeX = halfWidth * 0.56
  const safeY = halfHeight * 0.50

  groupTurn.set(0, 0, 0)

  if (Math.abs(boundsCenter.x) > safeX) {
    groupTurn.x = -Math.sign(boundsCenter.x) * (Math.abs(boundsCenter.x) - safeX)
  }
  if (Math.abs(boundsCenter.y) > safeY) {
    groupTurn.y = -Math.sign(boundsCenter.y) * (Math.abs(boundsCenter.y) - safeY)
  }

  if (groupTurn.lengthSq() > 0.0001) groupTurn.normalize()
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
  computeGroupTurn()

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
        .multiplyScalar((Math.random() - 0.5) * 1.10)
        .add(new THREE.Vector3(0, (Math.random() - 0.5) * 0.45, (Math.random() - 0.5) * 0.12))
        .normalize()
      m.initiativeLife = params.initiativeLife * (0.8 + Math.random() * 0.5)
      m.initiativeTimer = 3.0 + Math.random() * 7.0
    }

    // Le bord agit sur la direction du GROUPE ENTIER, jamais bille par bille.
    // La forme interne n'est donc pas écrasée en colonne contre un bord.
    if (groupTurn.lengthSq() > 0.0001) {
      m.desiredHeading.lerp(groupTurn, 1 - Math.exp(-params.groupEdgeTurn * dt)).normalize()
    }

    // Virage par courbure, jamais par changement instantané de vitesse.
    const turn = 1 - Math.exp(-params.turnRate * dt)
    m.heading.lerp(m.desiredHeading, turn).normalize()

    const desiredVelocity = tmp.copy(m.heading).multiplyScalar(params.speed)
    m.velocity.lerp(desiredVelocity, 1 - Math.exp(-2.8 * dt))

    // Profondeur limitée sans supprimer le relief visuel.
    if (Math.abs(m.mesh.position.z) > params.depth) {
      m.velocity.z += -Math.sign(m.mesh.position.z) * (Math.abs(m.mesh.position.z) - params.depth) * 0.020 * dt * 60
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
