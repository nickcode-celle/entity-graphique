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
  localCohesion: 0.010,
  separation: 0.090,
  alignment: 0.095,
  centering: 0.0026,
  flow: 0.008,
  flowSpeed: 0.13,
  maxSpeed: 0.027,
  neighbourRadius: 1.65,
  preferredSpacing: 0.72,
  depth: 0.18,
  sheetForce: 0.045,
  wave: 0.52,
}

const gui = new GUI({ title: 'ENTITY — Murmuration V5' })
gui.add(params, 'localCohesion', 0, 0.03, 0.0005).name('Cohésion locale')
gui.add(params, 'separation', 0, 0.18, 0.001).name('Séparation')
gui.add(params, 'alignment', 0, 0.16, 0.001).name('Alignement')
gui.add(params, 'centering', 0, 0.015, 0.0001).name('Rappel centre')
gui.add(params, 'flow', 0, 0.025, 0.0005).name('Flux collectif')
gui.add(params, 'flowSpeed', 0.04, 0.5, 0.01).name('Rythme du flux')
gui.add(params, 'maxSpeed', 0.005, 0.07, 0.001).name('Vitesse')
gui.add(params, 'neighbourRadius', 0.8, 3, 0.05).name('Rayon voisins')
gui.add(params, 'preferredSpacing', 0.35, 1.2, 0.01).name('Espacement')
gui.add(params, 'depth', 0.05, 0.7, 0.01).name('Profondeur')
gui.add(params, 'wave', 0, 1.1, 0.01).name('Ondulation')

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

  // Nappe initiale large, irrégulière et très peu profonde.
  const x = (Math.random() - 0.5) * 8.4
  const normalizedX = Math.min(Math.abs(x) / 4.2, 1)
  const height = 1.15 + (1 - normalizedX) * 1.0
  const y = (Math.random() - 0.5) * height * 2
  const z = (Math.random() - 0.5) * params.depth * 2

  mesh.position.set(x, y, z)

  const velocity = new THREE.Vector3(1, 0, 0)
    .add(new THREE.Vector3((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.08, 0))
    .normalize()
    .multiplyScalar(params.maxSpeed * (0.82 + Math.random() * 0.10))

  marbles.push({ mesh, velocity })
  swarm.add(mesh)
}

const center = new THREE.Vector3()
const localForce = new THREE.Vector3()
const alignmentForce = new THREE.Vector3()
const centeringForce = new THREE.Vector3()
const flowForce = new THREE.Vector3()
const globalFlow = new THREE.Vector3()
const delta = new THREE.Vector3()
const tmp = new THREE.Vector3()
const clock = new THREE.Clock()

function limitSpeed(v, max) {
  if (v.lengthSq() > max * max) v.setLength(max)
}

function updateSwarm(dt, elapsed) {
  center.set(0, 0, 0)
  for (const m of marbles) center.add(m.mesh.position)
  center.divideScalar(marbles.length)

  // Ce rappel déplace le corps entier mais ne resserre plus les billes entre elles.
  centeringForce.set(
    -center.x * params.centering,
    -center.y * params.centering,
    -center.z * params.centering
  )

  // Intention de déplacement commune, lente et continue.
  globalFlow.set(
    Math.cos(elapsed * params.flowSpeed),
    Math.sin(elapsed * params.flowSpeed * 0.77) * 0.50,
    0
  ).normalize()

  for (let i = 0; i < marbles.length; i++) {
    const marble = marbles[i]
    const p = marble.mesh.position

    localForce.set(0, 0, 0)
    alignmentForce.set(0, 0, 0)
    let neighbours = 0

    for (let j = 0; j < marbles.length; j++) {
      if (i === j) continue

      const other = marbles[j]
      delta.copy(other.mesh.position).sub(p)
      const d2 = delta.lengthSq()
      if (d2 === 0 || d2 > params.neighbourRadius ** 2) continue

      const d = Math.sqrt(d2)
      neighbours++
      alignmentForce.add(other.velocity)

      // Régulation locale de densité : trop près on repousse, trop loin on attire doucement.
      const error = d - params.preferredSpacing
      const strength = error < 0 ? params.separation : params.localCohesion
      localForce.add(tmp.copy(delta).normalize().multiplyScalar(error * strength))
    }

    if (neighbours > 0) {
      localForce.divideScalar(neighbours)
      alignmentForce
        .divideScalar(neighbours)
        .sub(marble.velocity)
        .multiplyScalar(params.alignment)
    }

    // Une vague traverse la nappe : elle déforme le corps sans créer 100 mouvements indépendants.
    const wave1 = Math.sin(p.x * 0.62 + elapsed * params.flowSpeed * 3.4)
    const wave2 = Math.sin(p.x * 0.27 - elapsed * params.flowSpeed * 1.7)

    flowForce.copy(globalFlow)
    flowForce.y += (wave1 * 0.34 + wave2 * 0.16) * params.wave
    flowForce.x += Math.cos(p.y * 0.55 + elapsed * params.flowSpeed * 1.3) * 0.06
    flowForce.z = 0
    flowForce.normalize().multiplyScalar(params.flow)

    // La profondeur reste faible, mais jamais parfaitement plane.
    const targetZ = Math.sin(p.x * 0.34 + elapsed * params.flowSpeed * 1.8) * params.depth * 0.45
    const sheetPull = (targetZ - p.z) * params.sheetForce

    marble.velocity
      .addScaledVector(localForce, dt * 60)
      .addScaledVector(alignmentForce, dt * 60)
      .addScaledVector(centeringForce, dt * 60)
      .addScaledVector(flowForce, dt * 60)

    marble.velocity.z += sheetPull * dt * 60
    marble.velocity.z *= 0.86

    limitSpeed(marble.velocity, params.maxSpeed)
    marble.mesh.position.addScaledVector(marble.velocity, dt * 60)
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
