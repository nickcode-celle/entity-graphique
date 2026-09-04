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
  width: 7.8,
  height: 3.6,
  depth: 0.16,
  deformation: 1.0,
  waveSpeed: 0.42,
  follow: 0.055,
  damping: 0.90,
  drift: 0.55,
}

const gui = new GUI({ title: 'ENTITY — Murmuration V6' })
gui.add(params, 'width', 5.5, 10, 0.1).name('Largeur')
gui.add(params, 'height', 2.2, 5.5, 0.1).name('Hauteur')
gui.add(params, 'depth', 0.02, 0.6, 0.01).name('Profondeur')
gui.add(params, 'deformation', 0, 1.8, 0.02).name('Déformation')
gui.add(params, 'waveSpeed', 0.08, 1.1, 0.01).name('Rythme')
gui.add(params, 'follow', 0.01, 0.12, 0.001).name('Souplesse')
gui.add(params, 'drift', 0, 1.2, 0.02).name('Déplacement global')

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

// Chaque bille possède une place durable dans une même nappe souple.
// Les positions ne forment pas une grille visible : elles sont irrégulières,
// mais leur ordre topologique reste stable pour empêcher les grappes séparées.
for (let i = 0; i < 100; i++) {
  const mesh = new THREE.Mesh(geometry, material)

  const u = (i + 0.5) / 100
  const jitterU = (Math.random() - 0.5) * 0.018
  const uu = THREE.MathUtils.clamp(u + jitterU, 0, 1)

  // Distribution verticale pseudo-aléatoire mais régulière sur l'ensemble de la nappe.
  const golden = 0.61803398875
  const v = ((i * golden) % 1) * 2 - 1

  const x = (uu - 0.5) * params.width
  const envelope = 0.72 + 0.28 * Math.sin(Math.PI * uu)
  const y = v * params.height * 0.5 * envelope
  const z = (Math.random() - 0.5) * params.depth

  mesh.position.set(x, y, z)

  marbles.push({
    mesh,
    u: uu,
    v,
    velocity: new THREE.Vector3(),
    phase: Math.random() * Math.PI * 2,
  })
  swarm.add(mesh)
}

const clock = new THREE.Clock()
const target = new THREE.Vector3()

function sheetTarget(m, elapsed) {
  const u = m.u
  const v = m.v
  const t = elapsed * params.waveSpeed

  // Silhouette irrégulière : bosses, creux et étranglements qui se déplacent.
  const widthWarp =
    Math.sin(u * Math.PI * 2.0 - t * 0.9) * 0.34 +
    Math.sin(u * Math.PI * 4.6 + t * 0.55) * 0.13

  const envelope =
    0.72 +
    0.20 * Math.sin(Math.PI * u) +
    0.16 * Math.sin(u * Math.PI * 3.2 - t * 0.8)

  const x =
    (u - 0.5) * params.width +
    widthWarp * params.deformation

  const centerWave =
    Math.sin(u * Math.PI * 2.2 - t * 1.05) * 0.72 +
    Math.sin(u * Math.PI * 5.1 + t * 0.47) * 0.22

  const pinch = 1 -
    0.34 * Math.exp(-Math.pow((u - (0.48 + Math.sin(t * 0.37) * 0.10)) / 0.13, 2))

  const y =
    centerWave * params.deformation +
    v * params.height * 0.5 * envelope * pinch

  const z =
    Math.sin(u * Math.PI * 3.1 - t * 0.62 + m.phase) *
    params.depth * 0.48 * (0.35 + 0.65 * Math.abs(v))

  // Le corps entier dérive lentement sans jamais quitter le champ.
  const driftX = Math.sin(t * 0.24) * params.drift
  const driftY = Math.sin(t * 0.19 + 1.2) * params.drift * 0.38

  target.set(x + driftX, y + driftY, z)
  return target
}

function updateSwarm(dt, elapsed) {
  for (const m of marbles) {
    const goal = sheetTarget(m, elapsed)

    // Ressort souple vers la forme collective cible.
    m.velocity.x += (goal.x - m.mesh.position.x) * params.follow * dt * 60
    m.velocity.y += (goal.y - m.mesh.position.y) * params.follow * dt * 60
    m.velocity.z += (goal.z - m.mesh.position.z) * params.follow * 1.4 * dt * 60

    m.velocity.multiplyScalar(Math.pow(params.damping, dt * 60))
    m.mesh.position.addScaledVector(m.velocity, dt * 60)
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
