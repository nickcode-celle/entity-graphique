import * as THREE from 'three'
import GUI from 'lil-gui'
import './style.css'

const app = document.querySelector('#app')
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x050505)

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 0, 11)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
app.appendChild(renderer.domElement)

const params = {
  neighbours: 7,
  alignment: 0.070,
  attraction: 0.012,
  repulsion: 0.12,
  preferredDistance: 0.82,
  dangerDistance: 0.36,
  speed: 0.034,
  initiative: 0.012,
  initiativeRate: 0.18,
  reactionMin: 0.06,
  reactionMax: 0.18,
  depth: 0.28,
  groupRadius: 3.35,
  groupTether: 0.010,
  edgeForce: 0.020,
}

const gui = new GUI({ title: 'ENTITY — Murmuration V8' })
gui.add(params, 'neighbours', 3, 12, 1).name('Voisins suivis')
gui.add(params, 'alignment', 0, 0.15, 0.001).name('Alignement')
gui.add(params, 'attraction', 0, 0.04, 0.0005).name('Attraction locale')
gui.add(params, 'repulsion', 0, 0.25, 0.002).name('Répulsion')
gui.add(params, 'preferredDistance', 0.45, 1.4, 0.01).name('Distance confortable')
gui.add(params, 'dangerDistance', 0.2, 0.7, 0.01).name('Distance sécurité')
gui.add(params, 'speed', 0.015, 0.08, 0.001).name('Vitesse')
gui.add(params, 'initiative', 0, 0.06, 0.001).name('Initiative')
gui.add(params, 'initiativeRate', 0.05, 1.0, 0.01).name('Fréquence initiative')
gui.add(params, 'depth', 0.05, 0.8, 0.01).name('Profondeur')
gui.add(params, 'groupRadius', 2.4, 5.0, 0.05).name('Rayon cohésion globale')
gui.add(params, 'groupTether', 0, 0.03, 0.0005).name('Rappel groupe')
gui.add(params, 'edgeForce', 0, 0.05, 0.001).name('Rappel écran')

const swarm = new THREE.Group()
scene.add(swarm)

const geometry = new THREE.SphereGeometry(0.105, 18, 18)
const material = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.38, metalness: 0.06 })
scene.add(new THREE.AmbientLight(0xffffff, 0.85))
const keyLight = new THREE.DirectionalLight(0xffffff, 2.4)
keyLight.position.set(5, 6, 8)
scene.add(keyLight)
const fillLight = new THREE.DirectionalLight(0xffffff, 0.7)
fillLight.position.set(-5, -2, 4)
scene.add(fillLight)

const marbles = []
for (let i = 0; i < 100; i++) {
  const mesh = new THREE.Mesh(geometry, material)

  mesh.position.set(
    (Math.random() - 0.5) * 6.5,
    (Math.random() - 0.5) * 2.8,
    (Math.random() - 0.5) * params.depth
  )

  const heading = new THREE.Vector3(
    1,
    (Math.random() - 0.5) * 0.28,
    (Math.random() - 0.5) * 0.06
  ).normalize()

  const velocity = heading.multiplyScalar(params.speed * (0.92 + Math.random() * 0.12))

  marbles.push({
    mesh,
    velocity,
    reactionTimer: params.reactionMin + Math.random() * (params.reactionMax - params.reactionMin),
    initiativeTimer: 1.0 + Math.random() * 5.0,
    initiativeDirection: new THREE.Vector3(),
    initiativeLife: 0,
  })
  swarm.add(mesh)
}

const clock = new THREE.Clock()
const center = new THREE.Vector3()
const steer = new THREE.Vector3()
const alignmentForce = new THREE.Vector3()
const attractionForce = new THREE.Vector3()
const repulsionForce = new THREE.Vector3()
const toOther = new THREE.Vector3()
const tmp = new THREE.Vector3()
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

function updateDecision(i) {
  const marble = marbles[i]
  const neighbours = nearestNeighbours(i)

  alignmentForce.set(0, 0, 0)
  attractionForce.set(0, 0, 0)
  repulsionForce.set(0, 0, 0)

  let meanDistance = 0

  for (const n of neighbours) {
    const other = marbles[n.j]
    const distance = Math.sqrt(n.d2)
    meanDistance += distance
    alignmentForce.add(other.velocity)

    toOther.copy(other.mesh.position).sub(marble.mesh.position)

    if (distance < params.dangerDistance && distance > 0.0001) {
      const strength = 1 - distance / params.dangerDistance
      repulsionForce.add(tmp.copy(toOther).normalize().multiplyScalar(-strength))
    }
  }

  meanDistance /= Math.max(neighbours.length, 1)

  if (neighbours.length) {
    alignmentForce.divideScalar(neighbours.length).normalize()

    if (meanDistance > params.preferredDistance) {
      for (const n of neighbours) attractionForce.add(marbles[n.j].mesh.position)
      attractionForce.divideScalar(neighbours.length).sub(marble.mesh.position).normalize()
    }
  }

  steer.set(0, 0, 0)
  steer.addScaledVector(alignmentForce, params.alignment)
  steer.addScaledVector(attractionForce, params.attraction)
  steer.addScaledVector(repulsionForce, params.repulsion)

  if (marble.initiativeLife > 0) {
    steer.addScaledVector(marble.initiativeDirection, params.initiative)
  }

  marble.velocity.add(steer)

  const minSpeed = params.speed * 0.84
  const maxSpeed = params.speed * 1.16
  const s = marble.velocity.length()
  if (s < minSpeed) marble.velocity.setLength(minSpeed)
  if (s > maxSpeed) marble.velocity.setLength(maxSpeed)
}

function updateSwarm(dt) {
  center.set(0, 0, 0)
  for (const m of marbles) center.add(m.mesh.position)
  center.divideScalar(marbles.length)

  // Limites visuelles approximatives à la profondeur de l'essaim.
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * camera.position.z
  const halfWidth = halfHeight * camera.aspect
  const edgeX = halfWidth * 0.78
  const edgeY = halfHeight * 0.72

  for (let i = 0; i < marbles.length; i++) {
    const m = marbles[i]

    m.reactionTimer -= dt
    if (m.reactionTimer <= 0) {
      updateDecision(i)
      m.reactionTimer = params.reactionMin + Math.random() * (params.reactionMax - params.reactionMin)
    }

    m.initiativeTimer -= dt
    m.initiativeLife -= dt

    if (m.initiativeTimer <= 0 && Math.random() < params.initiativeRate) {
      const forward = m.velocity.clone().normalize()
      const side = new THREE.Vector3(-forward.y, forward.x, 0).normalize()
      m.initiativeDirection
        .copy(side)
        .multiplyScalar((Math.random() - 0.5) * 1.3)
        .add(new THREE.Vector3(0, (Math.random() - 0.5) * 0.45, 0))
        .normalize()
      m.initiativeLife = 0.30 + Math.random() * 0.65
      m.initiativeTimer = 2.0 + Math.random() * 5.5
    }

    // Cohésion globale conditionnelle : rien tant que la bille reste dans le corps.
    // Le rappel n'apparaît qu'au-delà d'un rayon large, afin d'empêcher une scission durable
    // sans comprimer la murmuration lorsqu'elle est normalement étendue.
    toCenter.copy(center).sub(m.mesh.position)
    const radialDistance = Math.hypot(toCenter.x, toCenter.y)
    if (radialDistance > params.groupRadius) {
      const excess = radialDistance - params.groupRadius
      const planar = tmp.set(toCenter.x, toCenter.y, 0)
      if (planar.lengthSq() > 0.0001) {
        planar.normalize()
        m.velocity.addScaledVector(planar, excess * params.groupTether * dt * 60)
      }
    }

    // Bord d'écran souple : on courbe la trajectoire avant toute sortie du champ.
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

    // Si le centre entier dérive, on infléchit tout le corps sans modifier ses distances internes.
    const centerSafeX = edgeX * 0.42
    const centerSafeY = edgeY * 0.38
    if (Math.abs(center.x) > centerSafeX) {
      m.velocity.x += -Math.sign(center.x) * (Math.abs(center.x) - centerSafeX) * 0.0025 * dt * 60
    }
    if (Math.abs(center.y) > centerSafeY) {
      m.velocity.y += -Math.sign(center.y) * (Math.abs(center.y) - centerSafeY) * 0.0025 * dt * 60
    }

    // La profondeur reste faible, mais non nulle.
    m.velocity.z += -m.mesh.position.z * 0.018 * dt * 60
    m.velocity.z *= Math.pow(0.945, dt * 60)

    const minSpeed = params.speed * 0.82
    const maxSpeed = params.speed * 1.22
    const s = m.velocity.length()
    if (s < minSpeed) m.velocity.setLength(minSpeed)
    if (s > maxSpeed) m.velocity.setLength(maxSpeed)

    m.mesh.position.addScaledVector(m.velocity, dt * 60)
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
