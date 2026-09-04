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
  alignment: 0.065,
  attraction: 0.010,
  repulsion: 0.12,
  preferredDistance: 0.78,
  dangerDistance: 0.38,
  speed: 0.040,
  initiative: 0.020,
  initiativeRate: 0.28,
  reactionMin: 0.05,
  reactionMax: 0.20,
  depth: 0.32,
  centering: 0.0018,
}

const gui = new GUI({ title: 'ENTITY — Murmuration V7' })
gui.add(params, 'neighbours', 3, 12, 1).name('Voisins suivis')
gui.add(params, 'alignment', 0, 0.15, 0.001).name('Alignement')
gui.add(params, 'attraction', 0, 0.04, 0.0005).name('Attraction')
gui.add(params, 'repulsion', 0, 0.25, 0.002).name('Répulsion')
gui.add(params, 'preferredDistance', 0.45, 1.4, 0.01).name('Distance confortable')
gui.add(params, 'dangerDistance', 0.2, 0.7, 0.01).name('Distance sécurité')
gui.add(params, 'speed', 0.015, 0.08, 0.001).name('Vitesse')
gui.add(params, 'initiative', 0, 0.06, 0.001).name('Initiative')
gui.add(params, 'initiativeRate', 0.05, 1.0, 0.01).name('Fréquence initiative')
gui.add(params, 'depth', 0.05, 0.8, 0.01).name('Profondeur')
gui.add(params, 'centering', 0, 0.01, 0.0001).name('Rappel centre')

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

  // Essaim initial large et peu profond, sans forme cible imposée.
  mesh.position.set(
    (Math.random() - 0.5) * 7.2,
    (Math.random() - 0.5) * 3.4,
    (Math.random() - 0.5) * params.depth
  )

  const heading = new THREE.Vector3(
    1,
    (Math.random() - 0.5) * 0.35,
    (Math.random() - 0.5) * 0.08
  ).normalize()

  const velocity = heading.multiplyScalar(params.speed * (0.9 + Math.random() * 0.15))

  marbles.push({
    mesh,
    velocity,
    reactionTimer: params.reactionMin + Math.random() * (params.reactionMax - params.reactionMin),
    initiativeTimer: 0.7 + Math.random() * 4.0,
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

    // La répulsion n'agit que très près : pas d'espacement géométrique forcé.
    if (distance < params.dangerDistance && distance > 0.0001) {
      const strength = 1 - distance / params.dangerDistance
      repulsionForce.add(tmp.copy(toOther).normalize().multiplyScalar(-strength))
    }
  }

  meanDistance /= Math.max(neighbours.length, 1)

  if (neighbours.length) {
    alignmentForce.divideScalar(neighbours.length).normalize()

    // Attraction seulement lorsque le voisinage s'est réellement trop ouvert.
    if (meanDistance > params.preferredDistance) {
      for (const n of neighbours) {
        attractionForce.add(marbles[n.j].mesh.position)
      }
      attractionForce.divideScalar(neighbours.length).sub(marble.mesh.position).normalize()
    }
  }

  steer.set(0, 0, 0)
  steer.addScaledVector(alignmentForce, params.alignment)
  steer.addScaledVector(attractionForce, params.attraction)
  steer.addScaledVector(repulsionForce, params.repulsion)

  // Une bille peut momentanément initier un virage. Ses voisines ne reçoivent
  // pas l'ordre directement : elles le captent ensuite via l'alignement local.
  if (marble.initiativeLife > 0) {
    steer.addScaledVector(marble.initiativeDirection, params.initiative)
  }

  marble.velocity.add(steer)

  // Vitesse de vol conservée dans une plage étroite plutôt que ressort vers une position.
  const minSpeed = params.speed * 0.82
  const maxSpeed = params.speed * 1.18
  const s = marble.velocity.length()
  if (s < minSpeed) marble.velocity.setLength(minSpeed)
  if (s > maxSpeed) marble.velocity.setLength(maxSpeed)
}

function updateSwarm(dt) {
  center.set(0, 0, 0)
  for (const m of marbles) center.add(m.mesh.position)
  center.divideScalar(marbles.length)

  for (let i = 0; i < marbles.length; i++) {
    const m = marbles[i]

    // Réactions asynchrones : chaque bille réévalue son voisinage à son propre rythme.
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
      const vertical = new THREE.Vector3(0, 1, 0)
      m.initiativeDirection
        .copy(side)
        .multiplyScalar((Math.random() - 0.5) * 1.6)
        .addScaledVector(vertical, (Math.random() - 0.5) * 0.65)
        .normalize()
      m.initiativeLife = 0.35 + Math.random() * 0.8
      m.initiativeTimer = 1.5 + Math.random() * 5.0
    }

    // Même rappel pour toutes les billes : recentre le corps sans le comprimer.
    m.velocity.x += -center.x * params.centering * dt * 60
    m.velocity.y += -center.y * params.centering * dt * 60

    // Faible profondeur : liberté 3D limitée, sans imposer une nappe ou une trajectoire.
    m.velocity.z += -m.mesh.position.z * 0.020 * dt * 60
    m.velocity.z *= Math.pow(0.94, dt * 60)

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
