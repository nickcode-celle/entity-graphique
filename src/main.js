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
  cohesion: 0.0022,
  separation: 0.075,
  alignment: 0.018,
  centering: 0.0045,
  wandering: 0.0035,
  maxSpeed: 0.034,
  neighbourRadius: 1.25,
  comfortDistance: 0.62,
  breathing: 0.05,
  breathingSpeed: 0.38,
}

const gui = new GUI({ title: 'ENTITY — Murmuration V2' })
gui.add(params, 'cohesion', 0, 0.02, 0.0001).name('Cohésion')
gui.add(params, 'separation', 0, 0.15, 0.001).name('Séparation')
gui.add(params, 'alignment', 0, 0.12, 0.001).name('Alignement')
gui.add(params, 'centering', 0, 0.02, 0.0001).name('Rappel centre')
gui.add(params, 'wandering', 0, 0.012, 0.0001).name('Murmure aléatoire')
gui.add(params, 'maxSpeed', 0.005, 0.08, 0.001).name('Vitesse')
gui.add(params, 'neighbourRadius', 0.5, 3, 0.05).name('Rayon voisins')
gui.add(params, 'comfortDistance', 0.2, 1, 0.01).name('Distance confort')
gui.add(params, 'breathing', 0, 0.25, 0.005).name('Respiration')
gui.add(params, 'breathingSpeed', 0.1, 1.5, 0.05).name('Rythme respiration')

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
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)
  const radius = Math.pow(Math.random(), 0.52) * 3.7
  mesh.position.set(
    Math.sin(phi) * Math.cos(theta) * radius * 1.35,
    Math.cos(phi) * radius * 0.72,
    Math.sin(phi) * Math.sin(theta) * radius * 0.9
  )
  const velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
    .normalize().multiplyScalar(params.maxSpeed * (0.55 + Math.random() * 0.45))
  const wander = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize()
  marbles.push({ mesh, velocity, wander, wanderTimer: Math.random() * 2.5 })
  swarm.add(mesh)
}

const center = new THREE.Vector3()
const cohesionForce = new THREE.Vector3()
const separationForce = new THREE.Vector3()
const alignmentForce = new THREE.Vector3()
const centeringForce = new THREE.Vector3()
const delta = new THREE.Vector3()
const tmp = new THREE.Vector3()
const clock = new THREE.Clock()

function limitSpeed(v, max) { if (v.lengthSq() > max * max) v.setLength(max) }

function updateSwarm(dt, elapsed) {
  center.set(0, 0, 0)
  for (const m of marbles) center.add(m.mesh.position)
  center.divideScalar(marbles.length)
  centeringForce.copy(center).multiplyScalar(-params.centering)

  for (let i = 0; i < marbles.length; i++) {
    const marble = marbles[i]
    cohesionForce.copy(center).sub(marble.mesh.position).multiplyScalar(params.cohesion)
    separationForce.set(0, 0, 0)
    alignmentForce.set(0, 0, 0)
    let neighbours = 0

    for (let j = 0; j < marbles.length; j++) {
      if (i === j) continue
      const other = marbles[j]
      delta.copy(marble.mesh.position).sub(other.mesh.position)
      const d2 = delta.lengthSq()
      if (d2 < params.neighbourRadius ** 2) { alignmentForce.add(other.velocity); neighbours++ }
      if (d2 > 0 && d2 < params.comfortDistance ** 2) {
        const d = Math.sqrt(d2)
        separationForce.add(tmp.copy(delta).normalize().multiplyScalar((params.comfortDistance - d) / params.comfortDistance))
      }
    }

    if (neighbours) alignmentForce.divideScalar(neighbours).sub(marble.velocity).multiplyScalar(params.alignment)
    separationForce.multiplyScalar(params.separation)

    // Chaque bille change doucement d'intention à un rythme différent : pas de boucle commune.
    marble.wanderTimer -= dt
    if (marble.wanderTimer <= 0) {
      marble.wander.add(new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(0.7)).normalize()
      marble.wanderTimer = 0.35 + Math.random() * 2.4
    }

    marble.velocity
      .addScaledVector(cohesionForce, dt * 60)
      .addScaledVector(separationForce, dt * 60)
      .addScaledVector(alignmentForce, dt * 60)
      .addScaledVector(centeringForce, dt * 60)
      .addScaledVector(marble.wander, params.wandering * dt * 60)

    limitSpeed(marble.velocity, params.maxSpeed)
    marble.mesh.position.addScaledVector(marble.velocity, dt * 60)
  }

  const breath = Math.sin(elapsed * params.breathingSpeed * Math.PI * 2) * params.breathing
  const breathScale = 1 + breath * 0.00055 * dt * 60
  for (const m of marbles) m.mesh.position.sub(center).multiplyScalar(breathScale).add(center)
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
